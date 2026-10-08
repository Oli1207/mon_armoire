from django.urls import path

from . import views
from . import admin_views

urlpatterns = [
    path('categories/',           views.categories_list,  name='categories_list'),
    path('collections/',          views.collections_list, name='collections_list'),
    path('products/',              views.products_list,    name='products_list'),
    path('search/suggest/',        views.search_suggest,   name='search_suggest'),
    path('products/suggestions/',  views.product_suggestions, name='product_suggestions'),
    path('products/<slug:slug>/', views.product_detail,   name='product_detail'),
    path('symbols/',               views.symbol_guide_list, name='symbol_guide_list'),
    path('lookbook/',              views.lookbook_list,     name='lookbook_list'),
    path('waitlist/',              views.waitlist_join,     name='waitlist_join'),

    # ── Back-office ───────────────────────────────────────────────────────────
    path('admin/categories/',           admin_views.admin_categories,        name='admin_categories'),
    path('admin/categories/<uuid:pk>/', admin_views.admin_category_detail,   name='admin_category_detail'),
    path('admin/collections/',          admin_views.admin_collections,       name='admin_collections'),
    path('admin/collections/<uuid:pk>/', admin_views.admin_collection_detail, name='admin_collection_detail'),
    path('admin/products/',             admin_views.admin_products,          name='admin_products'),
    path('admin/products/<uuid:pk>/',   admin_views.admin_product_detail,    name='admin_product_detail'),
    path('admin/products/<uuid:product_id>/variants/', admin_views.admin_variant_create, name='admin_variant_create'),
    path('admin/variants/<uuid:pk>/',   admin_views.admin_variant_detail,    name='admin_variant_detail'),
    path('admin/products/<uuid:product_id>/images/',   admin_views.admin_image_create,   name='admin_image_create'),
    path('admin/images/<uuid:pk>/',     admin_views.admin_image_delete,      name='admin_image_delete'),
    path('admin/symbols/',              admin_views.admin_symbols,           name='admin_symbols'),
    path('admin/symbols/<uuid:pk>/',    admin_views.admin_symbol_detail,     name='admin_symbol_detail'),
    path('admin/lookbook/',             admin_views.admin_lookbook,          name='admin_lookbook'),
    path('admin/lookbook/<uuid:pk>/',   admin_views.admin_lookbook_detail,   name='admin_lookbook_detail'),
    path('admin/product-options/',      admin_views.admin_product_options,   name='admin_product_options'),
    path('admin/variant-options/',      admin_views.admin_variant_options,   name='admin_variant_options'),
    path('admin/waitlist/',             admin_views.admin_waitlist,          name='admin_waitlist'),
    path('admin/waitlist/<uuid:pk>/',   admin_views.admin_waitlist_detail,   name='admin_waitlist_detail'),
]
