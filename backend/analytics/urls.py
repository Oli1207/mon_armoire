from django.urls import path

from . import admin_views, views

urlpatterns = [
    path('track/',                        views.collect,                  name='track_collect'),
    path('admin/analytics/overview/',     admin_views.analytics_overview, name='admin_analytics_overview'),
    path('admin/analytics/products/',     admin_views.analytics_products, name='admin_analytics_products'),
    path('admin/analytics/searches/',     admin_views.analytics_searches, name='admin_analytics_searches'),
    path('admin/analytics/places/',       admin_views.analytics_places,   name='admin_analytics_places'),
    path('admin/analytics/carts/',        admin_views.analytics_carts,    name='admin_analytics_carts'),
]
