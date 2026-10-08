"""Branche l'optimisation WebP sur tous les champs image du projet (envois admin, avis, seeds)."""
from django.apps import apps
from django.db.models.signals import pre_save

from .imaging import FULL_SIDE, REVIEW_SIDE, make_thumbnail, optimize_field

# (modèle, champ, taille max, champ miniature éventuel)
IMAGE_FIELDS = [
    ('catalog.Category', 'image', FULL_SIDE, None),
    ('catalog.Collection', 'image', FULL_SIDE, None),
    ('catalog.LookbookEntry', 'image', FULL_SIDE, None),
    ('catalog.ProductImage', 'image', FULL_SIDE, 'thumbnail'),
    ('catalog.ProductVariant', 'image', FULL_SIDE, None),
    ('catalog.SymbolGuideEntry', 'image', FULL_SIDE, None),
    ('coffrets.Coffret', 'image', FULL_SIDE, None),
    ('reviews.ReviewImage', 'image', REVIEW_SIDE, None),
]


def _make_receiver(field, max_side, thumb_field):
    def receiver(sender, instance, **kwargs):
        img = optimize_field(getattr(instance, field), max_side)
        if img is not None and thumb_field:
            name, content = make_thumbnail(img, getattr(instance, field).name)
            getattr(instance, thumb_field).save(name, content, save=False)
    return receiver


def connect():
    for label, field, max_side, thumb_field in IMAGE_FIELDS:
        model = apps.get_model(label)
        pre_save.connect(
            _make_receiver(field, max_side, thumb_field), sender=model, weak=False,
            dispatch_uid=f'optimize-{label}-{field}',
        )
