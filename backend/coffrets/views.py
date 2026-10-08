from django.core.exceptions import ValidationError
from django.db import transaction
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from catalog.models import ProductVariant
from .models import Coffret, CoffretConfiguration, CoffretConfigurationItem
from .serializers import CoffretSerializer, CoffretConfigurationSerializer


MAX_ENTRIES = 30
MAX_QUANTITY = 20


def _clean_entries(raw):
    """Normalise une liste de {variant, slot?, quantity} venue du client ; retourne None si le format est invalide."""
    if not isinstance(raw, list) or len(raw) > MAX_ENTRIES:
        return None
    cleaned = []
    for entry in raw:
        if not isinstance(entry, dict):
            return None
        try:
            quantity = int(entry.get('quantity', 1))
        except (TypeError, ValueError):
            return None
        if not 1 <= quantity <= MAX_QUANTITY:
            return None
        cleaned.append({'variant': entry.get('variant'), 'slot': entry.get('slot'), 'quantity': quantity})
    return cleaned


@api_view(['GET'])
@permission_classes([AllowAny])
def coffrets_list(request):
    qs = Coffret.objects.filter(is_active=True).prefetch_related('slots', 'included_items')
    return Response(CoffretSerializer(qs, many=True, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([AllowAny])
def coffret_detail(request, slug):
    try:
        coffret = Coffret.objects.prefetch_related('slots', 'included_items').get(slug=slug, is_active=True)
    except Coffret.DoesNotExist:
        return Response({'error': 'Coffret introuvable.'}, status=status.HTTP_404_NOT_FOUND)
    return Response(CoffretSerializer(coffret, context={'request': request}).data)


# ── Configuration d'un coffret par le client ─────────────────────────────────
@api_view(['POST'])
@permission_classes([AllowAny])
def coffret_configure(request):
    coffret_id     = request.data.get('coffret')
    selections     = _clean_entries(request.data.get('selections', []))
    extra_items    = _clean_entries(request.data.get('extra_items', []))
    removed_ids    = request.data.get('removed_item_ids', [])

    if selections is None or extra_items is None or not isinstance(removed_ids, list) or len(removed_ids) > MAX_ENTRIES:
        return Response({'error': 'Configuration invalide.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        coffret = Coffret.objects.get(id=coffret_id, is_active=True)
    except (Coffret.DoesNotExist, ValueError, TypeError, ValidationError):
        return Response({'error': 'Coffret introuvable.'}, status=status.HTTP_404_NOT_FOUND)

    if not coffret.allow_customization and (removed_ids or extra_items):
        return Response(
            {'error': 'Ce coffret ne peut pas être personnalisé.'}, status=status.HTTP_400_BAD_REQUEST,
        )

    slots = {str(s.id): s for s in coffret.slots.all()}

    # ── Validation des emplacements (min/max, catégorie autorisée) ──────────
    for slot in slots.values():
        chosen = [s for s in selections if s.get('slot') == str(slot.id)]
        total_qty = sum(s['quantity'] for s in chosen)
        if total_qty < slot.min_select or total_qty > slot.max_select:
            return Response(
                {'error': f"L'emplacement « {slot.label} » nécessite entre {slot.min_select} et {slot.max_select} article(s)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        for s in chosen:
            try:
                variant = ProductVariant.objects.select_related('product').get(id=s.get('variant'), product__is_active=True)
            except (ProductVariant.DoesNotExist, ValueError, TypeError, ValidationError):
                return Response({'error': 'Variante introuvable.'}, status=status.HTTP_400_BAD_REQUEST)
            if slot.allowed_category_id and variant.product.category_id != slot.allowed_category_id:
                return Response(
                    {'error': f"Cette variante ne correspond pas à l'emplacement « {slot.label} »."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

    # ── Validation des éléments retirés (doivent appartenir au coffret) ─────
    valid_included_ids = set(str(i.id) for i in coffret.included_items.all())
    for rid in removed_ids:
        if str(rid) not in valid_included_ids:
            return Response({'error': 'Élément inclus introuvable pour ce coffret.'}, status=status.HTTP_400_BAD_REQUEST)

    # ── Validation des ajouts libres ─────────────────────────────────────────
    for extra in extra_items:
        try:
            ProductVariant.objects.get(id=extra.get('variant'), product__is_active=True)
        except (ProductVariant.DoesNotExist, ValueError, TypeError, ValidationError):
            return Response({'error': 'Variante introuvable pour un article ajouté.'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        configuration = CoffretConfiguration.objects.create(coffret=coffret)
        if removed_ids:
            configuration.removed_items.set(removed_ids)

        for s in selections:
            slot = slots.get(s.get('slot'))
            if not slot:
                continue
            variant = ProductVariant.objects.get(id=s.get('variant'))
            CoffretConfigurationItem.objects.create(
                configuration=configuration, slot=slot, variant=variant, quantity=s['quantity'],
            )

        for extra in extra_items:
            variant = ProductVariant.objects.get(id=extra.get('variant'))
            CoffretConfigurationItem.objects.create(
                configuration=configuration, slot=None, variant=variant, quantity=extra['quantity'],
            )

    return Response(
        CoffretConfigurationSerializer(configuration, context={'request': request}).data,
        status=status.HTTP_201_CREATED,
    )
