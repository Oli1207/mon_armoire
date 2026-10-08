import uuid

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils.text import slugify

from common.models import UUIDModel

COLLECTION_KIND_CHOICES = [
    ('style',    'Style'),
    ('occasion', 'Occasion'),
]


# ── Catégorie ─────────────────────────────────────────────────────────────────
class Category(UUIDModel):
    name   = models.CharField(max_length=100)
    slug   = models.SlugField(max_length=120, unique=True, blank=True)
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='subcategories')
    image  = models.ImageField(upload_to='categories/', blank=True, null=True)
    order  = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['order', 'name']
        verbose_name_plural = 'Catégories'

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


# ── Collection (style ou occasion) ───────────────────────────────────────────
class Collection(UUIDModel):
    kind        = models.CharField(max_length=10, choices=COLLECTION_KIND_CHOICES)
    name        = models.CharField(max_length=100)
    slug        = models.SlugField(max_length=120, unique=True, blank=True)
    description = models.TextField(blank=True)
    image       = models.ImageField(upload_to='collections/', blank=True, null=True)
    order       = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['kind', 'order', 'name']

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return f'[{self.get_kind_display()}] {self.name}'


# ── Produit ───────────────────────────────────────────────────────────────────
class Product(UUIDModel):
    category         = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, related_name='products')
    collections      = models.ManyToManyField(Collection, blank=True, related_name='products')
    name             = models.CharField(max_length=200)
    slug             = models.SlugField(max_length=220, unique=True, blank=True)
    description      = models.TextField(blank=True)
    symbolic_meaning = models.TextField(blank=True, help_text="Signification du symbole (croix, médaille, chapelet…)")
    is_active        = models.BooleanField(default=True)
    is_new           = models.BooleanField(default=False)
    is_personalizable = models.BooleanField(default=False, help_text="Permet au client d'ajouter un texte de gravure/personnalisation")
    engraving_max_chars = models.PositiveSmallIntegerField(default=30, validators=[MinValueValidator(1), MaxValueValidator(60)], help_text="Nombre maximum de caractères de la gravure")
    created_at       = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['is_active', '-created_at'], name='product_active_created_idx'),
            models.Index(fields=['is_active', 'is_new'], name='product_active_new_idx'),
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name) or 'produit'
            slug = base
            n = 1
            qs = Product.objects.exclude(pk=self.pk) if self.pk else Product.objects.all()
            while qs.filter(slug=slug).exists():
                slug = f'{base}-{n}'
                n += 1
            self.slug = slug
        super().save(*args, **kwargs)

    # Les propriétés ci-dessous lisent `variants.all()` / `images.all()` : si la vue a fait
    # prefetch_related('variants', 'images'), elles ne coûtent aucune requête (pas de N+1 en liste).
    @property
    def default_variant(self):
        variants = list(self.variants.all())
        return next((v for v in variants if v.is_default), variants[0] if variants else None)

    @property
    def price(self):
        variant = self.default_variant
        return variant.price if variant else None

    @property
    def is_in_stock(self):
        return any(v.stock > 0 for v in self.variants.all())

    def _primary_image(self):
        images = list(self.images.all())
        return next((i for i in images if i.is_main), images[0] if images else None)

    @property
    def main_image(self):
        img = self._primary_image()
        return img.image.url if img else None

    @property
    def main_thumbnail(self):
        """Miniature légère de l'image principale (listes, panier) ; retombe sur l'image complète si absente."""
        img = self._primary_image()
        if not img:
            return None
        return img.thumbnail.url if img.thumbnail else img.image.url

    def __str__(self):
        return self.name


# ── Lookbook / galerie ────────────────────────────────────────────────────────
class LookbookEntry(UUIDModel):
    title       = models.CharField(max_length=150)
    image       = models.ImageField(upload_to='lookbook/')
    description = models.TextField(blank=True)
    products    = models.ManyToManyField('Product', blank=True, related_name='lookbook_entries',
                                          help_text="Bijoux visibles sur la photo (« shoppez le look »)")
    order       = models.PositiveSmallIntegerField(default=0)
    is_active   = models.BooleanField(default=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', '-created_at']
        verbose_name_plural = 'Lookbook'

    def __str__(self):
        return self.title


# ── Images produit ────────────────────────────────────────────────────────────
class ProductImage(UUIDModel):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='images')
    image   = models.ImageField(upload_to='products/')
    thumbnail = models.ImageField(upload_to='products/thumbs/', blank=True, null=True, editable=False)
    is_main = models.BooleanField(default=False)
    order   = models.PositiveSmallIntegerField(default=0)
    engraving_zone = models.JSONField(null=True, blank=True, help_text="Zone d'aperçu de la gravure sur cette photo (voir catalog/engraving.py)")

    class Meta:
        ordering = ['order']
        verbose_name_plural = 'Images produit'

    def __str__(self):
        return f'Image — {self.product.name}'


# ── Variantes produit (couleur / taille / matériau) ──────────────────────────
class ProductVariant(UUIDModel):
    product    = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='variants')
    sku        = models.CharField(max_length=50, unique=True, blank=True)
    color      = models.CharField(max_length=50, blank=True, default='')
    size       = models.CharField(max_length=50, blank=True, default='')
    material   = models.CharField(max_length=100, blank=True, default='')
    price      = models.DecimalField(max_digits=10, decimal_places=2)
    old_price  = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    stock      = models.PositiveIntegerField(default=0)
    image      = models.ImageField(upload_to='variants/', blank=True, null=True, help_text="Laisser vide pour utiliser l'image principale du produit")
    is_default = models.BooleanField(default=False)
    allow_preorder = models.BooleanField(default=False, help_text="Autoriser la commande même en rupture de stock (précommande)")
    restock_note   = models.CharField(max_length=100, blank=True, help_text="Ex : « Retour en stock mi-décembre »")
    engraving_zone = models.JSONField(null=True, blank=True, help_text="Zone d'aperçu de la gravure sur la photo de cette variante")

    class Meta:
        ordering = ['-is_default']
        verbose_name_plural = 'Variantes produit'

    def save(self, *args, **kwargs):
        if not self.sku:
            self.sku = f'{(self.product.slug or "sku")}-{uuid.uuid4().hex[:8]}'.upper()
        super().save(*args, **kwargs)

    @property
    def discount_percent(self):
        if self.old_price and self.old_price > self.price:
            return int((1 - self.price / self.old_price) * 100)
        return 0

    @property
    def label(self):
        parts = [p for p in [self.color, self.size, self.material] if p]
        return ' / '.join(parts) or 'Standard'

    def __str__(self):
        return f'{self.product.name} — {self.label}'


# ── Guide des symboles ───────────────────────────────────────────────────────
class SymbolGuideEntry(UUIDModel):
    name        = models.CharField(max_length=100, help_text="Ex : La Croix, Le Chapelet, La Médaille miraculeuse")
    slug        = models.SlugField(max_length=120, unique=True, blank=True)
    image       = models.ImageField(upload_to='symbols/', blank=True, null=True)
    subtitle    = models.CharField(max_length=200, blank=True, help_text="Courte accroche affichée sur la carte")
    meaning     = models.TextField(help_text="Signification spirituelle détaillée")
    category    = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True, related_name='symbol_entries',
                                     help_text="Catégorie de bijoux associée (bouton « Découvrir »)")
    order       = models.PositiveSmallIntegerField(default=0)
    is_active   = models.BooleanField(default=True)

    class Meta:
        ordering = ['order', 'name']
        verbose_name_plural = 'Guide des symboles'

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


# ── Liste d'attente (produit en rupture) ─────────────────────────────────────
class WaitlistEntry(UUIDModel):
    variant    = models.ForeignKey(ProductVariant, on_delete=models.CASCADE, related_name='waitlist_entries')
    email      = models.EmailField()
    name       = models.CharField(max_length=200, blank=True)
    phone      = models.CharField(max_length=30, blank=True)
    push_subscription = models.ForeignKey('notifications.PushSubscription', on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    notified   = models.BooleanField(default=False, help_text="E-mail de retour en stock envoyé")
    push_notified = models.BooleanField(default=False, help_text="Notification de retour en stock envoyée")
    contacted  = models.BooleanField(default=False, help_text="Relancée à la main (WhatsApp ou appel)")
    contacted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ('variant', 'email')
        indexes = [models.Index(fields=['notified'], name='waitlist_notified_idx')]
        verbose_name_plural = "Liste d'attente"

    def __str__(self):
        return f'{self.email} — {self.variant}'
