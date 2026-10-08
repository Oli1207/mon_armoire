import uuid

from django.db import models


class UUIDModel(models.Model):
    """Base abstraite : id UUID en clé primaire (aucun entier séquentiel exposé)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True
