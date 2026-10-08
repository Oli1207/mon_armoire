"""Requêtes préchargées pour paniers et commandes : un nombre de requêtes constant quel que soit le nombre d'articles."""
from .models import Cart, Order
from .serializers import CartSerializer, OrderSerializer

_ITEM_PREFETCH = [
    'variant__product__images',
    'coffret_configuration__coffret',
    'coffret_configuration__removed_items',
    'coffret_configuration__coffret__included_items__variant__product__images',
    'coffret_configuration__items__variant__product__images',
]


def cart_queryset():
    return Cart.objects.prefetch_related(*[f'items__{lookup}' for lookup in _ITEM_PREFETCH])


def order_queryset():
    return (
        Order.objects.select_related('address', 'delivery_zone', 'user')
        .prefetch_related('status_history', *[f'items__{lookup}' for lookup in _ITEM_PREFETCH])
    )


def serialize_cart(cart, request):
    return CartSerializer(cart_queryset().get(pk=cart.pk), context={'request': request}).data


def serialize_order(order, request):
    return OrderSerializer(order_queryset().get(pk=order.pk), context={'request': request}).data
