from PIL import Image, UnidentifiedImageError

MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_PIXELS = 50_000_000  # garde-fou « bombe de décompression »
ALLOWED_FORMATS = {'JPEG', 'PNG', 'WEBP'}


def validate_image_upload(file):
    """Refuse tout fichier qui n'est pas une vraie image JPEG/PNG/WebP de 5 Mo maximum. Lève ValueError (message affichable)."""
    if file.size > MAX_IMAGE_BYTES:
        raise ValueError('Chaque photo doit faire 5 Mo au maximum.')
    try:
        with Image.open(file) as image:
            image_format = image.format
            width, height = image.size
            image.verify()
    except (UnidentifiedImageError, OSError, SyntaxError):
        raise ValueError('Un des fichiers envoyés n\'est pas une image valide.')
    finally:
        file.seek(0)
    if image_format not in ALLOWED_FORMATS:
        raise ValueError('Formats acceptés : JPEG, PNG ou WebP.')
    if width * height > MAX_PIXELS:
        raise ValueError('Une des photos est trop grande (dimensions).')
