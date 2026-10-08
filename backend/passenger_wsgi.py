"""
Point d'entrée Phusion Passenger — backend.monarmoire.store
===========================================================
- Chemin dynamique via __file__ (pas de login hardcodé)
- Si Django ne démarre pas, le détail de l'erreur est écrit dans logs/startup_error.log
  (jamais renvoyé au visiteur : un traceback public révèle chemins, versions et configuration).
"""

import os
import sys
import traceback
from pathlib import Path

# Dossier contenant manage.py (= dossier de ce fichier)
PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

os.environ['DJANGO_SETTINGS_MODULE'] = 'backend.settings.production'

try:
    from django.core.wsgi import get_wsgi_application
    application = get_wsgi_application()
except Exception:
    try:
        log_dir = PROJECT_ROOT / 'logs'
        log_dir.mkdir(exist_ok=True)
        (log_dir / 'startup_error.log').write_text(traceback.format_exc(), encoding='utf-8')
    except OSError:
        pass

    body = b'{"error": "Service temporairement indisponible."}'

    def application(environ, start_response):
        start_response('503 Service Unavailable', [
            ('Content-Type', 'application/json'),
            ('Content-Length', str(len(body))),
            ('Retry-After', '60'),
        ])
        return [body]
