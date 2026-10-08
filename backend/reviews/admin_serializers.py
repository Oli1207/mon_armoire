from rest_framework import serializers

from .models import Review
from .serializers import ReviewImageSerializer


class ReviewAdminSerializer(serializers.ModelSerializer):
    user_email   = serializers.CharField(source='user.email', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    images       = ReviewImageSerializer(many=True, read_only=True)

    class Meta:
        model  = Review
        fields = ('id', 'product', 'product_name', 'user_email', 'rating', 'comment',
                  'images', 'is_approved', 'is_featured', 'created_at')
