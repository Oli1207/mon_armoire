from django.core.files.uploadedfile import UploadedFile
from PIL import Image, UnidentifiedImageError
from rest_framework import serializers

MAX_IMAGE_BYTES = 5 * 1024 * 1024         # photos envoyées par les clientes (avis)
MAX_ADMIN_IMAGE_BYTES = 15 * 1024 * 1024  # photos de téléphone prises par l'administratrice : réduites ensuite par le serveur
MAX_PIXELS = 50_000_000  # garde-fou « bombe de décompression »
ALLOWED_FORMATS = {'JPEG', 'PNG', 'WEBP'}


def validate_image_upload(file, max_bytes=MAX_IMAGE_BYTES):
    """Refuse tout fichier qui n'est pas une vraie image JPEG/PNG/WebP. Lève ValueError (message affichable)."""
    if file.size > max_bytes:
        raise ValueError(f'Chaque photo doit faire {max_bytes // (1024 * 1024)} Mo au maximum.')
    try:
        with Image.open(file) as image:
            image_format = image.format
            width, height = image.size
            image.verify()
    except (UnidentifiedImageError, OSError, SyntaxError):
        raise ValueError("Le fichier envoyé n'est pas une image valide.")
    finally:
        file.seek(0)
    if image_format not in ALLOWED_FORMATS:
        raise ValueError('Formats acceptés : JPEG, PNG ou WebP.')
    if width * height > MAX_PIXELS:
        raise ValueError('La photo est trop grande (dimensions).')


class ValidatedImagesMixin:
    """À placer devant ModelSerializer : toute image envoyée est vérifiée (vraie image, formats, poids)."""

    def validate(self, attrs):
        attrs = super().validate(attrs)
        for name, value in attrs.items():
            if isinstance(value, UploadedFile):
                try:
                    validate_image_upload(value, MAX_ADMIN_IMAGE_BYTES)
                except ValueError as exc:
                    raise serializers.ValidationError({name: str(exc)})
        return attrs
