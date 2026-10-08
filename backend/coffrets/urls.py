from django.urls import path

from . import views
from . import admin_views

urlpatterns = [
    path('coffrets/',            views.coffrets_list,     name='coffrets_list'),
    path('coffrets/configure/',  views.coffret_configure,  name='coffret_configure'),
    path('coffrets/<slug:slug>/', views.coffret_detail,    name='coffret_detail'),

    # ── Back-office ───────────────────────────────────────────────────────────
    path('admin/coffrets/',           admin_views.admin_coffrets,       name='admin_coffrets'),
    path('admin/coffrets/<uuid:pk>/', admin_views.admin_coffret_detail, name='admin_coffret_detail'),
    path('admin/coffrets/<uuid:coffret_id>/slots/', admin_views.admin_slot_create, name='admin_slot_create'),
    path('admin/slots/<uuid:pk>/',    admin_views.admin_slot_detail,    name='admin_slot_detail'),
    path('admin/coffrets/<uuid:coffret_id>/items/', admin_views.admin_coffret_item_create, name='admin_coffret_item_create'),
    path('admin/coffret-items/<uuid:pk>/', admin_views.admin_coffret_item_detail, name='admin_coffret_item_detail'),
]
