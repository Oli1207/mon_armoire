from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from common.models import UUIDModel
from userauths.models import User
from catalog.models import Product


class Review(UUIDModel):
    product     = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='reviews')
    user        = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reviews')
    rating      = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comment     = models.TextField(blank=True)
    is_approved = models.BooleanField(default=False, help_text="Modération avant affichage public")
    is_featured = models.BooleanField(default=False, help_text="Mise en avant sur la page d'accueil")
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ('product', 'user')
        indexes = [
            models.Index(fields=['product', 'is_approved', '-created_at'], name='review_product_approved_idx'),
            models.Index(fields=['is_approved', 'is_featured', '-created_at'], name='review_featured_idx'),
        ]

    def __str__(self):
        return f'{self.product.name} — {self.rating}/5 ({self.user.email})'


class ReviewImage(UUIDModel):
    review     = models.ForeignKey(Review, on_delete=models.CASCADE, related_name='images')
    image      = models.ImageField(upload_to='reviews/')
    order      = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'created_at']

    def __str__(self):
        return f'Photo avis {self.review_id}'
