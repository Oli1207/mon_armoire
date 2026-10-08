import time

from django.core.management.base import BaseCommand
from django.db.models import Q

from catalog.emails import send_restock_notification
from catalog.models import WaitlistEntry
from notifications.push import send_push


class Command(BaseCommand):
    help = (
        "Prévient les personnes en liste d'attente dont le bijou est de nouveau en stock, par e-mail et, si elles ont accepté, "
        "par notification (cron toutes les 30 minutes). Les rappels par téléphone/WhatsApp se font à la main depuis l'Admin."
    )

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=100, help="Nombre maximum de personnes traitées par exécution (limite horaire d'envoi d'e-mails de l'hébergement).")
        parser.add_argument('--max-seconds', type=int, default=600, help="Durée maximale d'exécution (hébergement mutualisé).")

    def handle(self, *args, **options):
        deadline = time.monotonic() + options['max_seconds']
        pending = (
            WaitlistEntry.objects
            .filter(variant__stock__gt=0, variant__product__is_active=True)
            .filter(Q(notified=False) | Q(push_subscription__isnull=False, push_notified=False))
            .select_related('variant__product', 'push_subscription').order_by('created_at')
        )
        emails = pushes = failed = 0
        for entry in pending[:options['limit']]:
            if time.monotonic() > deadline:
                break
            if not entry.notified:
                try:
                    send_restock_notification(entry)
                    WaitlistEntry.objects.filter(pk=entry.pk).update(notified=True)
                    emails += 1
                except Exception:  # noqa: BLE001 : e-mail refusé ou serveur indisponible : on réessaiera à la prochaine exécution
                    failed += 1
            if entry.push_subscription and not entry.push_notified:
                product = entry.variant.product
                result = send_push(
                    entry.push_subscription, 'De retour en stock — Mon Armoire',
                    f'« {product.name} » est de nouveau disponible.', f'/produits/{product.slug}',
                )
                if result == 'gone':
                    entry.push_subscription.delete()   # le lien se met à NULL ; l'e-mail reste le canal principal
                if result in ('sent', 'gone'):
                    WaitlistEntry.objects.filter(pk=entry.pk).update(push_notified=True)
                    pushes += result == 'sent'
                else:
                    failed += 1
        self.stdout.write(f'{emails} e-mail(s) et {pushes} notification(s) envoyé(s), {failed} échec(s).')
