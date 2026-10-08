from rest_framework import serializers

from .models import Category, Collection, LookbookEntry, Product, ProductImage, ProductVariant, SymbolGuideEntry, WaitlistEntry


class CategoryAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Category
        fields = ('id', 'name', 'slug', 'parent', 'image', 'order')
        extra_kwargs = {'slug': {'required': False}}


class CollectionAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Collection
        fields = ('id', 'kind', 'name', 'slug', 'description', 'image', 'order')
        extra_kwargs = {'slug': {'required': False}}


class ProductVariantAdminSerializer(serializers.ModelSerializer):
    label            = serializers.ReadOnlyField()
    discount_percent = serializers.ReadOnlyField()

    class Meta:
        model  = ProductVariant
        fields = ('id', 'product', 'sku', 'color', 'size', 'material', 'price', 'old_price',
                  'stock', 'image', 'is_default', 'label', 'discount_percent',
                  'allow_preorder', 'restock_note')
        extra_kwargs = {'product': {'required': False}, 'sku': {'required': False}}


class ProductImageAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ProductImage
        fields = ('id', 'product', 'image', 'is_main', 'order')
        extra_kwargs = {'product': {'required': False}}


class ProductAdminSerializer(serializers.ModelSerializer):
    variants = ProductVariantAdminSerializer(many=True, read_only=True)
    images   = ProductImageAdminSerializer(many=True, read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        model  = Product
        fields = ('id', 'name', 'slug', 'description', 'symbolic_meaning', 'category', 'category_name',
                  'collections', 'is_active', 'is_new', 'is_personalizable', 'created_at', 'variants', 'images')
        extra_kwargs = {'slug': {'required': False}}


class SymbolGuideAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model  = SymbolGuideEntry
        fields = ('id', 'name', 'slug', 'image', 'subtitle', 'meaning', 'category', 'order', 'is_active')
        extra_kwargs = {'slug': {'required': False}}


class LookbookEntryAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model  = LookbookEntry
        fields = ('id', 'title', 'image', 'description', 'products', 'order', 'is_active', 'created_at')


class WaitlistEntryAdminSerializer(serializers.ModelSerializer):
    product_name  = serializers.CharField(source='variant.product.name', read_only=True)
    variant_label = serializers.CharField(source='variant.label', read_only=True)

    class Meta:
        model  = WaitlistEntry
        fields = ('id', 'variant', 'product_name', 'variant_label', 'email', 'name', 'notified', 'created_at')
