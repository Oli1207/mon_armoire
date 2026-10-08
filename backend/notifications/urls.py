from django.urls import path

from . import admin_views, views

urlpatterns = [
    path('notifications/verse-of-the-day/', views.verse_of_the_day, name='verse_of_the_day'),
    path('notifications/push-subscribe/',   views.push_subscribe,   name='push_subscribe'),
    path('notifications/push-unsubscribe/', views.push_unsubscribe, name='push_unsubscribe'),

    path('notifications/verses/library/',          admin_views.admin_verses,       name='admin_verses'),
    path('notifications/verses/library/<uuid:pk>/', admin_views.admin_verse_detail, name='admin_verse_detail'),
    path('notifications/verses/week/',            views.verses_week,           name='verses_week'),
    path('notifications/verses/week/<str:date>/',  views.verse_override_detail, name='verse_override_detail'),
]
