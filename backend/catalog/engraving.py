"""Gravure / personnalisation : zone d'aperçu définie par la cliente sur la photo, et nettoyage du texte saisi.

La zone est exprimée en fractions (0 à 1) du cadre carré de la photo, tel qu'il est affiché sur le site : elle reste donc
exacte sur tous les écrans. Trois modes :
  - plate : texte posé à plat dans un rectangle incliné (médaille, plaque, barrette de bracelet) ;
  - arc   : texte qui suit une courbe tracée avec 3 points (chaîne, collier, pendentif rond) ;
  - beads : une lettre par perle, le long d'une ligne ou d'une courbe (chapelet, bracelet de perles à lettres).
"""
import math
import re

from django.core.exceptions import ValidationError

MODES = ('plate', 'arc', 'beads')
FONTS = ('script', 'elegant', 'classic', 'modern')
STYLES = ('silver', 'gold', 'dark', 'white')                       # matière du texte (plate, arc)
COLORS = ('white', 'pink', 'gold', 'black', 'blue', 'green', 'red', 'silver')   # perles et lettres (beads)
MAX_ENGRAVING_CHARS = 60

TEXT_RE = re.compile(r"^[^\W_]+(?:[ '’.&-]+[^\W_]*)*[.]?$", re.UNICODE)


def _number(raw, low, high, label):
    try:
        value = float(raw)
    except (TypeError, ValueError):
        raise ValidationError(f'« {label} » doit être un nombre.')
    if not math.isfinite(value) or not (low <= value <= high):
        raise ValidationError(f'« {label} » doit être entre {low} et {high}.')
    return round(value, 4)


def _choice(raw, allowed, label, default=None):
    value = default if raw in (None, '') else raw
    if value not in allowed:
        raise ValidationError(f'« {label} » n’est pas un choix valide.')
    return value


def validate_zone(value):
    """Renvoie la zone nettoyée (dictionnaire reconstruit champ par champ) ou None ; lève ValidationError sinon."""
    if value in (None, '', {}):
        return None
    if not isinstance(value, dict):
        raise ValidationError('Zone de gravure invalide.')
    mode = _choice(value.get('mode'), MODES, 'Type de zone')
    zone = {
        'mode': mode,
        'font': _choice(value.get('font'), FONTS, 'Police', 'script'),
        'uppercase': bool(value.get('uppercase', False)),
    }
    if mode == 'plate':
        zone.update(
            style=_choice(value.get('style'), STYLES, 'Matière', 'silver'),
            x=_number(value.get('x'), 0, 1, 'Position horizontale'),
            y=_number(value.get('y'), 0, 1, 'Position verticale'),
            w=_number(value.get('w'), 0.05, 1, 'Largeur'),
            h=_number(value.get('h'), 0.03, 1, 'Hauteur'),
            angle=_number(value.get('angle', 0), -90, 90, 'Inclinaison'),
        )
        return zone
    points = value.get('points')
    if not isinstance(points, list) or len(points) != 3 or any(not isinstance(p, (list, tuple)) or len(p) != 2 for p in points):
        raise ValidationError('Placez les 3 points de la courbe.')
    zone['points'] = [[_number(p[0], 0, 1, 'Point'), _number(p[1], 0, 1, 'Point')] for p in points]
    if mode == 'arc':
        zone['style'] = _choice(value.get('style'), STYLES, 'Matière', 'silver')
    else:
        zone.update(
            bead_size=_number(value.get('bead_size', 0.07), 0.03, 0.2, 'Taille des perles'),
            bead_color=_choice(value.get('bead_color'), COLORS, 'Couleur des perles', 'white'),
            letter_color=_choice(value.get('letter_color'), COLORS, 'Couleur des lettres', 'pink'),
        )
    return zone


def _clean_side(raw_text, limit, missing):
    text = ' '.join(str(raw_text or '').split())[:MAX_ENGRAVING_CHARS + 1]
    if not text:
        return '', missing
    if len(text) > limit:
        return '', f'La gravure est limitée à {limit} caractères pour ce bijou.'
    if not TEXT_RE.match(text):
        return '', 'La gravure accepte seulement des lettres, des chiffres, des espaces, l’apostrophe, le point, le tiret et le &.'
    return text, None


def clean_engraving(variant, raw_text, raw_back=''):
    """(recto, verso, message d'erreur), selon la gravure comprise dans le prix de cette version : aucun texte conservé
    pour une version sans gravure, texte obligatoire pour chaque face payée."""
    sides = variant.engraving_sides if variant else 0
    if not sides:
        return '', '', None
    limit = variant.product.engraving_max_chars
    front, error = _clean_side(raw_text, limit, 'Indiquez le texte à graver.' if sides == 1 else 'Indiquez le texte à graver au recto.')
    if error:
        return '', '', error
    if sides == 1:
        return front, '', None
    back, error = _clean_side(raw_back, limit, 'Indiquez le texte à graver au verso.')
    if error:
        return '', '', error
    return front, back, None
