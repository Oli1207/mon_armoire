from .base import *

DEBUG = True

ALLOWED_HOSTS = ['localhost', '127.0.0.1']

CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
]

CORS_ALLOW_CREDENTIALS = True

# ── Email — affiché dans la console en dev (pas de vrai SMTP local) ───────────
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
