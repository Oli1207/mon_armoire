from functools import wraps

from django.utils.cache import patch_cache_control


def public_cache(max_age=60, stale_while_revalidate=300):
    """Cache HTTP court sur une lecture publique, identique pour tous les visiteurs.

    À placer SOUS @api_view. Les modifications faites en back-office apparaissent au plus tard après `max_age` secondes.
    """
    def decorator(view):
        @wraps(view)
        def wrapper(request, *args, **kwargs):
            response = view(request, *args, **kwargs)
            if request.method == 'GET' and response.status_code == 200:
                patch_cache_control(response, public=True, max_age=max_age, stale_while_revalidate=stale_while_revalidate)
            return response
        return wrapper
    return decorator
