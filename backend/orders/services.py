from django.db import transaction

from .emails import send_order_status_email
from .giftcards import activate_gift_card_if_purchase
from .loyalty import award_points_for_order, award_referral_bonus
from .models import GiftCard, LoyaltyTransaction, Order, OrderStatusHistory
from .stock import decrement_stock_for_order


def mark_order_paid(order, note='Paiement confirmé.', notify=True):
    """Passe une commande en « payée » une seule fois, même si plusieurs appels arrivent en même temps
    (webhook + retour client + admin). Retourne True si cet appel a effectué la transition."""
    with transaction.atomic():
        locked = Order.objects.select_for_update().get(pk=order.pk)
        if locked.status != 'pending':
            order.status = locked.status
            return False

        locked.status = 'paid'
        locked.save(update_fields=['status', 'updated_at'])
        OrderStatusHistory.objects.create(order=locked, status='paid', note=note)

        shortages = decrement_stock_for_order(locked)
        if shortages:
            OrderStatusHistory.objects.create(
                order=locked, status='paid',
                note='Stock insuffisant à traiter manuellement : ' + ', '.join(sorted(set(shortages)))[:200],
            )
        activate_gift_card_if_purchase(locked)
        award_points_for_order(locked)
        award_referral_bonus(locked)

        if notify:
            transaction.on_commit(lambda: send_order_status_email(locked, note=note))

    order.status = 'paid'
    return True


def cancel_unpaid_order(order, note='Commande annulée.'):
    """Annule une commande en attente de paiement et restitue la carte cadeau / les points utilisés."""
    with transaction.atomic():
        locked = Order.objects.select_for_update().get(pk=order.pk)
        if locked.status != 'pending':
            return False

        locked.status = 'cancelled'
        locked.save(update_fields=['status', 'updated_at'])
        OrderStatusHistory.objects.create(order=locked, status='cancelled', note=note)

        if locked.gift_card_id and locked.gift_card_amount > 0:
            card = GiftCard.objects.select_for_update().get(pk=locked.gift_card_id)
            card.balance += locked.gift_card_amount
            if card.status == 'used':
                card.status = 'active'
            card.save(update_fields=['balance', 'status'])

        if locked.loyalty_points_used and locked.user_id:
            LoyaltyTransaction.objects.create(
                user=locked.user, order=locked, points=locked.loyalty_points_used, reason='adjusted',
                note=f'Restitution — commande {locked.order_number} annulée',
            )

    order.status = 'cancelled'
    return True
