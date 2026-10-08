from django.urls import path

from . import views

urlpatterns = [
    path('notifications/verse-of-the-day/', views.verse_of_the_day, name='verse_of_the_day'),
    path('notifications/push-subscribe/',   views.push_subscribe,   name='push_subscribe'),

    path('notifications/verses/week/',            views.verses_week,           name='verses_week'),
    path('notifications/verses/week/<str:date>/',  views.verse_override_detail, name='verse_override_detail'),
]
