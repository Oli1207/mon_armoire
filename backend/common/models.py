import uuid

from django.db import models


class UUIDModel(models.Model):
    """Base abstraite : id UUID en clé primaire (aucun entier séquentiel exposé)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class SiteSettings(models.Model):
    """Textes et contacts du site, modifiables depuis l'Admin (une seule ligne, toujours pk=1). Les valeurs par défaut sont celles d'origine du site."""
    announcement = models.CharField(max_length=200, blank=True, default="Livraison rapide en Côte d'Ivoire · Emballage cadeau offert · Paiement sécurisé")
    hero_kicker  = models.CharField(max_length=80, blank=True, default='Bijoux & objets chrétiens')
    hero_title   = models.CharField(max_length=80, blank=True, default='Porte ta foi avec élégance')
    hero_text    = models.CharField(max_length=250, blank=True, default='Des bijoux et objets chrétiens pensés pour accompagner votre foi au quotidien.')
    hero_image   = models.ImageField(upload_to='site/', blank=True, null=True)
    footer_text  = models.CharField(max_length=250, blank=True, default='Des bijoux et objets de piété pensés pour accompagner votre foi, au quotidien comme dans les grands moments.')
    tagline      = models.CharField(max_length=120, blank=True, default='Chaque vision mérite de voir le jour')
    contact_email = models.EmailField(blank=True, default='support@monarmoire.store')
    phone        = models.CharField(max_length=30, blank=True, default='+225 07 99 16 73 93')
    whatsapp     = models.CharField(max_length=20, blank=True, help_text="Chiffres seulement, avec l'indicatif (ex : 2250799167393)")
    instagram    = models.URLField(max_length=200, blank=True)
    tiktok       = models.URLField(max_length=200, blank=True)
    facebook     = models.URLField(max_length=200, blank=True)
    youtube      = models.URLField(max_length=200, blank=True)
    location     = models.CharField(max_length=80, blank=True, default="Abidjan, Côte d'Ivoire")
    notify_email = models.EmailField(blank=True, help_text="Adresse (privée) qui reçoit aussi les alertes : nouvelle commande, stock bas, nouvel avis")
    terms_text   = models.TextField(blank=True, max_length=30000, help_text="Conditions générales de vente (texte simple)")
    privacy_text = models.TextField(blank=True, max_length=30000, help_text="Politique de confidentialité (texte simple)")
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = 'Réglages du site'

    def save(self, *args, **kwargs):
        self.pk = 1  # une seule ligne
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        return cls.objects.get_or_create(pk=1)[0]
