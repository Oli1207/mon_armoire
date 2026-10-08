"""Alertes : mises en file pendant la requête (rapide, sans réseau), envoyées par `send_pending_alerts`.

Équipe : notification sur les appareils où la personne a activé les alertes (écran Admin) + e-mail à l'adresse
« alertes » des réglages du site. Seules les personnes ayant le droit concerné reçoivent l'alerte.
Clientes : notification sur leurs appareils si elles l'ont acceptée (suivi de commande).
"""
import logging

from django.db import transaction

from .models import Alert

logger = logging.getLogger(__name__)

ORDER_PUSH = {
    'paid': ('Paiement reçu', 'Merci ! Nous préparons votre commande.'),
    'processing': ('Commande en préparation', 'Nous emballons votre commande.'),
    'shipped': ('Commande expédiée', 'Votre commande est en route.'),
    'delivered': ('Commande livrée', 'Votre commande est arrivée. Bonne réception !'),
}


def _queue(**fields):
    try:
        with transaction.atomic():   # point de sauvegarde : une erreur ici n'annule jamais la commande en cours
            if not fields.get('user') and Alert.objects.filter(done_at__isnull=True, kind=fields['kind'], body=fields['body']).exists():
                return None   # même alerte déjà en attente : inutile de doubler
            return Alert.objects.create(**fields)
    except Exception:   # une alerte perdue vaut mieux qu'une commande ou un avis refusé
        logger.exception('Alerte : mise en file impossible')
        return None


def queue_staff_alert(kind, perm, title, body, url):
    return _queue(kind=kind, perm=perm, title=title[:100], body=body[:200], url=url)


def queue_order_status_push(order):
    """Notification de suivi à la cliente (si elle a un compte et a accepté les notifications)."""
    message = ORDER_PUSH.get(order.status)
    if message and order.user_id:
        _queue(kind='order_status', user_id=order.user_id, title=message[0], body=f'{message[1]} N° {order.order_number}', url=f'/commandes/{order.order_number}')
