"""
Throttle classes pour les endpoints sensibles (utilisés avec @throttle_classes([...])).
Les compteurs sont stockés dans le cache Django (base de données sur LWS, partagée entre processus).
"""
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class LoginThrottle(AnonRateThrottle):
    scope = 'login'


class PasswordResetThrottle(AnonRateThrottle):
    scope = 'password_reset'


class LookupThrottle(AnonRateThrottle):
    """Recherches par code (suivi de commande, vérification de carte cadeau) : freine l'énumération."""
    scope = 'lookup'


class SignupThrottle(AnonRateThrottle):
    """Créations de contenu public (inscription, avis, liste d'attente, abonnement push)."""
    scope = 'signup'


class ReviewThrottle(UserRateThrottle):
    """Avis publiés par un client connecté."""
    scope = 'review'
