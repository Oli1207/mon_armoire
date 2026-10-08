from django.db import models

from common.models import UUIDModel
from userauths.models import User


class Verse(UUIDModel):
    text       = models.TextField()
    reference  = models.CharField(max_length=100, help_text="Ex: Proverbes 3:5")
    is_active  = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.reference


class VerseOverride(UUIDModel):
    """Verset choisi manuellement pour une date précise — remplace le verset naturel ce jour-là."""
    date       = models.DateField(unique=True)
    text       = models.TextField()
    reference  = models.CharField(max_length=100, help_text="Ex: Proverbes 3:5")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['date']

    def __str__(self):
        return f'{self.date} — {self.reference}'


class PushSubscription(UUIDModel):
    user       = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='push_subscriptions')
    endpoint   = models.URLField(max_length=500, unique=True)
    p256dh_key = models.CharField(max_length=255)
    auth_key   = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.user.email if self.user else self.endpoint[:40]
