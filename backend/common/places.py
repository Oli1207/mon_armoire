"""Lieu de livraison : pour Abidjan, la commune est obligatoire (choix dans une liste) et le quartier est saisi librement.

Les ventes par commune et par quartier (écran « Visiteurs ») viennent de ces adresses de livraison réelles :
la position d'un simple visiteur (adresse IP) ne donne au mieux que « Abidjan », jamais le quartier.
"""
import unicodedata

COMMUNES = (
    'Abobo', 'Adjamé', 'Anyama', 'Attécoubé', 'Bingerville', 'Cocody', 'Koumassi',
    'Marcory', 'Plateau', 'Port-Bouët', 'Songon', 'Treichville', 'Yopougon',
)


def _plain(text):
    return ''.join(c for c in unicodedata.normalize('NFD', str(text).casefold()) if unicodedata.category(c) != 'Mn').strip()


def is_abidjan(city):
    return _plain(city).startswith('abidjan')


def clean_place(city, commune, quartier):
    """(commune, quartier, message d'erreur). Quartier toujours obligatoire ; commune obligatoire et contrôlée pour Abidjan."""
    quartier = ' '.join(str(quartier or '').split())[:80]
    commune = str(commune or '').strip()
    if is_abidjan(city):
        matches = [c for c in COMMUNES if _plain(c) == _plain(commune)]
        if not matches:
            return '', quartier, 'Choisissez votre commune dans la liste (Cocody, Yopougon, Marcory…).'
        commune = matches[0]
    else:
        commune = ''
    if not quartier:
        return commune, '', 'Indiquez votre quartier (par exemple Riviera, Angré, Zone 4…).'
    return commune, quartier, None
