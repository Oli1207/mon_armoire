import secrets

from django.core.exceptions import ValidationError
from django.db import models

from common.models import UUIDModel
from userauths.models import User, Address
from catalog.models import ProductVariant
from coffrets.models import CoffretConfiguration

ORDER_STATUS_CHOICES = [
    ('pending',    'En attente de paiement'),
    ('paid',       'Payée'),
    ('processing', 'En préparation'),
    ('shipped',    'Expédiée'),
    ('delivered',  'Livrée'),
    ('cancelled',  'Annulée'),
]

DELIVERY_METHOD_CHOICES = [
    ('shipping', 'Livraison'),
    ('pickup',   'Retrait en boutique'),
]


GIFT_CARD_STATUS_CHOICES = [
    ('pending',   'En attente de paiement'),
    ('active',    'Active'),
    ('used',      'Épuisée'),
    ('cancelled', 'Annulée'),
]


# Alphabet sans caractères ambigus (0/O, 1/I) : lisible au téléphone, saisissable sans erreur.
_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'


def _random_code(length):
    return ''.join(secrets.choice(_CODE_ALPHABET) for _ in range(length))


def generate_order_number():
    return 'MA-' + _random_code(12)


def generate_giftcard_code():
    return 'CADEAU-' + _random_code(12)


# ── Zone de livraison ────────────────────────────────────────────────────────
class DeliveryZone(UUIDModel):
    name               = models.CharField(max_length=100)
    shipping_cost      = models.DecimalField(max_digits=10, decimal_places=2)
    estimated_days_min = models.PositiveSmallIntegerField(default=1)
    estimated_days_max = models.PositiveSmallIntegerField(default=3)
    is_active          = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


# ── Panier ────────────────────────────────────────────────────────────────────
class Cart(UUIDModel):
    user        = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='carts')
    session_key = models.CharField(max_length=100, blank=True, help_text="Panier invité, avant connexion")
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Panier — {self.user.email if self.user else self.session_key}'

    @property
    def total(self):
        return sum((item.subtotal for item in self.items.all()), start=0)


class CartItem(UUIDModel):
    cart                  = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name='items')
    variant               = models.ForeignKey(ProductVariant, on_delete=models.CASCADE, null=True, blank=True, related_name='cart_items')
    coffret_configuration = models.ForeignKey(CoffretConfiguration, on_delete=models.CASCADE, null=True, blank=True, related_name='cart_items')
    quantity              = models.PositiveSmallIntegerField(default=1)
    gift_wrap             = models.BooleanField(default=False)
    gift_message          = models.TextField(blank=True)
    engraving_text        = models.CharField(max_length=60, blank=True, help_text="Texte de gravure/personnalisation")
    added_at              = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['added_at']

    def clean(self):
        if bool(self.variant) == bool(self.coffret_configuration):
            raise ValidationError(
                "Un article de panier doit référencer soit une variante produit, "
                "soit un coffret configuré — jamais les deux ni aucun des deux."
            )

    @property
    def unit_price(self):
        return self.variant.price if self.variant else self.coffret_configuration.total_price

    @property
    def subtotal(self):
        return self.unit_price * self.quantity

    def __str__(self):
        return f'{self.quantity} × {self.variant or self.coffret_configuration}'


# ── Commande ──────────────────────────────────────────────────────────────────
class Order(UUIDModel):
    order_number    = models.CharField(max_length=20, unique=True, default=generate_order_number, editable=False)
    user            = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='orders')
    guest_email     = models.EmailField(blank=True, help_text="Email de contact pour une commande passée sans compte")
    status          = models.CharField(max_length=20, choices=ORDER_STATUS_CHOICES, default='pending')
    delivery_method = models.CharField(max_length=20, choices=DELIVERY_METHOD_CHOICES, default='shipping')
    address         = models.ForeignKey(Address, on_delete=models.SET_NULL, null=True, blank=True, related_name='orders')
    delivery_zone   = models.ForeignKey(DeliveryZone, on_delete=models.SET_NULL, null=True, blank=True, related_name='orders')
    subtotal        = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    shipping_cost   = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    gift_card       = models.ForeignKey('GiftCard', on_delete=models.SET_NULL, null=True, blank=True, related_name='redeemed_in_orders',
                                         help_text="Carte cadeau utilisée pour régler (tout ou partie de) cette commande")
    gift_card_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text="Montant déduit via la carte cadeau")
    loyalty_points_used     = models.PositiveIntegerField(default=0)
    loyalty_discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text="Montant déduit via les points de fidélité")
    total           = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', '-created_at'], name='order_status_created_idx'),
            models.Index(fields=['user', '-created_at'], name='order_user_created_idx'),
            models.Index(fields=['guest_email'], name='order_guest_email_idx'),
        ]

    def __str__(self):
        return self.order_number

    @property
    def contact_email(self):
        return self.user.email if self.user else self.guest_email


class OrderItem(UUIDModel):
    order                 = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    variant               = models.ForeignKey(ProductVariant, on_delete=models.SET_NULL, null=True, blank=True, related_name='order_items')
    coffret_configuration = models.ForeignKey(CoffretConfiguration, on_delete=models.SET_NULL, null=True, blank=True, related_name='order_items')
    product_name          = models.CharField(max_length=250, help_text="Copie du nom au moment de l'achat (historique)")
    quantity              = models.PositiveSmallIntegerField(default=1)
    unit_price            = models.DecimalField(max_digits=10, decimal_places=2)
    gift_wrap             = models.BooleanField(default=False)
    gift_message          = models.TextField(blank=True)
    engraving_text        = models.CharField(max_length=60, blank=True, help_text="Texte de gravure/personnalisation")

    @property
    def subtotal(self):
        return self.unit_price * self.quantity

    def __str__(self):
        return f'{self.quantity} × {self.product_name}'


class OrderStatusHistory(UUIDModel):
    order      = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='status_history')
    status     = models.CharField(max_length=20, choices=ORDER_STATUS_CHOICES)
    note       = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        verbose_name_plural = 'Order status histories'

    def __str__(self):
        return f'{self.order.order_number} → {self.status}'


class Payment(UUIDModel):
    order          = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='payments')
    provider       = models.CharField(max_length=50, help_text="Ex: orange_money, mtn_money, wave, cinetpay")
    transaction_id = models.CharField(max_length=150, blank=True)
    amount         = models.DecimalField(max_digits=10, decimal_places=2)
    status         = models.CharField(max_length=20, default='pending')
    raw_response   = models.JSONField(blank=True, null=True)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['provider', 'transaction_id'], name='payment_provider_txn_idx')]

    def __str__(self):
        return f'{self.order.order_number} — {self.provider} ({self.status})'


# ── Carte cadeau ──────────────────────────────────────────────────────────────
class GiftCard(UUIDModel):
    code            = models.CharField(max_length=30, unique=True, default=generate_giftcard_code, editable=False)
    purchase_order  = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='gift_card_purchase',
                                            help_text="Commande via laquelle cette carte a été achetée et payée")
    initial_value   = models.DecimalField(max_digits=10, decimal_places=2)
    balance         = models.DecimalField(max_digits=10, decimal_places=2)
    purchaser_name  = models.CharField(max_length=200, blank=True)
    purchaser_email = models.EmailField(blank=True)
    recipient_name  = models.CharField(max_length=200, blank=True)
    recipient_email = models.EmailField(blank=True)
    message         = models.TextField(blank=True)
    status          = models.CharField(max_length=20, choices=GIFT_CARD_STATUS_CHOICES, default='pending')
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['status'], name='giftcard_status_idx')]

    def __str__(self):
        return f'{self.code} — {self.balance} FCFA'


# ── Fidélité ──────────────────────────────────────────────────────────────────
LOYALTY_REASON_CHOICES = [
    ('earned',   'Points gagnés'),
    ('redeemed', 'Points utilisés'),
    ('referral', 'Parrainage'),
    ('adjusted', 'Ajustement manuel'),
]

LOYALTY_EARN_RATE   = 1000  # 1 point par tranche de 1 000 FCFA dépensés (hors livraison)
LOYALTY_POINT_VALUE = 100   # 1 point = 100 FCFA de réduction


class LoyaltyTransaction(UUIDModel):
    user       = models.ForeignKey(User, on_delete=models.CASCADE, related_name='loyalty_transactions')
    order      = models.ForeignKey(Order, on_delete=models.SET_NULL, null=True, blank=True, related_name='loyalty_transactions')
    points     = models.IntegerField(help_text="Positif = gagnés, négatif = utilisés")
    reason     = models.CharField(max_length=20, choices=LOYALTY_REASON_CHOICES)
    note       = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['user', '-created_at'], name='loyalty_user_created_idx')]

    def __str__(self):
        sign = '+' if self.points >= 0 else ''
        return f'{self.user.email} — {sign}{self.points} pts ({self.get_reason_display()})'
