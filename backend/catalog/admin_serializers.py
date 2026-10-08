from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from common.uploads import ValidatedImagesMixin

from .engraving import validate_zone
from .models import Category, Collection, LookbookEntry, Product, ProductImage, ProductVariant, SymbolGuideEntry, WaitlistEntry


class EngravingZoneMixin:
    """Valide la zone d'aperçu de gravure (voir catalog/engraving.py) : jamais de JSON libre enregistré tel quel."""

    def validate_engraving_zone(self, value):
        try:
            return validate_zone(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages[0])


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


class ProductVariantAdminSerializer(EngravingZoneMixin, ValidatedImagesMixin, serializers.ModelSerializer):
    label            = serializers.ReadOnlyField()
    discount_percent = serializers.ReadOnlyField()

    class Meta:
        model  = ProductVariant
        fields = ('id', 'product', 'sku', 'color', 'size', 'material', 'price', 'old_price',
                  'stock', 'image', 'is_default', 'label', 'discount_percent',
                  'allow_preorder', 'restock_note', 'engraving_zone')
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


class ProductImageAdminSerializer(EngravingZoneMixin, ValidatedImagesMixin, serializers.ModelSerializer):
    class Meta:
        model  = ProductImage
        fields = ('id', 'product', 'image', 'is_main', 'order', 'engraving_zone')
        extra_kwargs = {'product': {'required': False}}


class ProductAdminSerializer(serializers.ModelSerializer):
    variants = ProductVariantAdminSerializer(many=True, read_only=True)
    images   = ProductImageAdminSerializer(many=True, read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        model  = Product
        fields = ('id', 'name', 'slug', 'description', 'symbolic_meaning', 'category', 'category_name',
                  'collections', 'is_active', 'is_new', 'is_personalizable', 'engraving_max_chars', 'created_at', 'variants', 'images')
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
    product_slug  = serializers.CharField(source='variant.product.slug', read_only=True)
    variant_label = serializers.CharField(source='variant.label', read_only=True)
    in_stock      = serializers.SerializerMethodField()
    has_push      = serializers.SerializerMethodField()

    class Meta:
        model  = WaitlistEntry
        fields = ('id', 'variant', 'product_name', 'product_slug', 'variant_label', 'email', 'phone', 'name', 'notified', 'push_notified',
                  'contacted', 'contacted_at', 'in_stock', 'has_push', 'created_at')
        read_only_fields = ('variant', 'email', 'phone', 'name', 'notified', 'push_notified', 'contacted_at')

    def get_in_stock(self, entry):
        return entry.variant.stock > 0

    def get_has_push(self, entry):
        return entry.push_subscription_id is not None
