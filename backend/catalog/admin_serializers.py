from rest_framework import serializers

from common.uploads import ValidatedImagesMixin

from .models import Category, Collection, LookbookEntry, Product, ProductImage, ProductVariant, SymbolGuideEntry, WaitlistEntry


class CategoryAdminSerializer(ValidatedImagesMixin, serializers.ModelSerializer):
    class Meta:
        model  = Category
        fields = ('id', 'name', 'slug', 'parent', 'image', 'order')
        extra_kwargs = {'slug': {'required': False}}


class CollectionAdminSerializer(ValidatedImagesMixin, serializers.ModelSerializer):
    class Meta:
        model  = Collection
        fields = ('id', 'kind', 'name', 'slug', 'description', 'image', 'order')
        extra_kwargs = {'slug': {'required': False}}


class ProductVariantAdminSerializer(ValidatedImagesMixin, serializers.ModelSerializer):
    label            = serializers.ReadOnlyField()
    discount_percent = serializers.ReadOnlyField()

    class Meta:
        model  = ProductVariant
        fields = ('id', 'product', 'sku', 'color', 'size', 'material', 'price', 'old_price',
                  'stock', 'image', 'is_default', 'label', 'discount_percent',
                  'allow_preorder', 'restock_note')
        extra_kwargs = {'product': {'required': False}, 'sku': {'required': False}}

    def validate_price(self, value):
        if value < 0 or value > 100_000_000:
            raise serializers.ValidationError('Le prix doit être compris entre 0 et 100 000 000 FCFA.')
        return value

    def _single_default(self, variant):
        # Une seule variante « par défaut » par produit (celle dont le prix et la photo s'affichent en premier)
        siblings = ProductVariant.objects.filter(product=variant.product).exclude(pk=variant.pk)
        if variant.is_default:
            siblings.update(is_default=False)
        elif not siblings.filter(is_default=True).exists():
            ProductVariant.objects.filter(pk=variant.pk).update(is_default=True)
            variant.is_default = True

    def create(self, validated_data):
        variant = super().create(validated_data)
        self._single_default(variant)
        return variant

    def update(self, instance, validated_data):
        variant = super().update(instance, validated_data)
        self._single_default(variant)
        return variant


class ProductImageAdminSerializer(ValidatedImagesMixin, serializers.ModelSerializer):
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


class SymbolGuideAdminSerializer(ValidatedImagesMixin, serializers.ModelSerializer):
    class Meta:
        model  = SymbolGuideEntry
        fields = ('id', 'name', 'slug', 'image', 'subtitle', 'meaning', 'category', 'order', 'is_active')
        extra_kwargs = {'slug': {'required': False}}


class LookbookEntryAdminSerializer(ValidatedImagesMixin, serializers.ModelSerializer):
    class Meta:
        model  = LookbookEntry
        fields = ('id', 'title', 'image', 'description', 'products', 'order', 'is_active', 'created_at')


class WaitlistEntryAdminSerializer(serializers.ModelSerializer):
    product_name  = serializers.CharField(source='variant.product.name', read_only=True)
    variant_label = serializers.CharField(source='variant.label', read_only=True)

    class Meta:
        model  = WaitlistEntry
        fields = ('id', 'variant', 'product_name', 'variant_label', 'email', 'name', 'notified', 'created_at')
