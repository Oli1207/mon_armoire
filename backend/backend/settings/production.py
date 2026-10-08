from .base import *

DEBUG = False

# Refus de démarrer avec une clé faible ou d'exemple : générer une clé avec
#   python -c "from django.core.management.utils import get_random_secret_key as k; print(k())"
if len(SECRET_KEY) < 50 or SECRET_KEY.startswith('django-insecure') or 'change-me' in SECRET_KEY:
    raise RuntimeError("SECRET_KEY trop faible ou d'exemple : définissez une clé aléatoire de 50 caractères minimum dans .env.")

ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=[
    'monarmoire.com',
    'www.monarmoire.com',
    'backend.monarmoire.com',
])

CORS_ALLOWED_ORIGINS = env.list('CORS_ALLOWED_ORIGINS', default=[
    'https://monarmoire.com',
    'https://www.monarmoire.com',
])
CSRF_TRUSTED_ORIGINS = env.list('CSRF_TRUSTED_ORIGINS', default=[
    'https://monarmoire.com',
    'https://www.monarmoire.com',
    'https://backend.monarmoire.com',
])

# L'API s'authentifie par jeton Bearer, pas par cookie : pas besoin d'envoyer les cookies en cross-origin.
CORS_ALLOW_CREDENTIALS = False

# ── Sécurité HTTP ─────────────────────────────────────────────────────────────
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY      = 'strict-origin-when-cross-origin'
X_FRAME_OPTIONS             = 'DENY'

# HSTS : 1 an. Ne pas activer includeSubdomains/preload tant que tous les sous-domaines
# (webmail, etc.) ne sont pas confirmés en HTTPS : c'est difficile à annuler.
SECURE_HSTS_SECONDS            = env.int('SECURE_HSTS_SECONDS', default=31536000)
SECURE_HSTS_INCLUDE_SUBDOMAINS = env.bool('SECURE_HSTS_INCLUDE_SUBDOMAINS', default=False)
SECURE_HSTS_PRELOAD            = False

SECURE_SSL_REDIRECT = True
# À activer (SECURE_PROXY_SSL_HEADER_ENABLED=True) uniquement si, après déploiement, le site boucle en
# redirection HTTPS : cela indique qu'Apache transmet le schéma via X-Forwarded-Proto.
if env.bool('SECURE_PROXY_SSL_HEADER_ENABLED', default=False):
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

SESSION_COOKIE_SECURE   = True
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_SECURE      = True

# Médias servis par Apache depuis le dossier public du site principal (MEDIA_ROOT=/home/<login>/public_html/media) :
# URL absolue, car l'API (backend.monarmoire.com) et le site (monarmoire.com) sont deux domaines.
MEDIA_URL = env.str('MEDIA_URL', default='https://monarmoire.com/media/')

# ── Fichiers statiques : servis par WhiteNoise (admin Django) ────────────────
STATICFILES_DIRS = []

CONTACT_RECIPIENT = 'contact@monarmoire.com'
