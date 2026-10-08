"""Briques communes des vues d'administration (liste/création, modification/suppression)."""
from django.db.models import ProtectedError
from rest_framework import status
from rest_framework.response import Response

PROTECTED_MESSAGE = (
    "Impossible de supprimer : cet élément est utilisé ailleurs (coffret, commande…). "
    "Vous pouvez le désactiver à la place."
)


def list_create(request, queryset, serializer_class):
    if request.method == 'GET':
        return Response(serializer_class(queryset, many=True, context={'request': request}).data)
    serializer = serializer_class(data=request.data, context={'request': request})
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


def update_delete(request, instance, serializer_class):
    if request.method == 'PATCH':
        serializer = serializer_class(instance, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    try:
        instance.delete()
    except ProtectedError:
        return Response({'error': PROTECTED_MESSAGE}, status=status.HTTP_409_CONFLICT)
    return Response(status=status.HTTP_204_NO_CONTENT)
