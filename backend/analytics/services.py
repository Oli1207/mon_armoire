"""Calcul des statistiques d'une journée à partir des événements bruts (sessions du personnel exclues)."""
from datetime import datetime, time, timedelta

from django.db import transaction
from django.db.models import Count, Sum
from django.utils import timezone

from orders.models import Order
from userauths.models import Favorite

from .models import DailyProductStat, DailyStat, TrackEvent, VisitSession

PAID_STATUSES = ['paid', 'processing', 'shipped', 'delivered']
TOP = 20


def day_bounds(day):
    start = timezone.make_aware(datetime.combine(day, time.min))
    return start, start + timedelta(days=1)


def _top(queryset, field, flag=None):
    rows = queryset.values(field).annotate(n=Count('id')).order_by('-n', field)[:TOP]
    return {str(row[field]): row['n'] for row in rows if row[field]}


def compute_day(day):
    """Dictionnaire complet des chiffres d'un jour (sans rien enregistrer)."""
    start, end = day_bounds(day)
    events = TrackEvent.objects.filter(created_at__gte=start, created_at__lt=end, session__is_internal=False)
    by_type = {row['type']: row['n'] for row in events.values('type').annotate(n=Count('id'))}

    def sessions_with(kind):
        return events.filter(type=kind).values('session').distinct().count()

    session_ids = events.values('session')
    sessions = VisitSession.objects.filter(id__in=session_ids)
    devices = {row['device'] or 'inconnu': row['n'] for row in sessions.values('device').annotate(n=Count('id'))}
    sources = {row['source'] or 'direct': row['n'] for row in sessions.values('source').annotate(n=Count('id')).order_by('-n')[:TOP]}

    searches = events.filter(type='search').exclude(ref='')
    paid = Order.objects.filter(status__in=PAID_STATUSES, created_at__gte=start, created_at__lt=end)
    paid_totals = paid.aggregate(n=Count('id'), total=Sum('total'))

    products = {}
    for row in events.filter(product__isnull=False, type__in=('product_view', 'add_to_cart')).values('product', 'type').annotate(n=Count('id')):
        stat = products.setdefault(row['product'], {'views': 0, 'adds': 0, 'likes': 0})
        stat['views' if row['type'] == 'product_view' else 'adds'] = row['n']
    for row in Favorite.objects.filter(created_at__gte=start, created_at__lt=end).values('product').annotate(n=Count('id')):
        products.setdefault(row['product'], {'views': 0, 'adds': 0, 'likes': 0})['likes'] = row['n']

    return {
        'visitors': session_ids.distinct().count(),
        'pageviews': by_type.get('pageview', 0),
        'product_views': by_type.get('product_view', 0),
        'add_to_carts': by_type.get('add_to_cart', 0),
        'viewers': sessions_with('product_view'),
        'carters': sessions_with('add_to_cart'),
        'checkouts': sessions_with('begin_checkout'),
        'orders': paid_totals['n'] or 0,
        'revenue': paid_totals['total'] or 0,
        'devices': devices,
        'sources': sources,
        'pages': _top(events.filter(type='pageview'), 'path'),
        'searches': _top(searches, 'ref'),
        'empty_searches': _top(searches.filter(value=0), 'ref'),
        'products': products,
    }


@transaction.atomic
def persist_day(day):
    """Enregistre (ou remplace) les chiffres d'un jour : peut être relancé sans risque."""
    data = compute_day(day)
    products = data.pop('products')
    DailyStat.objects.update_or_create(date=day, defaults=data)
    DailyProductStat.objects.filter(date=day).delete()
    DailyProductStat.objects.bulk_create(
        [DailyProductStat(date=day, product_id=pid, **stat) for pid, stat in products.items()], batch_size=500,
    )
    return data
