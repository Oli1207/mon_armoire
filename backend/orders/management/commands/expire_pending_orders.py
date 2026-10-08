from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from orders.models import Order
from orders.services import cancel_unpaid_order


class Command(BaseCommand):
    help = "Annule les commandes non payées depuis trop longtemps et restitue cartes cadeaux / points (à lancer par cron, ex. toutes les heures)."

    def add_arguments(self, parser):
        parser.add_argument('--hours', type=int, default=24)
        parser.add_argument('--limit', type=int, default=500)

    def handle(self, *args, **options):
        cutoff = timezone.now() - timedelta(hours=options['hours'])
        stale = Order.objects.filter(status='pending', created_at__lt=cutoff).order_by('created_at')[:options['limit']]
        cancelled = 0
        for order in stale:
            if cancel_unpaid_order(order, note=f"Annulée automatiquement : non payée après {options['hours']} h."):
                cancelled += 1
        self.stdout.write(f'{cancelled} commande(s) annulée(s).')
