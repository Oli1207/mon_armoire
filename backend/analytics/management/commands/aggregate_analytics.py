from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from analytics.services import persist_day


class Command(BaseCommand):
    help = "Calcule les statistiques journalières des visiteurs (aujourd'hui et les jours précédents). À lancer toutes les heures (cron). Idempotent."

    def add_arguments(self, parser):
        parser.add_argument('--days', type=int, default=2, help="Nombre de jours à recalculer, aujourd'hui compris (défaut 2).")

    def handle(self, *args, **options):
        today = timezone.localdate()
        days = max(1, min(options['days'], 120))
        for offset in range(days - 1, -1, -1):
            persist_day(today - timedelta(days=offset))
        self.stdout.write(f'{days} jour(s) recalculé(s).')
