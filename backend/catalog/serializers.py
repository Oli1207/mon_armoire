from django.conf import settings
from rest_framework import serializers

from .models import Category, Collection, LookbookEntry, Product, ProductImage, ProductVariant, SymbolGuideEntry, WaitlistEntry


class CategorySerializer(serializers.ModelSerializer):
    cover_image = serializers.SerializerMethodField()

    class Meta:
        model  = Category
        fields = ('id', 'name', 'slug', 'parent', 'image', 'order', 'cover_image')

    def get_cover_image(self, obj):
        """Photo de couverture : image de la catégorie, sinon celle d'un de ses produits (annotation `cover_path`)."""
        if obj.image:
            return obj.image.url
        path = getattr(obj, 'cover_path', None)
        return f'{settings.MEDIA_URL}{path}' if path else None


class CollectionSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Collection
        fields = ('id', 'kind', 'name', 'slug', 'description', 'image')


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ProductImage
        fields = ('id', 'image', 'thumbnail', 'is_main', 'order')


class ProductVariantSerializer(serializers.ModelSerializer):
    label            = serializers.ReadOnlyField()
    discount_percent = serializers.ReadOnlyField()

    class Meta:
        model  = ProductVariant
        fields = ('id', 'sku', 'color', 'size', 'material', 'price', 'old_price',
                  'discount_percent', 'stock', 'image', 'label', 'is_default',
                  'allow_preorder', 'restock_note')


# ── Liste (fiche allégée pour le catalogue) ──────────────────────────────────
class ProductListSerializer(serializers.ModelSerializer):
    price              = serializers.ReadOnlyField()
    main_image         = serializers.SerializerMethodField()  # miniature : les listes affichent des cartes
    is_in_stock        = serializers.ReadOnlyField()
    category           = CategorySerializer(read_only=True)
    default_variant_id = serializers.SerializerMethodField()
    rating_average     = serializers.SerializerMethodField()
    rating_count       = serializers.SerializerMethodField()

    class Meta:
        model  = Product
        fields = ('id', 'name', 'slug', 'category', 'is_new', 'price', 'main_image', 'is_in_stock',
                  'is_personalizable', 'default_variant_id', 'rating_average', 'rating_count')

    def get_default_variant_id(self, obj):
        variant = obj.default_variant
        return variant.id if variant else None

    def get_main_image(self, obj):
        return obj.main_thumbnail

    # Renseignés par l'annotation de la liste du catalogue ; absents (None / 0) ailleurs (favoris, suggestions…)
    def get_rating_average(self, obj):
        value = getattr(obj, 'rating_average', None)
        return round(float(value), 1) if value else None

    def get_rating_count(self, obj):
        return getattr(obj, 'rating_count', 0) or 0


# ── Détail (fiche complète) ───────────────────────────────────────────────────
class ProductDetailSerializer(serializers.ModelSerializer):
    category    = CategorySerializer(read_only=True)
    collections = CollectionSerializer(many=True, read_only=True)
    images      = ProductImageSerializer(many=True, read_only=True)
    variants    = ProductVariantSerializer(many=True, read_only=True)

    class Meta:
        model  = Product
        fields = ('id', 'name', 'slug', 'description', 'symbolic_meaning', 'category',
                  'collections', 'images', 'variants', 'is_new', 'is_personalizable', 'created_at')


# ── Guide des symboles ────────────────────────────────────────────────────────
class SymbolGuideSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)

    class Meta:
        model  = SymbolGuideEntry
        fields = ('id', 'name', 'slug', 'image', 'subtitle', 'meaning', 'category', 'order')


# ── Lookbook / galerie ────────────────────────────────────────────────────────
class LookbookProductSerializer(serializers.ModelSerializer):
    price              = serializers.ReadOnlyField()
    main_image         = serializers.SerializerMethodField()
    default_variant_id = serializers.SerializerMethodField()

    class Meta:
        model  = Product
        fields = ('id', 'name', 'slug', 'price', 'main_image', 'default_variant_id')

    def get_default_variant_id(self, obj):
        variant = obj.default_variant
        return variant.id if variant else None

    def get_main_image(self, obj):
        return obj.main_thumbnail


class LookbookEntrySerializer(serializers.ModelSerializer):
    products = LookbookProductSerializer(many=True, read_only=True)

    class Meta:
        model  = LookbookEntry
        fields = ('id', 'title', 'image', 'description', 'products', 'order')


# ── Liste d'attente ────────────────────────────────────────────────────────────
class WaitlistEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model  = WaitlistEntry
        fields = ('id', 'variant', 'email', 'name')
