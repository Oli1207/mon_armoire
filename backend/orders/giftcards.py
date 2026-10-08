from django.db import transaction

from .emails import send_giftcard_email


def activate_gift_card_if_purchase(order):
    """Si cette commande a acheté une carte cadeau, l'active une fois payée (e-mail envoyé après validation de la transaction)."""
    gift_card = getattr(order, 'gift_card_purchase', None)
    if gift_card and gift_card.status == 'pending':
        gift_card.status = 'active'
        gift_card.save(update_fields=['status'])
        transaction.on_commit(lambda: send_giftcard_email(gift_card))
