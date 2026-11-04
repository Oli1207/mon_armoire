import logging
import os
from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile, UploadedFile
from django.core.validators import validate_image_file_extension
from django.db import models
from django.utils.text import get_valid_filename
from PIL import Image, UnidentifiedImageError
from rest_framework import serializers

from .imaging import HEIF_SUPPORTED, MAX_READABLE_PIXELS, open_for_processing

logger = logging.getLogger(__name__)

MAX_IMAGE_BYTES = 5 * 1024 * 1024         # photos envoyées par les clientes (avis)
MAX_ADMIN_IMAGE_BYTES = 25 * 1024 * 1024  # photos envoyées par l'équipe : réduites ensuite par le serveur
MAX_PIXELS = 50_000_000  # garde-fou « bombe de décompression »
# MPO = le .jpg des téléphones récents (photo HDR ou portrait : plusieurs images dans le même fichier)
ALLOWED_FORMATS = {'JPEG', 'MPO', 'PNG', 'WEBP'}
# Liste fermée : Pillow sait lire bien d'autres formats, dont EPS, qui lancerait un programme externe sur le serveur.
# (MPO est lu par le lecteur JPEG.)
ADMIN_FORMATS = ('JPEG', 'PNG', 'WEBP', 'GIF', 'BMP', 'DIB', 'TIFF', 'AVIF', *(('HEIF',) if HEIF_SUPPORTED else ()))
WEB_EXTENSIONS = {'JPEG': 'jpg', 'MPO': 'jpg', 'PNG': 'png', 'WEBP': 'webp'}
TRANSCODE_SIDE = 2800
NOT_A_PHOTO = (
    "Ce fichier n'a pas pu être lu comme une photo (vidéo, PDF ou fichier abîmé ?). "
    "Ouvrez-le sur votre appareil, faites une capture d'écran, puis envoyez cette capture."
)


def validate_image_upload(file, max_bytes=MAX_IMAGE_BYTES):
    """Refuse tout fichier qui n'est pas une vraie image JPEG/PNG/WebP. Lève ValueError (message affichable)."""
    if file.size > max_bytes:
        raise ValueError(f'Chaque photo doit faire {max_bytes // (1024 * 1024)} Mo au maximum.')
    try:
        with Image.open(file) as image:
            image_format = image.format
            width, height = image.size
            image.verify()
    except Image.DecompressionBombError:
        raise ValueError('La photo est trop grande (dimensions).')
    except (UnidentifiedImageError, OSError, SyntaxError):
        raise ValueError("Le fichier envoyé n'est pas une image valide.")
    finally:
        file.seek(0)
    if image_format not in ALLOWED_FORMATS:
        raise ValueError('Formats acceptés : JPEG, PNG ou WebP.')
    if width * height > MAX_PIXELS:
        raise ValueError('La photo est trop grande (dimensions).')


def clean_admin_image(file):
    """Accepte tout format photo courant, quels que soient le nom et l'extension du fichier.

    Seul le contenu compte : la photo est réellement décodée ici. Les formats que les navigateurs n'affichent pas
    tous sont convertis ; le signal d'enregistrement (common/image_signals.py) réduit ensuite le tout en WebP.
    """
    if file.size > MAX_ADMIN_IMAGE_BYTES:
        raise ValueError(f'Cette photo pèse {file.size / (1024 * 1024):.0f} Mo : le maximum est {MAX_ADMIN_IMAGE_BYTES // (1024 * 1024)} Mo.')
    too_big = 'Cette photo a trop de pixels pour le serveur. Réduisez-la (ou faites-en une capture d’écran) puis réessayez.'
    Image.init()
    try:
        with Image.open(file, formats=[name for name in ADMIN_FORMATS if name in Image.OPEN]) as image:
            image_format = image.format
            pixels = image.size[0] * image.size[1]
        if pixels > MAX_READABLE_PIXELS:
            raise Image.DecompressionBombError
        decoded = open_for_processing(file)
    except Image.DecompressionBombError:
        raise ValueError(too_big)
    except Exception as exc:  # chaque décodeur a ses propres erreurs : un fichier illisible ne doit jamais donner une erreur serveur
        # La vraie cause reste dans logs/ (ni nom de fichier ni contenu), pour pouvoir diagnostiquer un refus
        logger.warning('Photo refusée : %s Ko, type annoncé %s, cause %r', file.size // 1024, file.content_type, exc)
        raise ValueError(NOT_A_PHOTO)
    finally:
        file.seek(0)

    stem = os.path.splitext(os.path.basename(file.name or ''))[0]
    try:
        stem = get_valid_filename(stem)[:60]
    except Exception:  # nom vide ou réduit à rien : get_valid_filename le refuse
        stem = 'photo'
    if image_format in WEB_EXTENSIONS:
        file.name = f'{stem}.{WEB_EXTENSIONS[image_format]}'
        return file
    decoded.thumbnail((TRANSCODE_SIDE, TRANSCODE_SIDE), Image.LANCZOS)
    buffer = BytesIO()
    decoded.save(buffer, format='WEBP', quality=95, method=4)
    return SimpleUploadedFile(f'{stem}.webp', buffer.getvalue(), content_type='image/webp')


class AdminImageField(serializers.ImageField):
    def to_internal_value(self, data):
        if not isinstance(data, UploadedFile):
            raise serializers.ValidationError('Choisissez une photo.')
        try:
            return clean_admin_image(data)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc))


class ValidatedImagesMixin:
    """À placer devant ModelSerializer : tout champ image de l'Admin passe par clean_admin_image.

    Remplace les contrôles par défaut de DRF sur l'extension et la longueur du nom, sans objet ici : le fichier est
    jugé sur son contenu et renommé, et ces contrôles refusaient des photos valides (nom long, sans extension).
    """

    def build_standard_field(self, field_name, model_field):
        field_class, field_kwargs = super().build_standard_field(field_name, model_field)
        if isinstance(model_field, models.ImageField):
            field_class = AdminImageField
            field_kwargs.pop('max_length', None)
            validators = [v for v in field_kwargs.pop('validators', []) if v is not validate_image_file_extension]
            if validators:
                field_kwargs['validators'] = validators
        return field_class, field_kwargs
