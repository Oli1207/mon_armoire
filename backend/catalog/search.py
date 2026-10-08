"""
Recherche de produits.

- Avec l'extension PostgreSQL pg_trgm : correspondance directe + similarité par trigrammes (tolère les fautes de frappe).
- Sans l'extension (cas de l'hébergement LWS) : correspondance par mots (tous les mots doivent apparaître dans le nom,
  la description, la signification ou la catégorie), les produits dont le NOM contient tous les mots passent en premier.
"""
from functools import lru_cache

from django.db import connection
from django.db.models import Case, IntegerField, Q, Value, When
from django.db.models.functions import Greatest

SIMILARITY_THRESHOLD = 0.15
MAX_WORDS = 6


@lru_cache(maxsize=1)
def trigram_available():
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'")
        return cursor.fetchone() is not None


def _word_filter(words, fields):
    """ET entre les mots, OU entre les champs : « croix argent » trouve une croix dont la description parle d'argent."""
    combined = Q()
    for word in words:
        any_field = Q()
        for field in fields:
            any_field |= Q(**{f'{field}__icontains': word})
        combined &= any_field
    return combined


def _simple_search(queryset, term):
    words = term.split()[:MAX_WORDS]
    in_name = _word_filter(words, ['name'])
    anywhere = _word_filter(words, ['name', 'description', 'symbolic_meaning', 'category__name'])
    return (
        queryset.annotate(relevance=Case(When(in_name, then=Value(2)), default=Value(1), output_field=IntegerField()))
        .filter(anywhere)
        .order_by('-relevance', '-created_at')
    )


def smart_search(queryset, term):
    term = term.strip()
    if not term:
        return queryset
    if not trigram_available():
        return _simple_search(queryset, term)

    from django.contrib.postgres.search import TrigramSimilarity

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
