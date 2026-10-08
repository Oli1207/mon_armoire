from rest_framework import status
from rest_framework.decorators import api_view, permission_classes

from rest_framework.response import Response
from userauths.permissions import staff_can

from common.pagination import AdminPagination, paginate
from .models import Review
from .admin_serializers import ReviewAdminSerializer


@api_view(['GET'])
@permission_classes([staff_can('reviews')])
def admin_reviews_list(request):
    qs = Review.objects.select_related('product', 'user').prefetch_related('images').order_by('-created_at', 'id')
    return paginate(request, qs, ReviewAdminSerializer, pagination=AdminPagination)


@api_view(['PATCH', 'DELETE'])
@permission_classes([staff_can('reviews')])
def admin_review_detail(request, pk):
    try:
        obj = Review.objects.get(pk=pk)
    except (Review.DoesNotExist, ValueError):
        return Response({'error': 'Avis introuvable.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = ReviewAdminSerializer(obj, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
