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


class Alert(UUIDModel):
    """File d'envoi des alertes (équipe et clientes) : on écrit ici pendant la requête, la commande `send_pending_alerts`
    (cron toutes les 5 minutes) envoie ensuite. Une panne du service de notification ne bloque donc jamais une commande."""
    kind       = models.CharField(max_length=20)                      # order_paid, low_stock, out_of_stock, new_review, waitlist, order_status
    perm       = models.CharField(max_length=20, blank=True)          # équipe : droit nécessaire pour recevoir l'alerte
    user       = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='+')  # cliente destinataire (sinon : équipe)
    title      = models.CharField(max_length=100)
    body       = models.CharField(max_length=200)
    url        = models.CharField(max_length=200, default='/')
    emailed    = models.BooleanField(default=False)                   # e-mail de l'équipe envoyé
    pushed     = models.BooleanField(default=False)                   # notifications envoyées
    attempts   = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    done_at    = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        ordering = ['created_at']
        indexes = [models.Index(fields=['done_at', 'created_at'], name='alert_queue_idx')]
