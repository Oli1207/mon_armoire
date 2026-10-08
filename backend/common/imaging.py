"""
Optimisation des images envoyées : redimensionnement + conversion WebP à l'enregistrement.

Sur hébergement mutualisé et réseaux mobiles, une photo de téléphone brute (3 à 5 Mo) ralentit tout le site.
En cas de fichier illisible, on retombe sur l'original plutôt que de bloquer l'envoi.
"""
import os
from io import BytesIO

from django.core.files.base import ContentFile
from PIL import Image, ImageOps

FULL_SIDE = 1400    # grande image (fiche produit, bandeaux)
THUMB_SIDE = 720    # miniature (catalogue, panier, accueil) : assez large pour les écrans retina
REVIEW_SIDE = 1000  # photos d'avis
QUALITY = 82

Image.MAX_IMAGE_PIXELS = 50_000_000  # garde-fou « bombe de décompression » (Pillow refuse au-delà de 2x)


def _open(source):
    if hasattr(source, 'seek'):
        source.seek(0)
    img = Image.open(source)
    img.load()
    img = ImageOps.exif_transpose(img)
    if img.mode not in ('RGB', 'RGBA'):
        img = img.convert('RGBA' if 'A' in img.mode or 'transparency' in img.info else 'RGB')
    return img


def _webp(img, max_side, quality=QUALITY):
    work = img.copy()
    work.thumbnail((max_side, max_side), Image.LANCZOS)  # jamais agrandie
    buffer = BytesIO()
    work.save(buffer, format='WEBP', quality=quality, method=4)
    return buffer.getvalue()


def webp_name(original_name, suffix=''):
    stem = os.path.splitext(os.path.basename(original_name))[0]
    return f'{stem}{suffix}.webp'


def optimize_field(field_file, max_side=FULL_SIDE):
    """Remplace, avant sauvegarde, le fichier d'un ImageField par sa version WebP réduite.

    Sans effet si le fichier est déjà enregistré. Renvoie l'image PIL ouverte (pour en tirer une miniature) ou None.
    """
    if not field_file or getattr(field_file, '_committed', True):
        return None
    try:
        img = _open(field_file.file)
        field_file.save(webp_name(field_file.name), ContentFile(_webp(img, max_side)), save=False)
        return img
    except Exception:
        return None


def make_thumbnail(img, name, max_side=THUMB_SIDE):
    return webp_name(name, '_thumb'), ContentFile(_webp(img, max_side, quality=80))
