"""
Recherche « intelligente » : combine correspondance directe (nom, description,
signification, catégorie) et similarité trigramme (tolérante aux fautes de
frappe) via l'extension PostgreSQL pg_trgm, avec tri par pertinence.
"""
from django.contrib.postgres.search import TrigramSimilarity
from django.db.models import Q
from django.db.models.functions import Greatest

SIMILARITY_THRESHOLD = 0.15


def smart_search(queryset, term):
    term = term.strip()
    if not term:
        return queryset

    return (
        queryset.annotate(
            similarity=Greatest(
                TrigramSimilarity('name', term),
                TrigramSimilarity('description', term),
                TrigramSimilarity('symbolic_meaning', term),
                TrigramSimilarity('category__name', term),
            )
        )
        .filter(
            Q(name__icontains=term)
            | Q(description__icontains=term)
            | Q(symbolic_meaning__icontains=term)
            | Q(category__name__icontains=term)
            | Q(similarity__gt=SIMILARITY_THRESHOLD)
        )
        .order_by('-similarity', '-created_at')
    )
