from .models import Verse, VerseOverride


def natural_verse_for_date(date):
    """Le verset qui tombe naturellement à cette date, par rotation déterministe sur le pool actif."""
    pool = Verse.objects.filter(is_active=True).order_by('id')
    count = pool.count()
    if not count:
        return None
    return pool[date.toordinal() % count]


def verse_for_date(date):
    """Verset effectif pour une date : l'override s'il existe, sinon le verset naturel.

    Retourne un dict {text, reference, is_override} ou None si aucun verset n'est disponible.
    """
    override = VerseOverride.objects.filter(date=date).first()
    if override:
        return {'text': override.text, 'reference': override.reference, 'is_override': True}

    natural = natural_verse_for_date(date)
    if not natural:
        return None
    return {'text': natural.text, 'reference': natural.reference, 'is_override': False}
