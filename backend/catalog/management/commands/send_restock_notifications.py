from django.core.management.base import BaseCommand
from django.db import transaction

from catalog.emails import send_restock_notification
from catalog.models import WaitlistEntry


class Command(BaseCommand):
    help = "Prévient les personnes en liste d'attente dont le bijou est de nouveau en stock (cron toutes les 30 minutes)."

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=100, help="Nombre maximum d'e-mails par exécution (limite horaire d'envoi de l'hébergement).")

    def handle(self, *args, **options):
        pending = (
            WaitlistEntry.objects
            .filter(notified=False, variant__stock__gt=0, variant__product__is_active=True)
            .select_related('variant__product').order_by('created_at')
        )
        sent = failed = 0
        for entry in pending[:options['limit']]:
            try:
                send_restock_notification(entry)
            except Exception:  # noqa: BLE001 : e-mail refusé ou serveur indisponible : on réessaiera à la prochaine exécution
                failed += 1
                continue
            with transaction.atomic():
                WaitlistEntry.objects.filter(pk=entry.pk).update(notified=True)
            sent += 1
        self.stdout.write(f'{sent} e-mail(s) envoyé(s), {failed} échec(s).')
