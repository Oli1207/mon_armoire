from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Exists, OuterRef
from django.utils import timezone

from analytics.models import EVENT_RETENTION_DAYS, TrackEvent, VisitSession
from userauths.models import AuditLog

AUDIT_RETENTION_DAYS = 730
BATCH = 5000


class Command(BaseCommand):
    help = (
        f"Supprime les événements de navigation de plus de {EVENT_RETENTION_DAYS} jours (les chiffres journaliers sont conservés), "
        f"les visites devenues vides et le journal de plus de {AUDIT_RETENTION_DAYS} jours. À lancer chaque nuit (cron)."
    )

    def handle(self, *args, **options):
        now = timezone.now()
        deleted = 0
        cutoff = now - timedelta(days=EVENT_RETENTION_DAYS)
        while True:   # par paquets : jamais une requête géante sur l'hébergement mutualisé
            ids = list(TrackEvent.objects.filter(created_at__lt=cutoff).values_list('id', flat=True)[:BATCH])
            if not ids:
                break
            deleted += TrackEvent.objects.filter(id__in=ids).delete()[0]
        sessions = VisitSession.objects.filter(last_seen__lt=cutoff).exclude(Exists(TrackEvent.objects.filter(session=OuterRef('pk')))).delete()[0]
        logs = AuditLog.objects.filter(created_at__lt=now - timedelta(days=AUDIT_RETENTION_DAYS)).delete()[0]
        self.stdout.write(f'{deleted} événement(s), {sessions} visite(s) vide(s) et {logs} ligne(s) de journal supprimés.')
