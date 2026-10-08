"""Écrans « Visiteurs » de l'Admin : réservés au droit « analytics ». Lecture seule, chiffres des tableaux journaliers + aujourd'hui en direct."""
from collections import Counter
from datetime import timedelta

from django.core.cache import cache
from django.db.models import Count, Sum
from django.db.models.functions import Lower, Trim
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from catalog.models import Product
from common.pagination import AdminPagination, paginate
from orders.models import Order
from orders.queries import cart_queryset
from orders.serializers import CartSerializer
from userauths.models import Favorite
from userauths.permissions import staff_can

from .models import DailyProductStat, DailyStat, VisitSession
from .services import PAID_STATUSES, compute_day

PERIODS = (7, 30, 90)
LIVE_WINDOW = timedelta(minutes=5)
ABANDONED_AFTER = timedelta(hours=24)


def _days(request):
    try:
        days = int(request.query_params.get('days', 30))
    except ValueError:
        days = 30
    return days if days in PERIODS else 30


def _today_live():
    """Chiffres d'aujourd'hui, recalculés au plus toutes les 2 minutes (le cron ne passe qu'une fois par heure)."""
    day = timezone.localdate()
    return cache.get_or_set(f'analytics-today-{day}', lambda: compute_day(day), 120)


def _period_rows(days):
    """(lignes déjà enregistrées pour les jours passés) + (aujourd'hui en direct), sous forme de dictionnaires."""
    today = timezone.localdate()
    first = today - timedelta(days=days - 1)
    stored = {row.date: row for row in DailyStat.objects.filter(date__gte=first, date__lt=today)}
    rows = []
    for offset in range(days):
        day = first + timedelta(days=offset)
        if day == today:
            data = _today_live()
        else:
            row = stored.get(day)
            data = {k: getattr(row, k) for k in ('visitors', 'pageviews', 'product_views', 'add_to_carts', 'viewers', 'carters',
                                                  'checkouts', 'orders', 'revenue', 'devices', 'sources', 'pages', 'searches',
                                                  'empty_searches')} if row else {}
        rows.append((day, data))
    return rows


def _merge(rows, key):
    total = Counter()
    for _, data in rows:
        total.update(data.get(key) or {})
    return total


def _top(counter, n=10):
    return [{'label': k, 'count': v} for k, v in counter.most_common(n)]


@api_view(['GET'])
@permission_classes([staff_can('analytics')])
def analytics_overview(request):
    days = _days(request)
    rows = _period_rows(days)

    def total(key):
        return sum(data.get(key, 0) for _, data in rows)

    live_since = timezone.now() - LIVE_WINDOW
    return Response({
        'days': days,
        'online_now': VisitSession.objects.filter(last_seen__gte=live_since, is_internal=False).count(),
        'totals': {
            'visits': total('visitors'), 'pageviews': total('pageviews'), 'product_views': total('product_views'),
            'add_to_carts': total('add_to_carts'), 'orders': total('orders'), 'revenue': total('revenue'),
        },
        'funnel': [
            {'label': 'Ont visité le site', 'count': total('visitors')},
            {'label': 'Ont regardé un bijou', 'count': total('viewers')},
            {'label': 'Ont ajouté au panier', 'count': total('carters')},
            {'label': 'Ont ouvert la page de commande', 'count': total('checkouts')},
            {'label': 'Ont payé (commandes)', 'count': total('orders')},
        ],
        'series': [{'date': day.isoformat(), 'visits': data.get('visitors', 0), 'orders': data.get('orders', 0)} for day, data in rows],
        'devices': _top(_merge(rows, 'devices')),
        'sources': _top(_merge(rows, 'sources')),
        'pages': _top(_merge(rows, 'pages'), 10),
    })


@api_view(['GET'])
@permission_classes([staff_can('analytics')])
def analytics_searches(request):
    rows = _period_rows(_days(request))
    return Response({'top': _top(_merge(rows, 'searches'), 20), 'empty': _top(_merge(rows, 'empty_searches'), 20)})


def _product_card(product, **extra):
    return {'id': product.id, 'name': product.name, 'slug': product.slug, 'image': product.main_thumbnail, **extra}


@api_view(['GET'])
@permission_classes([staff_can('analytics')])
def analytics_products(request):
    days = _days(request)
    today = timezone.localdate()
    first = today - timedelta(days=days - 1)
    totals = {}
    for row in (DailyProductStat.objects.filter(date__gte=first, date__lt=today)
                .values('product').annotate(views=Sum('views'), adds=Sum('adds'), likes=Sum('likes'))):
        totals[row['product']] = {'views': row['views'], 'adds': row['adds'], 'likes': row['likes']}
    for pid, stat in _today_live()['products'].items():
        mine = totals.setdefault(pid, {'views': 0, 'adds': 0, 'likes': 0})
        for key in mine:
            mine[key] += stat[key]

    liked_total = {row['product']: row['n'] for row in Favorite.objects.values('product').annotate(n=Count('id')).order_by('-n')[:20]}
    wanted = set(totals) | set(liked_total)
    products = {p.id: p for p in Product.objects.filter(id__in=wanted).prefetch_related('images')}

    def ranking(key, source, n=10):
        ordered = sorted(((pid, v[key]) for pid, v in source.items() if v[key] > 0 and pid in products), key=lambda x: -x[1])[:n]
        return [_product_card(products[pid], count=count, views=totals.get(pid, {}).get('views', 0),
                              adds=totals.get(pid, {}).get('adds', 0)) for pid, count in ordered]

    return Response({
        'days': days,
        'most_viewed': ranking('views', totals),
        'most_added': ranking('adds', totals),
        'most_liked': [_product_card(products[pid], count=n) for pid, n in liked_total.items() if pid in products][:10],
    })


class AdminCartSerializer(CartSerializer):
    customer = serializers.SerializerMethodField()
    is_abandoned = serializers.SerializerMethodField()

    class Meta(CartSerializer.Meta):
        fields = CartSerializer.Meta.fields + ('customer', 'updated_at', 'is_abandoned')

    def get_customer(self, cart):
        return {'email': cart.user.email, 'name': cart.user.full_name, 'id': cart.user_id} if cart.user_id else None

    def get_is_abandoned(self, cart):
        return cart.updated_at < timezone.now() - ABANDONED_AFTER


@api_view(['GET'])
@permission_classes([staff_can('analytics', 'customers')])
def analytics_carts(request):
    """Paniers non vides (les plus récents d'abord) : « en cours » = modifiés depuis moins de 24 h, « abandonnés » = plus anciens."""
    qs = cart_queryset().select_related('user').filter(items__isnull=False).exclude(user__is_staff=True).distinct()
    limit = timezone.now() - ABANDONED_AFTER
    state = request.query_params.get('state')
    if state == 'active':
        qs = qs.filter(updated_at__gte=limit)
    elif state == 'abandoned':
        qs = qs.filter(updated_at__lt=limit)
    return paginate(request, qs.order_by('-updated_at', 'id'), AdminCartSerializer, pagination=AdminPagination, context={'request': request})


@api_view(['GET'])
@permission_classes([staff_can('analytics')])
def analytics_places(request):
    """D'où commandent vos clientes : communes et quartiers des commandes PAYÉES livrées (adresses réelles, pas une estimation)."""
    days = _days(request)
    orders = Order.objects.filter(
        status__in=PAID_STATUSES, delivery_method='shipping', address__isnull=False,
        created_at__gte=timezone.now() - timedelta(days=days),
    )

    def ranking(queryset, *fields, limit=15):
        rows = queryset.values(*fields).annotate(count=Count('id'), revenue=Sum('total')).order_by('-count', *fields)[:limit]
        return [{**{f.split('__')[-1].replace('lower', ''): row[f] for f in fields}, 'count': row['count'], 'revenue': row['revenue']} for row in rows]

    abidjan = orders.exclude(address__commune='')
    quartiers = abidjan.exclude(address__quartier='').annotate(place=Lower(Trim('address__quartier')))
    return Response({
        'days': days,
        'orders': orders.count(),
        'communes': [{'label': r['commune'], 'count': r['count'], 'revenue': r['revenue']} for r in ranking(abidjan, 'address__commune')],
        'quartiers': [
            {'label': r['place'].title(), 'commune': r['commune'], 'count': r['count'], 'revenue': r['revenue']}
            for r in (
                {'place': row['place'], 'commune': row['address__commune'], 'count': row['count'], 'revenue': row['revenue']}
                for row in quartiers.values('place', 'address__commune').annotate(count=Count('id'), revenue=Sum('total')).order_by('-count', 'place')[:20]
            )
        ],
        'cities': [
            {'label': r['place'].title(), 'count': r['count'], 'revenue': r['revenue']}
            for r in (
                {'place': row['place'], 'count': row['count'], 'revenue': row['revenue']}
                for row in orders.filter(address__commune='').annotate(place=Lower(Trim('address__city'))).values('place').annotate(count=Count('id'), revenue=Sum('total')).order_by('-count', 'place')[:10]
            )
        ],
        'unknown': abidjan.filter(address__quartier='').count(),
    })
