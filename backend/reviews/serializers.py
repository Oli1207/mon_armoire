from rest_framework import serializers

from .models import Review, ReviewImage


class ReviewImageSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ReviewImage
        fields = ('id', 'image')


class ReviewSerializer(serializers.ModelSerializer):
    user_name    = serializers.SerializerMethodField()
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_slug = serializers.CharField(source='product.slug', read_only=True)
    images       = ReviewImageSerializer(many=True, read_only=True)

    class Meta:
        model  = Review
        fields = ('id', 'user_name', 'product_name', 'product_slug', 'rating', 'comment', 'images', 'created_at')

    def get_user_name(self, obj):
        return obj.user.full_name or obj.user.email.split('@')[0]


class ReviewCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Review
        fields = ('rating', 'comment')
