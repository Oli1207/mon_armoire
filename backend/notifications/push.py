"""Envoi d'une notification push à un abonné (hors verset du jour, qui a sa propre commande)."""
import json

from django.conf import settings
from pywebpush import WebPushException, webpush

REQUEST_TIMEOUT = 10  # secondes : un service de notification lent ne doit pas bloquer tout l'envoi


def send_push(subscription, title, body, url='/'):
    """'sent', 'gone' (abonnement expiré ou révoqué : à supprimer) ou 'failed' (à réessayer plus tard)."""
    try:
        webpush(
            subscription_info={'endpoint': subscription.endpoint, 'keys': {'p256dh': subscription.p256dh_key, 'auth': subscription.auth_key}},
            data=json.dumps({'title': title, 'body': body, 'url': url}),
            vapid_private_key=settings.VAPID_PRIVATE_KEY, vapid_claims=dict(settings.VAPID_CLAIMS), timeout=REQUEST_TIMEOUT,
        )
        return 'sent'
    except WebPushException as exc:
        return 'gone' if exc.response is not None and exc.response.status_code in (404, 410) else 'failed'
    except Exception:  # noqa: BLE001 : réseau coupé, clé illisible…
        return 'failed'
