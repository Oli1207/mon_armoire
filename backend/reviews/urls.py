from django.urls import path

from . import views
from . import admin_views

urlpatterns = [
    path('products/<slug:slug>/reviews/', views.product_reviews, name='product_reviews'),
    path('reviews/featured/',             views.featured_reviews, name='featured_reviews'),

    # ── Back-office ───────────────────────────────────────────────────────────
    path('admin/reviews/',           admin_views.admin_reviews_list,   name='admin_reviews_list'),
    path('admin/reviews/<uuid:pk>/', admin_views.admin_review_detail, name='admin_review_detail'),
]
