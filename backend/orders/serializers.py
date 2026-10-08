from rest_framework import serializers

from catalog.serializers import ProductVariantSerializer
from coffrets.serializers import CoffretConfigurationSummarySerializer
from userauths.serializers import AddressSerializer
from .models import Cart, CartItem, DeliveryZone, GiftCard, LoyaltyTransaction, Order, OrderItem, OrderStatusHistory


def _item_image(obj):
    """Photo à afficher pour un article de panier/commande : image de la variante,
    sinon photo principale du produit, sinon photo du coffret."""
    if obj.variant:
        if obj.variant.image:
            return obj.variant.image.url
        return obj.variant.product.main_thumbnail
    if obj.coffret_configuration:
        image = obj.coffret_configuration.coffret.image
        return image.url if image else None
    return None


class CartItemSerializer(serializers.ModelSerializer):
    variant               = ProductVariantSerializer(read_only=True)
    coffret_configuration = CoffretConfigurationSummarySerializer(read_only=True)
    product_name          = serializers.SerializerMethodField()
    product_slug          = serializers.SerializerMethodField()
    product_image          = serializers.SerializerMethodField()
    unit_price             = serializers.ReadOnlyField()
    subtotal               = serializers.ReadOnlyField()

    class Meta:
        model  = CartItem
        fields = ('id', 'variant', 'coffret_configuration', 'product_name', 'product_slug', 'product_image', 'quantity',
                  'gift_wrap', 'gift_message', 'engraving_text', 'unit_price', 'subtotal', 'added_at')

    def get_product_name(self, obj):
        return obj.variant.product.name if obj.variant else None

    def get_product_slug(self, obj):
        return obj.variant.product.slug if obj.variant else None

    def get_product_image(self, obj):
        return _item_image(obj)


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    total = serializers.ReadOnlyField()

    class Meta:
        model  = Cart
        fields = ('id', 'items', 'total')


class DeliveryZoneSerializer(serializers.ModelSerializer):
    class Meta:
        model  = DeliveryZone
        fields = ('id', 'name', 'shipping_cost', 'estimated_days_min', 'estimated_days_max')


# ── Commande ──────────────────────────────────────────────────────────────────
class OrderItemSerializer(serializers.ModelSerializer):
    variant               = ProductVariantSerializer(read_only=True)
    coffret_configuration = CoffretConfigurationSummarySerializer(read_only=True)
    subtotal              = serializers.ReadOnlyField()
    product_image          = serializers.SerializerMethodField()

    class Meta:
        model  = OrderItem
        fields = ('id', 'variant', 'coffret_configuration', 'product_name', 'product_image', 'quantity',
                  'unit_price', 'subtotal', 'gift_wrap', 'gift_message', 'engraving_text')

    def get_product_image(self, obj):
        return _item_image(obj)


class OrderStatusHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model  = OrderStatusHistory
        fields = ('status', 'note', 'created_at')


class OrderSerializer(serializers.ModelSerializer):
    items          = OrderItemSerializer(many=True, read_only=True)
    status_history = OrderStatusHistorySerializer(many=True, read_only=True)
    address        = AddressSerializer(read_only=True)
    delivery_zone  = DeliveryZoneSerializer(read_only=True)
    contact_email  = serializers.ReadOnlyField()

    class Meta:
        model  = Order
        fields = ('id', 'order_number', 'status', 'delivery_method', 'address', 'delivery_zone', 'contact_email',
                  'subtotal', 'shipping_cost', 'gift_card_amount', 'loyalty_points_used', 'loyalty_discount_amount',
                  'total', 'items', 'status_history', 'created_at')


# ── Cartes cadeaux ────────────────────────────────────────────────────────────
class GiftCardSerializer(serializers.ModelSerializer):
    class Meta:
        model  = GiftCard
        fields = ('id', 'code', 'initial_value', 'balance', 'recipient_name', 'status', 'created_at')


class GiftCardCheckSerializer(serializers.ModelSerializer):
    class Meta:
        model  = GiftCard
        fields = ('code', 'balance', 'status')


class LoyaltyTransactionSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source='order.order_number', read_only=True)

    class Meta:
        model  = LoyaltyTransaction
        fields = ('id', 'points', 'reason', 'note', 'order_number', 'created_at')


class GiftCardAdminSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source='purchase_order.order_number', read_only=True)

    class Meta:
        model  = GiftCard
        fields = ('id', 'code', 'order_number', 'initial_value', 'balance', 'purchaser_name', 'purchaser_email',
                  'recipient_name', 'recipient_email', 'message', 'status', 'created_at')
