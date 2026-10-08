from django.db import IntegrityError, transaction
from django.db.models import Avg, Count
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import Throttled
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from catalog.models import Product
from common.pagination import StandardPagination, paginate
from common.throttles import ReviewThrottle
from common.uploads import validate_image_upload
from .models import Review, ReviewImage
from .serializers import ReviewSerializer, ReviewCreateSerializer


class ReviewPagination(StandardPagination):
    page_size = 10


def review_summary(approved_reviews):
    """Moyenne, nombre d'avis et répartition par nombre d'étoiles (pour l'en-tête de la section avis)."""
    totals = approved_reviews.aggregate(average=Avg('rating'), count=Count('id'))
    by_rating = dict(approved_reviews.order_by().values_list('rating').annotate(n=Count('id')))
    return {
        'average': round(float(totals['average']), 1) if totals['average'] else 0,
        'count': totals['count'],
        'distribution': {str(stars): by_rating.get(stars, 0) for stars in (5, 4, 3, 2, 1)},
    }


def _throttle_review_posts(view):
    """Limite uniquement l'envoi d'avis (POST) : la lecture reste libre."""
    def wrapper(request, *args, **kwargs):
        if request.method == 'POST' and request.user.is_authenticated:
            throttle = ReviewThrottle()
            if not throttle.allow_request(request, None):
                raise Throttled(wait=throttle.wait())
        return view(request, *args, **kwargs)
    wrapper.__name__ = view.__name__
    return wrapper


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
@_throttle_review_posts
def product_reviews(request, slug):
    try:
        product = Product.objects.get(slug=slug, is_active=True)
    except Product.DoesNotExist:
        return Response({'error': 'Produit introuvable.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        approved = Review.objects.filter(product=product, is_approved=True)
        qs = approved.select_related('user').prefetch_related('images')
        response = paginate(request, qs, ReviewSerializer, pagination=ReviewPagination)
        response.data['summary'] = review_summary(approved)
        return response

    if not request.user.is_authenticated:
        return Response({'error': 'Connectez-vous pour laisser un avis.'}, status=status.HTTP_401_UNAUTHORIZED)

    if Review.objects.filter(product=product, user=request.user).exists():
        return Response({'error': 'Vous avez déjà laissé un avis pour ce produit.'}, status=status.HTTP_400_BAD_REQUEST)

    serializer = ReviewCreateSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    images = request.FILES.getlist('images')[:6]
    try:
        for image in images:
            validate_image_upload(image)
    except ValueError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    # Auto-approuvé : le back-office permet de masquer un avis (is_approved) après coup
    try:
        with transaction.atomic():
            review = Review.objects.create(product=product, user=request.user, is_approved=True, **serializer.validated_data)
            for i, image in enumerate(images):
                ReviewImage.objects.create(review=review, image=image, order=i)
    except IntegrityError:  # double envoi simultané : la contrainte unique (produit, client) fait foi
        return Response({'error': 'Vous avez déjà laissé un avis pour ce produit.'}, status=status.HTTP_400_BAD_REQUEST)

    return Response(ReviewSerializer(review).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([AllowAny])
def featured_reviews(request):
    qs = (
        Review.objects
        .filter(is_approved=True, is_featured=True)
        .select_related('user', 'product')
        .prefetch_related('images')
        .order_by('-created_at')[:12]
    )
    return Response(ReviewSerializer(qs, many=True).data)
