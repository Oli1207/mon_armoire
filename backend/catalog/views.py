from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db.models import CharField, OuterRef, Subquery, Value
from django.db.models.functions import Coalesce, NullIf
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from common.http import public_cache
from common.pagination import paginate
from common.throttles import SignupThrottle
from .models import Category, Collection, LookbookEntry, Product, ProductImage, ProductVariant, SymbolGuideEntry, WaitlistEntry
from .search import smart_search
from .serializers import (
    CategorySerializer,
    CollectionSerializer,
    ProductListSerializer,
    ProductDetailSerializer,
    SymbolGuideSerializer,
    LookbookEntrySerializer,
    WaitlistEntrySerializer,
)


# ── Catégories ────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([AllowAny])
@public_cache(300)
def categories_list(request):
    # `cover_path` : photo du produit mis en avant de la catégorie, en une seule requête (tuiles de l'accueil)
    cover = (
        ProductImage.objects.filter(product__category=OuterRef('pk'), product__is_active=True)
        .order_by('-is_main', 'order').annotate(path=Coalesce(NullIf('thumbnail', Value('')), 'image', output_field=CharField())).values('path')[:1]
    )
    qs = Category.objects.filter(parent__isnull=True).annotate(cover_path=Subquery(cover))
    serializer = CategorySerializer(qs, many=True, context={'request': request})
    return Response(serializer.data)


# ── Collections (style / occasion) ───────────────────────────────────────────
@api_view(['GET'])
@permission_classes([AllowAny])
@public_cache(300)
def collections_list(request):
    kind = request.query_params.get('kind')
    qs = Collection.objects.all()
    if kind:
        qs = qs.filter(kind=kind)
    serializer = CollectionSerializer(qs, many=True, context={'request': request})
    return Response(serializer.data)


# ── Produits ──────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([AllowAny])
@public_cache(60)
def products_list(request):
    qs = Product.objects.filter(is_active=True).select_related('category').prefetch_related('variants', 'images')

    category   = request.query_params.get('category')
    collection = request.query_params.get('collection')
    is_new     = request.query_params.get('is_new')
    search     = (request.query_params.get('search') or '').strip()[:100]
    max_price  = request.query_params.get('max_price')

    if category:
        qs = qs.filter(category__slug=category)
    if collection:
        qs = qs.filter(collections__slug=collection)
    if is_new == '1':
        qs = qs.filter(is_new=True)
    if max_price:
        try:
            qs = qs.filter(variants__price__lte=Decimal(max_price))
        except (InvalidOperation, ValueError):
            return Response({'error': 'Prix maximum invalide.'}, status=status.HTTP_400_BAD_REQUEST)

    if search:
        qs = smart_search(qs, search)

    # distinct() : un produit ne doit apparaître qu'une fois malgré les jointures (collections, variantes)
    return paginate(request, qs.distinct(), ProductListSerializer, context={'request': request})


@api_view(['GET'])
@permission_classes([AllowAny])
def search_suggest(request):
    term = (request.query_params.get('q') or '').strip()[:100]
    if len(term) < 2:
        return Response([])

    qs = Product.objects.filter(is_active=True).select_related('category').prefetch_related('variants', 'images')
    qs = smart_search(qs, term).distinct()[:6]
    serializer = ProductListSerializer(qs, many=True, context={'request': request})
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([AllowAny])
@public_cache(60)
def product_detail(request, slug):
    try:
        product = Product.objects.select_related('category').prefetch_related(
            'collections', 'images', 'variants'
        ).get(slug=slug, is_active=True)
    except Product.DoesNotExist:
        return Response({'error': 'Produit introuvable.'}, status=status.HTTP_404_NOT_FOUND)
    serializer = ProductDetailSerializer(product, context={'request': request})
    return Response(serializer.data)


# ── Guide des symboles ────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([AllowAny])
@public_cache(300)
def symbol_guide_list(request):
    qs = SymbolGuideEntry.objects.filter(is_active=True).select_related('category')
    return Response(SymbolGuideSerializer(qs, many=True, context={'request': request}).data)


# ── Lookbook / galerie ────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([AllowAny])
@public_cache(300)
def lookbook_list(request):
    qs = LookbookEntry.objects.filter(is_active=True).prefetch_related('products', 'products__variants', 'products__images')
    return Response(LookbookEntrySerializer(qs, many=True, context={'request': request}).data)


# ── Liste d'attente (produit en rupture) ──────────────────────────────────────
@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([SignupThrottle])
def waitlist_join(request):
    variant_id = request.data.get('variant')
    email      = str(request.data.get('email') or '').strip().lower()
    name       = str(request.data.get('name') or '').strip()[:200]

    if not variant_id or not email:
        return Response({'error': 'Variante et email requis.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        validate_email(email)
    except ValidationError:
        return Response({'error': 'Adresse e-mail invalide.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        variant = ProductVariant.objects.get(id=variant_id, product__is_active=True)
    except (ProductVariant.DoesNotExist, ValueError, ValidationError):
        return Response({'error': 'Variante introuvable.'}, status=status.HTTP_404_NOT_FOUND)

    entry, created = WaitlistEntry.objects.get_or_create(variant=variant, email=email, defaults={'name': name})
    return Response(WaitlistEntrySerializer(entry).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
