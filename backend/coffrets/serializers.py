from rest_framework import serializers

from catalog.models import ProductVariant
from catalog.serializers import ProductVariantSerializer, CategorySerializer
from .models import Coffret, CoffretItem, CoffretSlot, CoffretConfiguration, CoffretConfigurationItem


class CoffretSlotSerializer(serializers.ModelSerializer):
    allowed_category  = CategorySerializer(read_only=True)
    eligible_variants  = serializers.SerializerMethodField()

    class Meta:
        model  = CoffretSlot
        fields = ('id', 'label', 'allowed_category', 'min_select', 'max_select', 'order', 'eligible_variants')

    def get_eligible_variants(self, obj):
        qs = ProductVariant.objects.filter(stock__gt=0, product__is_active=True).select_related('product').prefetch_related('product__images')
        if obj.allowed_category_id:
            qs = qs.filter(product__category_id=obj.allowed_category_id)
        variants = list(qs[:200])
        data = ProductVariantSerializer(variants, many=True).data
        for row, variant in zip(data, variants):
            row['product_name'] = variant.product.name
            row['product_image'] = _variant_image(variant)
        return data


def _variant_image(variant):
    if variant.image:
        return variant.image.url
    return variant.product.main_thumbnail


class CoffretItemSerializer(serializers.ModelSerializer):
    variant       = ProductVariantSerializer(read_only=True)
    product_name  = serializers.CharField(source='variant.product.name', read_only=True)
    product_image = serializers.SerializerMethodField()

    class Meta:
        model  = CoffretItem
        fields = ('id', 'variant', 'product_name', 'product_image', 'quantity', 'order')

    def get_product_image(self, obj):
        return _variant_image(obj.variant)


class CoffretSerializer(serializers.ModelSerializer):
    slots          = CoffretSlotSerializer(many=True, read_only=True)
    included_items = CoffretItemSerializer(many=True, read_only=True)
    starting_price = serializers.ReadOnlyField()

    class Meta:
        model  = Coffret
        fields = ('id', 'name', 'slug', 'description', 'image', 'box_price', 'starting_price',
                  'show_contents', 'show_item_prices', 'allow_customization', 'included_items', 'slots')


class CoffretConfigurationItemSerializer(serializers.ModelSerializer):
    variant       = ProductVariantSerializer(read_only=True)
    product_name  = serializers.CharField(source='variant.product.name', read_only=True)
    product_image = serializers.SerializerMethodField()

    class Meta:
        model  = CoffretConfigurationItem
        fields = ('id', 'slot', 'variant', 'product_name', 'product_image', 'quantity')

    def get_product_image(self, obj):
        return _variant_image(obj.variant)


class CoffretConfigurationSerializer(serializers.ModelSerializer):
    items              = CoffretConfigurationItemSerializer(many=True, read_only=True)
    coffret            = CoffretSerializer(read_only=True)
    kept_included_items = CoffretItemSerializer(many=True, read_only=True)
    removed_items       = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    total_price         = serializers.ReadOnlyField()

    class Meta:
        model  = CoffretConfiguration
        fields = ('id', 'coffret', 'items', 'kept_included_items', 'removed_items', 'total_price', 'created_at')


# ── Résumé léger (paniers, commandes) : évite de re-sérialiser tout le coffret et ses emplacements ──
class CoffretLineSerializer(serializers.Serializer):
    id            = serializers.UUIDField()
    product_name  = serializers.SerializerMethodField()
    product_image = serializers.SerializerMethodField()
    quantity      = serializers.IntegerField()

    def get_product_name(self, obj):
        return obj.variant.product.name

    def get_product_image(self, obj):
        return _variant_image(obj.variant)


class CoffretConfigurationSummarySerializer(serializers.ModelSerializer):
    coffret             = serializers.SerializerMethodField()
    items               = CoffretLineSerializer(many=True, read_only=True)
    kept_included_items = CoffretLineSerializer(many=True, read_only=True)
    total_price         = serializers.ReadOnlyField()

    class Meta:
        model  = CoffretConfiguration
        fields = ('id', 'coffret', 'items', 'kept_included_items', 'total_price')

    def get_coffret(self, obj):
        image = obj.coffret.image
        return {'id': obj.coffret_id, 'name': obj.coffret.name, 'slug': obj.coffret.slug, 'image': image.url if image else None}
