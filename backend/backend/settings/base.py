"""
Django settings — BASE (partagé par tous les environnements)
"""

from pathlib import Path
from datetime import timedelta
import os
import sys
from environs import Env

env = Env()

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env.read_env(os.path.join(BASE_DIR, '.env'))

# ── Sécurité ──────────────────────────────────────────────────────────────────
SECRET_KEY = env.str('SECRET_KEY')

# ── Applications ──────────────────────────────────────────────────────────────
INSTALLED_APPS = [
    'corsheaders',
    'rest_framework',

    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',

    'common',
    'userauths',
    'catalog',
    'coffrets',
    'orders',
    'reviews',
    'notifications',
    'dashboard',
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'backend.wsgi.application'

# ── Base de données ───────────────────────────────────────────────────────────
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME':     env.str('DB_NAME'),
        'USER':     env.str('DB_USER'),
        'PASSWORD': env.str('DB_PASSWORD'),
        'HOST':     env.str('DB_HOST', default='localhost'),
        'PORT':     env.str('DB_PORT', default='5432'),
        # Connexions réutilisées : évite un handshake PostgreSQL par requête (modéré pour rester sous la limite LWS).
        'CONN_MAX_AGE':       env.int('DB_CONN_MAX_AGE', default=60),
        'CONN_HEALTH_CHECKS': True,
    }
}

# ── Authentification ──────────────────────────────────────────────────────────
AUTH_USER_MODEL = 'userauths.User'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ── REST Framework ────────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    # JSON uniquement : pas d'API navigable HTML exposée en production
    "DEFAULT_RENDERER_CLASSES": ("rest_framework.renderers.JSONRenderer",),
    "DEFAULT_CONTENT_NEGOTIATION_CLASS": "common.negotiation.JSONOnlyNegotiation",
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.AllowAny",
    ),
    # ── Rate limiting (anti brute-force) ──────────────────────────────────────
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    # Plafonds généreux : plusieurs clients partagent souvent la même IP (réseaux mobiles),
    # un site vitrine charge plusieurs appels par page. Les routes sensibles ont leur propre limite.
    "DEFAULT_THROTTLE_RATES": {
        "anon": "3000/hour",
        "user": "5000/hour",
        "login": "10/minute",
        "password_reset": "5/minute",
        "lookup": "20/minute",
        "signup": "10/minute",
        "review": "10/hour",
    },
}

# ── Cache : fichiers (partagé entre les processus Passenger, sans Redis ni requête SQL) ─
# Le dossier doit être hors du dossier public. Les compteurs de limitation de débit y sont stockés :
# approximatifs en cas d'accès simultanés, ce qui suffit pour freiner abus et force brute.
CACHE_DIR = Path(env.str('CACHE_DIR', default=str(BASE_DIR / 'cache')))
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.filebased.FileBasedCache',
        'LOCATION': str(CACHE_DIR),
        'OPTIONS': {'MAX_ENTRIES': 5000},
    }
}
if 'test' in sys.argv:  # tests isolés : jamais de compteurs ni de données mises en cache d'un test à l'autre
    CACHES['default'] = {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}

# ── Simple JWT ────────────────────────────────────────────────────────────────
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME':  timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
    'ROTATE_REFRESH_TOKENS':  True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': False,
    'ALGORITHM': 'HS256',
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
    'TOKEN_TYPE_CLAIM': 'token_type',
    'JTI_CLAIM': 'jti',
}

# ── Internationalisation ──────────────────────────────────────────────────────
LANGUAGE_CODE = 'fr-fr'
TIME_ZONE     = 'Africa/Abidjan'
USE_I18N      = True
USE_TZ        = True

# ── Fichiers statiques & médias ───────────────────────────────────────────────
STATIC_URL       = 'static/'
STATICFILES_DIRS = [BASE_DIR / 'static']
STATIC_ROOT      = BASE_DIR / 'staticfiles'

# Développement : /media/ (proxy Vite). Production : voir production.py (MEDIA_URL absolue vers le site) ;
# MEDIA_ROOT doit alors pointer dans le dossier public du site (public_html/media) pour qu'Apache serve les images.
MEDIA_URL  = env.str('MEDIA_URL', default='/media/')
MEDIA_ROOT = Path(env.str('MEDIA_ROOT', default=str(BASE_DIR / 'media')))

STORAGES = {
    'default':     {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedStaticFilesStorage'},
}

# ── Limites d'envoi (anti saturation mémoire/disque sur hébergement mutualisé) ─
DATA_UPLOAD_MAX_MEMORY_SIZE   = 1 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE   = 2 * 1024 * 1024
DATA_UPLOAD_MAX_NUMBER_FILES  = 10
DATA_UPLOAD_MAX_NUMBER_FIELDS = 200

# URL de l'admin Django : à changer en production (variable ADMIN_URL) pour échapper aux robots
ADMIN_URL = env.str('ADMIN_URL', default='admin/')

# ── Journaux : fichier tournant (pas de service externe sur mutualisé) ───────
LOG_DIR = Path(env.str('LOG_DIR', default=str(BASE_DIR / 'logs')))
LOG_DIR.mkdir(parents=True, exist_ok=True)

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'standard': {'format': '%(asctime)s %(levelname)s %(name)s: %(message)s'},
    },
    'handlers': {
        'file': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': str(LOG_DIR / 'app.log'),
            'maxBytes': 5 * 1024 * 1024,
            'backupCount': 3,
            'encoding': 'utf-8',
            'formatter': 'standard',
        },
        'console': {'class': 'logging.StreamHandler', 'formatter': 'standard'},
    },
    'root': {'handlers': ['file', 'console'], 'level': 'WARNING'},
    'loggers': {
        'django.request': {'handlers': ['file', 'console'], 'level': 'ERROR', 'propagate': False},
        'orders':         {'handlers': ['file', 'console'], 'level': 'INFO',  'propagate': False},
    },
}

# ── Email ─────────────────────────────────────────────────────────────────────
EMAIL_BACKEND       = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST          = env.str('EMAIL_HOST',          default='mail.monarmoire.store')
EMAIL_PORT          = env.int('EMAIL_PORT',          default=465)
EMAIL_USE_SSL       = env.bool('EMAIL_USE_SSL',      default=True)
EMAIL_USE_TLS       = env.bool('EMAIL_USE_TLS',      default=False)
EMAIL_HOST_USER     = env.str('EMAIL_HOST_USER',     default='')
EMAIL_HOST_PASSWORD = env.str('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL  = 'support@monarmoire.store'
EMAIL_TIMEOUT       = 10
EMAIL_USE_LOCALTIME = True

# ── Web Push (VAPID) — notifications "verset du jour" & autres ────────────────
VAPID_PUBLIC_KEY = env.str('VAPID_PUBLIC_KEY', default='')

_vapid_key_file = env.str('VAPID_PRIVATE_KEY_FILE', default='vapid_private.pem')
VAPID_PRIVATE_KEY = str(BASE_DIR / _vapid_key_file)

VAPID_CLAIMS = {
    'sub': f'mailto:{env.str("VAPID_CONTACT_EMAIL", default="support@monarmoire.store")}',
}

# ── Paiement — GeniusPay (mobile money CI) + Paystack (carte bancaire) ───────
GENIUSPAY_PUBLIC_KEY     = env.str('GENIUSPAY_PUBLIC_KEY',     default='')
GENIUSPAY_SECRET_KEY     = env.str('GENIUSPAY_SECRET_KEY',     default='')
GENIUSPAY_WEBHOOK_SECRET = env.str('GENIUSPAY_WEBHOOK_SECRET', default='')

PAYSTACK_SECRET_KEY   = env.str('PAYSTACK_SECRET_KEY',   default='')
PAYSTACK_PUBLIC_KEY   = env.str('PAYSTACK_PUBLIC_KEY',   default='')
PAYSTACK_BASE_URL     = env.str('PAYSTACK_BASE_URL',     default='https://api.paystack.co')

# ── Frontend URL ──────────────────────────────────────────────────────────────
FRONTEND_URL = env.str('FRONTEND_URL', default='http://localhost:5173')

# ── Clé primaire par défaut (nos modèles définissent tous un id UUID explicite) ─
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
