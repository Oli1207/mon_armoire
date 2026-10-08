import time
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.core.management.base import BaseCommand
from django.utils import timezone

from common.models import SiteSettings
from notifications.models import Alert, PushSubscription
from notifications.push import send_push
from userauths.models import User
from userauths.permissions import effective_permissions

MAX_ATTEMPTS = 5
KEEP_DAYS = 14


class Command(BaseCommand):
    help = (
        "Envoie les alertes en attente : nouvelle commande, stock bas, nouvel avis… à l'équipe (notification + e-mail), "
        "et le suivi de commande aux clientes qui l'ont accepté. Cron toutes les 5 minutes."
    )

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=200)
        parser.add_argument('--max-seconds', type=int, default=240, help="Durée maximale (hébergement mutualisé).")

    def staff_subscriptions(self, perm, cache):
        if perm not in cache:
            ids = [u.pk for u in User.objects.filter(is_staff=True, is_active=True) if perm in effective_permissions(u)]
            cache[perm] = list(PushSubscription.objects.filter(user_id__in=ids))
        return cache[perm]

    def deliver(self, alert, cache, notify_email):
        subscriptions = list(PushSubscription.objects.filter(user_id=alert.user_id)) if alert.user_id else self.staff_subscriptions(alert.perm, cache)
        failed = False
        if not alert.pushed:
            for sub in subscriptions:
                result = send_push(sub, alert.title, alert.body, alert.url)
                if result == 'gone':
                    sub.delete()
                elif result == 'failed':
                    failed = True
            if not failed:
                Alert.objects.filter(pk=alert.pk).update(pushed=True)
        if not alert.user_id and notify_email and not alert.emailed:
            try:
                send_mail(
                    subject=f'[Mon Armoire] {alert.title}', message=f'{alert.body}\n\nOuvrir l’Admin : {settings.FRONTEND_URL}{alert.url}',
                    from_email=settings.DEFAULT_FROM_EMAIL, recipient_list=[notify_email], fail_silently=False,
                )
                Alert.objects.filter(pk=alert.pk).update(emailed=True)
            except Exception:  # noqa: BLE001 : on réessaiera au prochain passage
                failed = True
        return not failed

    def handle(self, *args, **options):
        deadline = time.monotonic() + options['max_seconds']
        notify_email = SiteSettings.load().notify_email
        cache, sent, retried, gave_up = {}, 0, 0, 0
        pending = Alert.objects.filter(done_at__isnull=True).order_by('created_at')[:options['limit']]
        for alert in pending:
            if time.monotonic() > deadline:
                break
            if self.deliver(alert, cache, notify_email):
                Alert.objects.filter(pk=alert.pk).update(done_at=timezone.now())
                sent += 1
            elif alert.attempts + 1 >= MAX_ATTEMPTS:
                Alert.objects.filter(pk=alert.pk).update(done_at=timezone.now(), attempts=alert.attempts + 1)
                gave_up += 1
            else:
                Alert.objects.filter(pk=alert.pk).update(attempts=alert.attempts + 1)
                retried += 1
        purged = Alert.objects.filter(done_at__lt=timezone.now() - timedelta(days=KEEP_DAYS)).delete()[0]
        self.stdout.write(f'{sent} alerte(s) envoyée(s), {retried} à réessayer, {gave_up} abandonnée(s), {purged} ancienne(s) supprimée(s).')
