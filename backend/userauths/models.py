from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.crypto import get_random_string

from common.models import UUIDModel


def unique_username(email):
    """Identifiant dérivé de l'e-mail, suffixé si déjà pris (jean@a.com et jean@b.com ne doivent pas se heurter)."""
    base = (email.split('@')[0] or 'client')[:90]
    candidate = base
    while User.objects.filter(username=candidate).exists():
        candidate = f'{base}-{get_random_string(5, allowed_chars="abcdefghijkmnpqrstuvwxyz23456789")}'
    return candidate


class User(UUIDModel, AbstractUser):
    username    = models.CharField(max_length=100, unique=True)
    email       = models.EmailField(unique=True)
    full_name   = models.CharField(max_length=200, blank=True)
    phone       = models.CharField(max_length=30, blank=True)
    otp         = models.CharField(max_length=10, blank=True, null=True)
    reset_token = models.CharField(max_length=200, blank=True, null=True)

    referral_code      = models.CharField(max_length=12, unique=True, blank=True, editable=False)
    referred_by         = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='referrals')
    referral_rewarded   = models.BooleanField(default=False, help_text="Le parrain a déjà été récompensé pour ce filleul")

    USERNAME_FIELD  = 'email'
    REQUIRED_FIELDS = ['username']

    def __str__(self):
        return self.email

    def save(self, *args, **kwargs):
        if not self.username:
            self.username = unique_username(self.email)
        if not self.referral_code:
            code = get_random_string(8, allowed_chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789')
            while User.objects.filter(referral_code=code).exists():
                code = get_random_string(8, allowed_chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789')
            self.referral_code = code
        super().save(*args, **kwargs)


class Address(UUIDModel):
    user       = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='addresses',
                                    help_text="Vide pour une adresse de commande invité, non liée à un compte")
    label      = models.CharField(max_length=100, blank=True, help_text="Ex: Domicile, Bureau")
    full_name  = models.CharField(max_length=200)
    phone      = models.CharField(max_length=30)
    country    = models.CharField(max_length=100, default="Côte d'Ivoire")
    city       = models.CharField(max_length=100)
    street     = models.CharField(max_length=255, help_text="Quartier, rue, indications d'accès")
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-is_default', '-created_at']

    def __str__(self):
        return f'{self.full_name} — {self.city}'


class Favorite(UUIDModel):
    user       = models.ForeignKey(User, on_delete=models.CASCADE, related_name='favorites')
    product    = models.ForeignKey('catalog.Product', on_delete=models.CASCADE, related_name='favorited_by')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'product')
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user.email} ♥ {self.product.name}'
