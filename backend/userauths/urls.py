from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import admin_views, views

urlpatterns = [
    path('token/',         views.MyTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(),            name='token_refresh'),
    path('register/',      views.register_view,                  name='register'),
    path('me/',            views.me_view,                        name='me'),
    path('me/update/',     views.update_profile_view,            name='update_profile'),
    path('me/tour/',       views.tour_seen_view,                 name='tour_seen'),
    path('me/password/',   views.change_password_view,          name='change_password'),
    path('forgot-password/', views.forgot_password_view,        name='forgot_password'),
    path('reset-password/',  views.reset_password_view,         name='reset_password'),

    path('addresses/',                          views.addresses_view,       name='addresses'),
    path('addresses/<uuid:address_id>/',        views.address_detail_view,  name='address_detail'),

    path('admin/team/',                          admin_views.admin_team,        name='admin_team'),
    path('admin/team/<uuid:pk>/',                admin_views.admin_team_detail, name='admin_team_detail'),
    path('admin/team/<uuid:pk>/invite/',         admin_views.admin_team_invite, name='admin_team_invite'),
    path('admin/journal/',                       admin_views.admin_journal,     name='admin_journal'),

    path('favorites/',                           views.favorites_list,      name='favorites_list'),
    path('favorites/ids/',                       views.favorite_ids,        name='favorite_ids'),
    path('favorites/<uuid:product_id>/toggle/',  views.favorite_toggle,     name='favorite_toggle'),
]
