from datetime import timedelta

from django.core.cache import cache
from django.db.models import Count, DecimalField, ExpressionWrapper, F, IntegerField, OuterRef, Q, Subquery, Sum, Value
from django.db.models.functions import Coalesce, TruncDate
from django.utils import timezone

from rest_framework.decorators import api_view, permission_classes

from rest_framework.response import Response
from analytics.models import EVENT_TYPES, TrackEvent
from userauths.permissions import effective_permissions, staff_can

from catalog.models import Product, ProductVariant, WaitlistEntry
from catalog.serializers import ProductListSerializer
from common.pagination import AdminPagination, paginate
from orders.models import Order, OrderItem, GiftCard, LoyaltyTransaction, LOYALTY_POINT_VALUE
from orders.queries import cart_queryset, order_queryset
from orders.serializers import CartItemSerializer, OrderSerializer
from userauths.models import Favorite, User
from userauths.serializers import AddressSerializer

PAID_STATUSES = ['paid', 'processing', 'shipped', 'delivered']


# ── Vue d'ensemble ────────────────────────────────────────────────────────────
STATS_CACHE_KEY = 'admin_stats_overview'
STATS_CACHE_SECONDS = 60


@api_view(['GET'])
@permission_classes([staff_can('analytics')])
def stats_overview(request):
    return Response(cache.get_or_set(STATS_CACHE_KEY, _compute_stats, STATS_CACHE_SECONDS))


def _compute_stats():
    paid_orders = Order.objects.filter(status__in=PAID_STATUSES)
    paid_totals = paid_orders.aggregate(total=Sum('total'), count=Count('id'))
    revenue_total = paid_totals['total'] or 0
    paid_count = paid_totals['count']

    orders_by_status = list(Order.objects.values('status').annotate(count=Count('id')).order_by('status'))

    low_stock = (
        ProductVariant.objects.filter(stock__lte=2, stock__gt=0)
        .select_related('product').order_by('stock')[:10]
    )

    # ── Tendance des 14 derniers jours ───────────────────────────────────────
    since = timezone.now() - timedelta(days=13)
    daily = (
        paid_orders.filter(created_at__gte=since)
        .annotate(day=TruncDate('created_at'))
        .values('day').annotate(total=Sum('total'), count=Count('id'))
        .order_by('day')
    )
    daily_by_date = {row['day'].isoformat(): row for row in daily}
    revenue_trend = []
    for i in range(14):
        day = (since + timedelta(days=i)).date()
        row = daily_by_date.get(day.isoformat())
        revenue_trend.append({
            'date': day.isoformat(),
            'total': row['total'] if row else 0,
            'orders': row['count'] if row else 0,
        })

    # ── Top produits (30 derniers jours, sur commandes payées) ──────────────
    since_30 = timezone.now() - timedelta(days=30)
    top_products = (
        OrderItem.objects.filter(
            order__status__in=PAID_STATUSES, order__created_at__gte=since_30, variant__isnull=False,
        )
        .values(name=F('variant__product__name'))
        .annotate(
            revenue=Sum(
                ExpressionWrapper(F('unit_price') * F('quantity'), output_field=DecimalField())
            ),
        )
        .annotate(quantity=Sum('quantity'))
        .order_by('-revenue')[:5]
    )

    orders_count = Order.objects.count()
    average_order_value = (revenue_total / paid_count) if paid_count else 0

    new_customers_30d = User.objects.filter(is_staff=False, date_joined__gte=since_30).count()

    gift_cards_outstanding = GiftCard.objects.filter(status='active').aggregate(t=Sum('balance'))['t'] or 0
    loyalty_points_outstanding = LoyaltyTransaction.objects.aggregate(t=Sum('points'))['t'] or 0
    waitlist_pending = WaitlistEntry.objects.filter(notified=False).count()

    return {
        'revenue_total':       revenue_total,
        'orders_count':        orders_count,
        'orders_by_status':    orders_by_status,
        'customers_count':     User.objects.filter(is_staff=False).count(),
        'products_count':      Product.objects.filter(is_active=True).count(),
        'out_of_stock_count':  ProductVariant.objects.filter(stock=0).count(),
        'low_stock': [
            {'product': v.product.name, 'variant': v.label, 'stock': v.stock} for v in low_stock
        ],
        'revenue_trend':       revenue_trend,
        'top_products':        list(top_products),
        'average_order_value': round(average_order_value),
        'new_customers_30d':   new_customers_30d,
        'gift_cards_outstanding':      gift_cards_outstanding,
        'loyalty_points_outstanding':  loyalty_points_outstanding,
        'loyalty_liability_amount':    loyalty_points_outstanding * LOYALTY_POINT_VALUE,
        'waitlist_pending':    waitlist_pending,
    }


# ── Clients : liste + détail (panier, favoris, commandes) ───────────────────
def _per_user(model, **filters):
    """Sous-requête « une ligne par utilisateur » pour compter/sommer sans multiplier les jointures."""
    return model.objects.filter(user=OuterRef('pk'), **filters).order_by().values('user')


@api_view(['GET'])
@permission_classes([staff_can('customers')])
def customers_list(request):
    search = (request.query_params.get('search') or '').strip()[:100]
    qs = User.objects.filter(is_staff=False)
    if search:
        qs = qs.filter(Q(email__icontains=search) | Q(full_name__icontains=search) | Q(phone__icontains=search))

    qs = qs.annotate(
        orders_count=Coalesce(Subquery(_per_user(Order).annotate(c=Count('pk')).values('c'), output_field=IntegerField()), 0),
        total_spent=Coalesce(
            Subquery(
                _per_user(Order, status__in=PAID_STATUSES).annotate(t=Sum('total')).values('t'),
                output_field=DecimalField(max_digits=14, decimal_places=2),
            ),
            Value(0), output_field=DecimalField(max_digits=14, decimal_places=2),
        ),
        favorites_count=Coalesce(Subquery(_per_user(Favorite).annotate(c=Count('pk')).values('c'), output_field=IntegerField()), 0),
    ).order_by('-date_joined', 'id')

    paginator = AdminPagination()
    page = paginator.paginate_queryset(qs, request)

    # Paniers de la page seulement (20 clients max) : total calculé en Python car le prix d'un coffret n'est pas exprimable en SQL
    latest_cart = {}
    for cart in cart_queryset().filter(user_id__in=[u.id for u in page]).order_by('updated_at'):
        latest_cart[cart.user_id] = cart

    rows = []
    for u in page:
        cart = latest_cart.get(u.id)
        items = list(cart.items.all()) if cart else []
        rows.append({
            'id': u.id,
            'email': u.email,
            'full_name': u.full_name,
            'phone': u.phone,
            'date_joined': u.date_joined,
            'orders_count': u.orders_count,
            'total_spent': u.total_spent,
            'cart_items_count': len(items),
            'cart_total': cart.total if cart else 0,
            'favorites_count': u.favorites_count,
        })
    return paginator.get_paginated_response(rows)


@api_view(['GET'])
@permission_classes([staff_can('customers')])
def customer_detail(request, user_id):
    try:
        u = User.objects.get(id=user_id)
    except (User.DoesNotExist, ValueError):
        return Response({'error': 'Client introuvable.'}, status=404)

    cart_items = []
    for cart in cart_queryset().filter(user=u):
        cart_items.extend(CartItemSerializer(cart.items.all(), many=True, context={'request': request}).data)

    favorites = [
        {'id': f.id, 'product': ProductListSerializer(f.product).data, 'created_at': f.created_at}
        for f in u.favorites.select_related('product__category').prefetch_related('product__variants', 'product__images')[:50]
    ]

    # Fiche client : 50 dernières commandes (la liste complète se consulte dans « Commandes »)
    orders = order_queryset().filter(user=u)
    orders_total = orders.count()
    orders = orders[:50]

    # Parcours sur le site : réservé au droit « statistiques » (donnée de comportement)
    activity = None
    if 'analytics' in effective_permissions(request.user):
        labels = dict(EVENT_TYPES)
        activity = [
            {'label': labels.get(e.type, e.type), 'detail': e.product.name if e.product else (e.ref or e.path), 'at': e.created_at}
            for e in TrackEvent.objects.filter(session__user=u).select_related('product').order_by('-created_at')[:40]
        ]

    return Response({
        'id': u.id,
        'email': u.email,
        'full_name': u.full_name,
        'activity': activity,
        'phone': u.phone,
        'date_joined': u.date_joined,
        'is_active': u.is_active,
        'addresses': AddressSerializer(u.addresses.all(), many=True).data,
        'cart_items': cart_items,
        'favorites': favorites,
        'orders': OrderSerializer(orders, many=True, context={'request': request}).data,
        'orders_total': orders_total,
    })


# ── Commandes (toutes, avec filtre statut et recherche) ─────────────────────
@api_view(['GET'])
@permission_classes([staff_can('orders')])
def admin_orders_list(request):
    qs = order_queryset()
    status_filter = request.query_params.get('status')
    if status_filter:
        qs = qs.filter(status=status_filter)
    search = (request.query_params.get('search') or '').strip()[:100]
    if search:
        qs = qs.filter(
            Q(order_number__icontains=search) | Q(guest_email__icontains=search) | Q(user__email__icontains=search)
            | Q(user__full_name__icontains=search)
        )
    return paginate(request, qs, OrderSerializer, pagination=AdminPagination, context={'request': request})
