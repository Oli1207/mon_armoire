from django.contrib import admin

from .models import Review, ReviewImage


class ReviewImageInline(admin.TabularInline):
    model = ReviewImage
    extra = 0


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display  = ('product', 'user', 'rating', 'is_approved', 'is_featured', 'created_at')
    list_filter   = ('is_approved', 'is_featured', 'rating')
    search_fields = ('product__name', 'user__email', 'comment')
    list_editable = ('is_approved', 'is_featured')
    inlines       = [ReviewImageInline]
