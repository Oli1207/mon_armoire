from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from .models import Coffret, CoffretItem, CoffretSlot
from .admin_serializers import CoffretAdminSerializer, CoffretItemAdminSerializer, CoffretSlotAdminSerializer


def _list_create(request, queryset, serializer_class):
    if request.method == 'GET':
        return Response(serializer_class(queryset, many=True).data)
    serializer = serializer_class(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


def _update_delete(request, instance, serializer_class):
    if request.method == 'PATCH':
        serializer = serializer_class(instance, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    instance.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET', 'POST'])
@permission_classes([IsAdminUser])
def admin_coffrets(request):
    qs = Coffret.objects.prefetch_related('slots', 'included_items').order_by('-created_at')
    return _list_create(request, qs, CoffretAdminSerializer)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAdminUser])
def admin_coffret_detail(request, pk):
    try:
        obj = Coffret.objects.get(pk=pk)
    except (Coffret.DoesNotExist, ValueError):
        return Response({'error': 'Coffret introuvable.'}, status=status.HTTP_404_NOT_FOUND)
    if request.method == 'GET':
        return Response(CoffretAdminSerializer(obj).data)
    return _update_delete(request, obj, CoffretAdminSerializer)


@api_view(['POST'])
@permission_classes([IsAdminUser])
def admin_slot_create(request, coffret_id):
    try:
        coffret = Coffret.objects.get(pk=coffret_id)
    except (Coffret.DoesNotExist, ValueError):
        return Response({'error': 'Coffret introuvable.'}, status=status.HTTP_404_NOT_FOUND)
    serializer = CoffretSlotAdminSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(coffret=coffret)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAdminUser])
def admin_slot_detail(request, pk):
    try:
        obj = CoffretSlot.objects.get(pk=pk)
    except (CoffretSlot.DoesNotExist, ValueError):
        return Response({'error': 'Emplacement introuvable.'}, status=status.HTTP_404_NOT_FOUND)
    return _update_delete(request, obj, CoffretSlotAdminSerializer)


# ── Éléments inclus par défaut ────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAdminUser])
def admin_coffret_item_create(request, coffret_id):
    try:
        coffret = Coffret.objects.get(pk=coffret_id)
    except (Coffret.DoesNotExist, ValueError):
        return Response({'error': 'Coffret introuvable.'}, status=status.HTTP_404_NOT_FOUND)
    serializer = CoffretItemAdminSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(coffret=coffret)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAdminUser])
def admin_coffret_item_detail(request, pk):
    try:
        obj = CoffretItem.objects.get(pk=pk)
    except (CoffretItem.DoesNotExist, ValueError):
        return Response({'error': 'Élément introuvable.'}, status=status.HTTP_404_NOT_FOUND)
    return _update_delete(request, obj, CoffretItemAdminSerializer)
