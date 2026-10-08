from django.db import models
from django.utils.text import slugify

from common.models import UUIDModel
from catalog.models import Category, ProductVariant


# ── Coffret (produit composite) ──────────────────────────────────────────────
class Coffret(UUIDModel):
    name        = models.CharField(max_length=200)
    slug        = models.SlugField(max_length=220, unique=True, blank=True)
    description = models.TextField(blank=True)
    image       = models.ImageField(upload_to='coffrets/', blank=True, null=True)
    box_price   = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text="Prix du contenant, hors articles choisis")
    is_active   = models.BooleanField(default=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    # ── Comportement côté client ─────────────────────────────────────────────
    show_contents       = models.BooleanField(default=True, help_text="La cliente voit-elle le détail du contenu du coffret ?")
    show_item_prices    = models.BooleanField(default=True, help_text="Afficher le prix de chaque élément (sinon seul le prix total du coffret est visible)")
    allow_customization = models.BooleanField(default=True, help_text="La cliente peut-elle retirer des éléments inclus ou en ajouter d'autres ?")

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

    @property
    def starting_price(self):
        Decimal = self.box_price.__class__
        included_total = sum((i.variant.price * i.quantity for i in self.included_items.all()), start=Decimal(0))
        return self.box_price + included_total


# ── Élément inclus par défaut dans le coffret ────────────────────────────────
class CoffretItem(UUIDModel):
    coffret  = models.ForeignKey(Coffret, on_delete=models.CASCADE, related_name='included_items')
    variant  = models.ForeignKey(ProductVariant, on_delete=models.PROTECT, related_name='coffret_inclusions')
    quantity = models.PositiveSmallIntegerField(default=1)
    order    = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f'{self.coffret.name} — {self.variant} × {self.quantity}'


# ── Emplacement à remplir dans le coffret ────────────────────────────────────
class CoffretSlot(UUIDModel):
    coffret          = models.ForeignKey(Coffret, on_delete=models.CASCADE, related_name='slots')
    label            = models.CharField(max_length=200, help_text="Ex: Choisissez un collier")
    allowed_category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True, related_name='coffret_slots')
    min_select       = models.PositiveSmallIntegerField(default=1)
    max_select       = models.PositiveSmallIntegerField(default=1)
    order            = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f'{self.coffret.name} — {self.label}'


# ── Coffret configuré par un client (instance concrète) ──────────────────────
class CoffretConfiguration(UUIDModel):
    coffret       = models.ForeignKey(Coffret, on_delete=models.PROTECT, related_name='configurations')
    removed_items = models.ManyToManyField(CoffretItem, blank=True, related_name='removed_in_configurations',
                                            help_text="Éléments inclus par défaut que la cliente a retirés")
    created_at    = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Coffret configuré — {self.coffret.name} ({self.id})'

    @property
    def kept_included_items(self):
        removed_ids = {i.id for i in self.removed_items.all()}  # .all() : exploite prefetch_related
        return [i for i in self.coffret.included_items.all() if i.id not in removed_ids]

    @property
    def total_price(self):
        Decimal = self.coffret.box_price.__class__
        included_total = sum((i.variant.price * i.quantity for i in self.kept_included_items), start=Decimal(0))
        chosen_total = sum((item.variant.price * item.quantity for item in self.items.all()), start=Decimal(0))
        return self.coffret.box_price + included_total + chosen_total


class CoffretConfigurationItem(UUIDModel):
    configuration = models.ForeignKey(CoffretConfiguration, on_delete=models.CASCADE, related_name='items')
    slot          = models.ForeignKey(CoffretSlot, on_delete=models.PROTECT, null=True, blank=True, related_name='chosen_items',
                                       help_text="Vide si ajouté librement par la cliente (hors emplacement prédéfini)")
    variant       = models.ForeignKey(ProductVariant, on_delete=models.PROTECT, related_name='coffret_items')
    quantity      = models.PositiveSmallIntegerField(default=1)

    def __str__(self):
        return f'{self.slot.label if self.slot else "Ajout libre"} → {self.variant}'
