from django.urls import path

from . import site_views

urlpatterns = [
    path('site/',        site_views.site_public,         name='site_public'),
    path('site/legal/',  site_views.site_legal,          name='site_legal'),
    path('admin/site/',  site_views.admin_site_settings, name='admin_site_settings'),
]
