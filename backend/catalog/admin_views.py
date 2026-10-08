from django.db import transaction
from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from common.pagination import AdminPagination, paginate
from .models import Category, Collection, LookbookEntry, Product, ProductImage, ProductVariant, SymbolGuideEntry, WaitlistEntry
from .admin_serializers import (
    CategoryAdminSerializer, CollectionAdminSerializer, ProductAdminSerializer,
    ProductVariantAdminSerializer, ProductImageAdminSerializer,
    SymbolGuideAdminSerializer, LookbookEntryAdminSerializer, WaitlistEntryAdminSerializer,
)

from common.admin_crud import list_create as _list_create, update_delete as _update_delete


# ── Catégories ────────────────────────────────────────────────────────────────
@api_view(['GET', 'POST'])
@permission_classes([IsAdminUser])
def admin_categories(request):
    return _list_create(request, Category.objects.all().order_by('order', 'name'), CategoryAdminSerializer)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAdminUser])
def admin_category_detail(request, pk):
    try:
        obj = Category.objects.get(pk=pk)
    except (Category.DoesNotExist, ValueError):
        return Response({'error': 'Catégorie introuvable.'}, status=status.HTTP_404_NOT_FOUND)
    return _update_delete(request, obj, CategoryAdminSerializer)


# ── Collections ───────────────────────────────────────────────────────────────
@api_view(['GET', 'POST'])
@permission_classes([IsAdminUser])
def admin_collections(request):
    return _list_create(request, Collection.objects.all().order_by('kind', 'order'), CollectionAdminSerializer)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAdminUser])
def admin_collection_detail(request, pk):
    try:
        obj = Collection.objects.get(pk=pk)
    except (Collection.DoesNotExist, ValueError):
        return Response({'error': 'Collection introuvable.'}, status=status.HTTP_404_NOT_FOUND)
    return _update_delete(request, obj, CollectionAdminSerializer)


# ── Produits ──────────────────────────────────────────────────────────────────
@api_view(['GET', 'POST'])
@permission_classes([IsAdminUser])
def admin_products(request):
    qs = Product.objects.select_related('category').prefetch_related('variants', 'images', 'collections').order_by('-created_at', 'id')
    if request.method == 'GET':
        search = (request.query_params.get('search') or '').strip()[:100]
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(category__name__icontains=search))
        return paginate(request, qs, ProductAdminSerializer, pagination=AdminPagination)
    return _list_create(request, qs, ProductAdminSerializer)


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_product_options(request):
    """Liste compacte (id + nom) de tous les produits pour les menus de choix (lookbook)."""
    return Response(list(Product.objects.order_by('name').values('id', 'name')[:2000]))


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_variant_options(request):
    """Liste compacte de toutes les variantes (id + libellé) pour les menus de choix du back-office (coffrets)."""
    variants = ProductVariant.objects.select_related('product').order_by('product__name', 'id')[:2000]
    return Response([
        {'id': v.id, 'label': f'{v.product.name} — {v.label}', 'price': v.price, 'category': v.product.category_id}
        for v in variants
    ])


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAdminUser])
def admin_product_detail(request, pk):
    try:
        obj = Product.objects.get(pk=pk)
    except (Product.DoesNotExist, ValueError):
        return Response({'error': 'Produit introuvable.'}, status=status.HTTP_404_NOT_FOUND)
    if request.method == 'GET':
        return Response(ProductAdminSerializer(obj).data)
    return _update_delete(request, obj, ProductAdminSerializer)


# ── Variantes ─────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAdminUser])
def admin_variant_create(request, product_id):
    try:
        product = Product.objects.get(pk=product_id)
    except (Product.DoesNotExist, ValueError):
        return Response({'error': 'Produit introuvable.'}, status=status.HTTP_404_NOT_FOUND)
    serializer = ProductVariantAdminSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(product=product)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAdminUser])
def admin_variant_detail(request, pk):
    try:
        obj = ProductVariant.objects.get(pk=pk)
    except (ProductVariant.DoesNotExist, ValueError):
        return Response({'error': 'Variante introuvable.'}, status=status.HTTP_404_NOT_FOUND)

    # Les e-mails « de retour en stock » partent par la tâche planifiée `send_restock_notifications`
    return _update_delete(request, obj, ProductVariantAdminSerializer)


# ── Images ────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAdminUser])
def admin_image_create(request, product_id):
    try:
        product = Product.objects.get(pk=product_id)
    except (Product.DoesNotExist, ValueError):
        return Response({'error': 'Produit introuvable.'}, status=status.HTTP_404_NOT_FOUND)
    serializer = ProductImageAdminSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(product=product)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAdminUser])
def admin_image_delete(request, pk):
    try:
        obj = ProductImage.objects.get(pk=pk)
    except (ProductImage.DoesNotExist, ValueError):
        return Response({'error': 'Image introuvable.'}, status=status.HTTP_404_NOT_FOUND)
    if request.method == 'PATCH':
        # Une seule photo principale par produit
        with transaction.atomic():
            if request.data.get('is_main') in (True, 'true', 'True', '1', 1):
                ProductImage.objects.filter(product=obj.product).exclude(pk=obj.pk).update(is_main=False)
                obj.is_main = True
                obj.save(update_fields=['is_main'])
        return Response(ProductImageAdminSerializer(obj, context={'request': request}).data)
    obj.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ── Guide des symboles ────────────────────────────────────────────────────────
@api_view(['GET', 'POST'])
@permission_classes([IsAdminUser])
def admin_symbols(request):
    return _list_create(request, SymbolGuideEntry.objects.select_related('category').order_by('order', 'name'), SymbolGuideAdminSerializer)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAdminUser])
def admin_symbol_detail(request, pk):
    try:
        obj = SymbolGuideEntry.objects.get(pk=pk)
    except (SymbolGuideEntry.DoesNotExist, ValueError):
        return Response({'error': 'Symbole introuvable.'}, status=status.HTTP_404_NOT_FOUND)
    return _update_delete(request, obj, SymbolGuideAdminSerializer)


# ── Lookbook / galerie ────────────────────────────────────────────────────────
@api_view(['GET', 'POST'])
@permission_classes([IsAdminUser])
def admin_lookbook(request):
    return _list_create(request, LookbookEntry.objects.prefetch_related('products').order_by('order', '-created_at'), LookbookEntryAdminSerializer)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAdminUser])
def admin_lookbook_detail(request, pk):
    try:
        obj = LookbookEntry.objects.get(pk=pk)
    except (LookbookEntry.DoesNotExist, ValueError):
        return Response({'error': 'Entrée introuvable.'}, status=status.HTTP_404_NOT_FOUND)
    return _update_delete(request, obj, LookbookEntryAdminSerializer)


# ── Liste d'attente ────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_waitlist(request):
    qs = WaitlistEntry.objects.select_related('variant__product').order_by('-created_at', 'id')
    search = (request.query_params.get('search') or '').strip()[:100]
    if search:
        qs = qs.filter(Q(email__icontains=search) | Q(variant__product__name__icontains=search))
    return paginate(request, qs, WaitlistEntryAdminSerializer, pagination=AdminPagination)
