from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from django.db.models import Q

from common.admin_crud import update_delete
from common.pagination import AdminPagination, paginate
from .models import Verse


class VerseAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Verse
        fields = ('id', 'text', 'reference', 'is_active')

    def validate_text(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Le texte du verset est obligatoire.')
        return value

    def validate_reference(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('La référence est obligatoire (ex : Jean 3:16).')
        return value


@api_view(['GET', 'POST'])
@permission_classes([IsAdminUser])
def admin_verses(request):
    if request.method == 'POST':
        serializer = VerseAdminSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    qs = Verse.objects.order_by('reference', 'id')
    search = (request.query_params.get('search') or '').strip()[:100]
    if search:
        qs = qs.filter(Q(text__icontains=search) | Q(reference__icontains=search))
    return paginate(request, qs, VerseAdminSerializer, pagination=AdminPagination)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAdminUser])
def admin_verse_detail(request, pk):
    try:
        verse = Verse.objects.get(pk=pk)
    except (Verse.DoesNotExist, ValueError):
        return Response({'error': 'Verset introuvable.'}, status=status.HTTP_404_NOT_FOUND)
    return update_delete(request, verse, VerseAdminSerializer)
