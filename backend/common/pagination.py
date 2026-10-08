from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    """Pagination commune : ?page=2&page_size=24 (plafonné). Réponse : {count, next, previous, results}."""
    page_size = 24
    page_size_query_param = 'page_size'
    max_page_size = 100


class AdminPagination(StandardPagination):
    page_size = 20


def paginate(request, queryset, serializer_class, *, pagination=StandardPagination, **serializer_kwargs):
    """Pagine un queryset dans une vue @api_view. Un queryset non ordonné est refusé (pages instables)."""
    if not queryset.ordered:
        raise ValueError('Un queryset paginé doit être ordonné.')
    paginator = pagination()
    page = paginator.paginate_queryset(queryset, request)
    return paginator.get_paginated_response(serializer_class(page, many=True, **serializer_kwargs).data)
