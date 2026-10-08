from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse


def api_not_found(request, exception=None):
    return JsonResponse({'error': 'Ressource introuvable.'}, status=404)


def api_server_error(request):
    return JsonResponse({'error': 'Une erreur est survenue. Veuillez réessayer.'}, status=500)


handler404 = api_not_found
handler500 = api_server_error

urlpatterns = [
    path('api/auth/', include('userauths.urls')),
    path('api/', include('catalog.urls')),
    path('api/', include('coffrets.urls')),
    path('api/', include('orders.urls')),
    path('api/', include('reviews.urls')),
    path('api/', include('notifications.urls')),
    path('api/', include('dashboard.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# L'administration Django n'est montée que si ADMIN_URL est renseignée : l'espace Admin du site suffit à la cliente,
# et une porte de moins est une surface d'attaque de moins (laisser ADMIN_URL vide en production une fois la mise en route finie).
if settings.ADMIN_URL:
    urlpatterns.insert(0, path(settings.ADMIN_URL, admin.site.urls))
