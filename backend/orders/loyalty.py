from django.db.models import Sum

from .models import LOYALTY_EARN_RATE, LoyaltyTransaction

REFERRAL_BONUS_POINTS = 20


def get_balance(user):
    if not user:
        return 0
    return user.loyalty_transactions.aggregate(total=Sum('points'))['total'] or 0


def award_points_for_order(order):
    """Crédite des points de fidélité sur le sous-total d'une commande payée (comptes clients uniquement)."""
    if not order.user:
        return
    if LoyaltyTransaction.objects.filter(order=order, reason='earned').exists():
        return
    points = int(order.subtotal // LOYALTY_EARN_RATE)
    if points > 0:
        LoyaltyTransaction.objects.create(
            user=order.user, order=order, points=points, reason='earned',
            note=f'Commande {order.order_number}',
        )


def award_referral_bonus(order):
    """Récompense le parrain à la première commande payée de son filleul."""
    user = order.user
    if not user or not user.referred_by_id or user.referral_rewarded:
        return

    paid_orders_count = user.orders.filter(status__in=['paid', 'processing', 'shipped', 'delivered']).count()
    if paid_orders_count != 1:
        return

    LoyaltyTransaction.objects.create(
        user=user.referred_by, points=REFERRAL_BONUS_POINTS, reason='referral',
        note=f'Filleul(e) {user.full_name or user.email} — première commande {order.order_number}',
    )
    user.referral_rewarded = True
    user.save(update_fields=['referral_rewarded'])
