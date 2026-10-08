import datetime
import json
import time

from django.conf import settings
from django.core.management.base import BaseCommand
from pywebpush import webpush, WebPushException

from notifications.models import PushSubscription
from notifications.verse_selection import verse_for_date

REQUEST_TIMEOUT = 10  # secondes : un service de notification lent ne doit pas bloquer tout l'envoi


class Command(BaseCommand):
    help = "Envoie le verset du jour en notification push aux abonnés (cron quotidien)."

    def add_arguments(self, parser):
        parser.add_argument('--max-seconds', type=int, default=1200,
                            help="Durée maximale de l'envoi (hébergement mutualisé) : l'envoi s'arrête proprement au-delà.")

    def handle(self, *args, **options):
        verse = verse_for_date(datetime.date.today())
        if not verse:
            self.stdout.write('Aucun verset disponible.')
            return

        payload = json.dumps({
            'title': 'Verset du jour — Mon Armoire',
            'body': f"{verse['text']} — {verse['reference']}",
            'url': '/',
        })

        deadline = time.monotonic() + options['max_seconds']
        sent = failed = removed = 0
        interrupted = False
        # iterator() : pas de chargement de toute la table en mémoire ; ordre stable pour reprendre au même endroit
        for sub in PushSubscription.objects.order_by('id').iterator(chunk_size=200):
            if time.monotonic() > deadline:
                interrupted = True
                break
            try:
                webpush(
                    subscription_info={
                        'endpoint': sub.endpoint,
                        'keys': {'p256dh': sub.p256dh_key, 'auth': sub.auth_key},
                    },
                    data=payload,
                    vapid_private_key=settings.VAPID_PRIVATE_KEY,
                    vapid_claims=dict(settings.VAPID_CLAIMS),
                    timeout=REQUEST_TIMEOUT,
                )
                sent += 1
            except WebPushException as exc:
                failed += 1
                if exc.response is not None and exc.response.status_code in (404, 410):
                    sub.delete()  # abonnement expiré ou révoqué côté navigateur
                    removed += 1
            except Exception:  # noqa: BLE001 : réseau coupé, clé illisible... un abonné en échec ne doit pas arrêter les autres
                failed += 1

        suffix = ' — INTERROMPU (durée maximale atteinte)' if interrupted else ''
        self.stdout.write(f'Verset envoyé à {sent} abonné(s), {failed} échec(s), {removed} abonnement(s) supprimé(s){suffix}.')
