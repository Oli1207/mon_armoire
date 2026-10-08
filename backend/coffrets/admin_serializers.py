from rest_framework import serializers

from common.uploads import ValidatedImagesMixin

from catalog.models import ProductVariant
from catalog.serializers import ProductVariantSerializer
from .models import Coffret, CoffretItem, CoffretSlot


class CoffretSlotAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model  = CoffretSlot
        fields = ('id', 'coffret', 'label', 'allowed_category', 'min_select', 'max_select', 'order')
        extra_kwargs = {'coffret': {'required': False}}


class CoffretItemAdminSerializer(serializers.ModelSerializer):
    variant      = ProductVariantSerializer(read_only=True)
    variant_id   = serializers.PrimaryKeyRelatedField(source='variant', write_only=True, queryset=ProductVariant.objects.all())
    product_name = serializers.CharField(source='variant.product.name', read_only=True)

    class Meta:
        model  = CoffretItem
        fields = ('id', 'coffret', 'variant', 'variant_id', 'product_name', 'quantity', 'order')
        extra_kwargs = {'coffret': {'required': False}}


class CoffretAdminSerializer(ValidatedImagesMixin, serializers.ModelSerializer):
    slots          = CoffretSlotAdminSerializer(many=True, read_only=True)
    included_items = CoffretItemAdminSerializer(many=True, read_only=True)
    starting_price = serializers.ReadOnlyField()

    class Meta:
        model  = Coffret
        fields = ('id', 'name', 'slug', 'description', 'image', 'box_price', 'starting_price', 'is_active', 'created_at',
                  'show_contents', 'show_item_prices', 'allow_customization', 'slots', 'included_items')
        extra_kwargs = {'slug': {'required': False}}
