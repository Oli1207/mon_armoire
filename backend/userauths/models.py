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
    commune    = models.CharField(max_length=40, blank=True, help_text="Commune d'Abidjan (liste fixe) ; vide hors d'Abidjan")
    quartier   = models.CharField(max_length=80, blank=True)
    street     = models.CharField(max_length=255, help_text="Rue, repères, indications d'accès")
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


class StaffProfile(UUIDModel):
    """Rôle d'un membre du personnel. Sans profil actif, un compte « staff » n'a aucun droit (voir permissions.py)."""
    user              = models.OneToOneField(User, on_delete=models.CASCADE, related_name='staff_profile')
    role              = models.CharField(max_length=20, default='support')
    extra_permissions = models.JSONField(default=dict, blank=True, help_text="Ajustements individuels : {droit: true/false}")
    is_active         = models.BooleanField(default=True)
    created_by        = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_staff')
    created_at        = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.user.email} ({self.role})'


class AuditLog(UUIDModel):
    """Journal des actions du personnel (qui a fait quoi, quand). Lisible par la propriétaire seulement.
    Aucun corps de requête n'est enregistré : jamais de mot de passe ni de donnée personnelle dans le journal."""
    actor       = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_entries')
    actor_label = models.CharField(max_length=254, help_text="E-mail au moment de l'action (reste lisible si le compte est supprimé)")
    area        = models.CharField(max_length=20, blank=True)
    action      = models.CharField(max_length=12, db_index=True)   # created / updated / deleted / denied / login
    summary     = models.CharField(max_length=300)
    object_type = models.CharField(max_length=40, blank=True)
    object_id   = models.CharField(max_length=40, blank=True)
    status_code = models.PositiveSmallIntegerField(default=200)
    created_at  = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['actor', '-created_at'], name='audit_actor_date_idx')]

    def __str__(self):
        return f'{self.created_at:%d/%m/%Y %H:%M} {self.actor_label} — {self.summary}'
