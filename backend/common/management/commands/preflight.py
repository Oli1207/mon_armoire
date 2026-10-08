"""Contrôle de mise en ligne : `python manage.py preflight` (à lancer sur le serveur LWS après chaque déploiement)."""
import os
import tempfile
from pathlib import Path
from urllib.parse import urlparse

from django.conf import settings
from django.core.cache import cache
from django.core.mail import send_mail
from django.core.management.base import BaseCommand
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

OK, WARN, FAIL = 'ok', 'warn', 'fail'
MIN_PG_VERSION = 130000  # PostgreSQL 13 (version de LWS) ; Django 5.1 : PG 13 minimum


def _writable(directory):
    try:
        Path(directory).mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=directory):
            pass
        return True
    except OSError:
        return False


def run_checks():
    """Retourne une liste de (niveau, message)."""
    results = []

    def add(level, message):
        results.append((level, message))

    # ── Configuration Django ────────────────────────────────────────────────
    add(FAIL if settings.DEBUG else OK, 'DEBUG désactivé' if not settings.DEBUG else 'DEBUG est activé (jamais en production)')
    key = settings.SECRET_KEY
    weak = len(key) < 50 or key.startswith('django-insecure') or 'change-me' in key
    add(FAIL if weak else OK, 'SECRET_KEY solide' if not weak else 'SECRET_KEY faible ou d\'exemple')
    hosts = [h for h in settings.ALLOWED_HOSTS if h not in ('*', '')]
    add(OK if hosts and '*' not in settings.ALLOWED_HOSTS else FAIL, f'ALLOWED_HOSTS : {", ".join(settings.ALLOWED_HOSTS) or "vide"}')
    https_only = all(urlparse(o).scheme == 'https' for o in list(settings.CORS_ALLOWED_ORIGINS) + [settings.FRONTEND_URL])
    add(OK if https_only else FAIL, 'FRONTEND_URL et CORS en HTTPS' if https_only else 'FRONTEND_URL ou CORS_ALLOWED_ORIGINS pas en HTTPS')

    # ── Base de données ─────────────────────────────────────────────────────
    try:
        with connection.cursor() as cursor:
            cursor.execute('SHOW server_version_num')
            version = int(cursor.fetchone()[0])
            cursor.execute("SELECT count(*) FROM pg_extension WHERE extname = 'pg_trgm'")
            trigram = cursor.fetchone()[0] > 0
        add(OK if version >= MIN_PG_VERSION else FAIL, f'PostgreSQL {version // 10000}.{version % 10000} joignable')
        add(OK if trigram else FAIL, 'extension pg_trgm (recherche) installée' if trigram else 'extension pg_trgm absente (la recherche échouera)')
        pending = MigrationExecutor(connection).migration_plan(MigrationExecutor(connection).loader.graph.leaf_nodes())
        add(OK if not pending else FAIL, 'migrations à jour' if not pending else f'{len(pending)} migration(s) non appliquée(s) : lancer « python manage.py migrate »')
    except Exception as exc:  # noqa: BLE001 : on veut le message, quel qu'il soit
        add(FAIL, f'base de données inaccessible : {exc}')

    # ── Cache, médias, journaux, statique ───────────────────────────────────
    try:
        cache.set('preflight', '1', 10)
        add(OK if cache.get('preflight') == '1' else FAIL, 'cache (compteurs de limitation de débit) fonctionnel')
    except Exception as exc:  # noqa: BLE001
        add(FAIL, f'cache inutilisable : {exc}')
    add(OK if _writable(settings.MEDIA_ROOT) else FAIL, f'MEDIA_ROOT accessible en écriture ({settings.MEDIA_ROOT})')
    absolute_media = urlparse(settings.MEDIA_URL).scheme == 'https'
    add(OK if absolute_media else FAIL, f'MEDIA_URL absolue en HTTPS ({settings.MEDIA_URL})')
    add(OK if _writable(settings.LOG_DIR) else FAIL, f'LOG_DIR accessible en écriture ({settings.LOG_DIR})')
    static_root = Path(settings.STATIC_ROOT)
    static_ready = static_root.exists() and any(static_root.iterdir())
    add(OK if static_ready else WARN, 'fichiers statiques collectés' if static_ready else 'collectstatic pas encore lancé (admin Django sans style)')

    # ── Services externes ───────────────────────────────────────────────────
    mail_ready = bool(settings.EMAIL_HOST) and 'console' not in settings.EMAIL_BACKEND
    add(OK if mail_ready else FAIL, f'e-mail : {settings.EMAIL_HOST}:{settings.EMAIL_PORT}' if mail_ready else 'e-mail non configuré (backend console)')
    add(OK if os.path.exists(settings.VAPID_PRIVATE_KEY) and settings.VAPID_PUBLIC_KEY else WARN,
        'clés des notifications push présentes' if os.path.exists(settings.VAPID_PRIVATE_KEY) and settings.VAPID_PUBLIC_KEY
        else 'clés VAPID manquantes (verset du jour par notification indisponible)')
    for name, keys in (('GeniusPay (mobile money)', ('GENIUSPAY_SECRET_KEY', 'GENIUSPAY_WEBHOOK_SECRET')),
                       ('Paystack (carte)', ('PAYSTACK_SECRET_KEY',))):
        missing = [k for k in keys if not getattr(settings, k, '')]
        add(OK if not missing else FAIL, f'{name} configuré' if not missing else f'{name} : {", ".join(missing)} manquant(s) : les paiements ne seront pas confirmés')
    return results


class Command(BaseCommand):
    help = "Vérifie que le serveur est prêt (base, migrations, cache, médias, e-mail, paiements). Code de sortie 1 s'il y a une erreur."

    def add_arguments(self, parser):
        parser.add_argument('--send-test-mail', metavar='ADRESSE', help="Envoie aussi un e-mail de test à cette adresse.")

    def handle(self, *args, **options):
        icons = {OK: self.style.SUCCESS('  OK  '), WARN: self.style.WARNING(' ATTN '), FAIL: self.style.ERROR(' ECHEC')}
        results = run_checks()
        if options['send_test_mail']:
            try:
                send_mail('Mon Armoire — test d\'envoi', 'Si vous lisez ceci, l\'envoi d\'e-mails fonctionne.',
                          settings.DEFAULT_FROM_EMAIL, [options['send_test_mail']])
                results.append((OK, f"e-mail de test envoyé à {options['send_test_mail']}"))
            except Exception as exc:  # noqa: BLE001
                results.append((FAIL, f"envoi d'e-mail impossible : {exc}"))
        for level, message in results:
            self.stdout.write(f'[{icons[level]}] {message}')
        failures = sum(1 for level, _ in results if level == FAIL)
        warnings = sum(1 for level, _ in results if level == WARN)
        self.stdout.write('')
        if failures:
            self.stdout.write(self.style.ERROR(f'{failures} problème(s) à corriger avant d\'ouvrir le site.'))
            raise SystemExit(1)
        self.stdout.write(self.style.SUCCESS('Prêt.' + (f' ({warnings} avertissement(s))' if warnings else '')))
