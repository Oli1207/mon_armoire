"""Droits du personnel (rôles), vérifiés CÔTÉ SERVEUR sur chaque route d'administration.

Règle :
  - il faut être « staff » (is_staff) ;
  - la propriétaire (superuser) a tous les droits, y compris « Équipe » et « Journal » ;
  - un compte staff sans profil actif n'a AUCUN droit (refus par défaut) ;
  - sinon : droits du rôle + ajustements individuels (cases cochées / décochées dans l'écran Équipe).
"""
from rest_framework.permissions import BasePermission

# Droit -> libellé affiché dans l'écran Équipe (phrases simples, pour une personne non technique)
PERMISSIONS = {
    'catalog':       'Gérer le catalogue (produits, catégories, coffrets, occasions, symboles, lookbook)',
    'orders':        'Voir les commandes',
    'orders_manage': 'Changer le statut des commandes (préparée, expédiée…)',
    'customers':     'Voir les clientes',
    'reviews':       'Modérer les avis',
    'giftcards':     'Voir les cartes cadeaux',
    'waitlist':      "Voir la liste d'attente",
    'settings':      'Modifier les réglages (livraison, versets, textes du site)',
    'analytics':     'Voir les statistiques et le suivi des visiteurs',
}

# Rôle -> (libellé, description courte, droits)
ROLES = {
    'manager': (
        'Gérante', 'Fait tout, sauf gérer l’équipe et lire le journal.',
        set(PERMISSIONS),
    ),
    'catalog': (
        'Catalogue', 'Ajoute et modifie les produits, coffrets et photos. Ne voit ni les clientes ni l’argent.',
        {'catalog', 'waitlist'},
    ),
    'orders': (
        'Préparation des commandes', 'Voit les commandes et change leur statut. Rien d’autre.',
        {'orders', 'orders_manage'},
    ),
    'support': (
        'Service client', 'Voit commandes, clientes, avis, cartes cadeaux et liste d’attente. Ne modifie pas le catalogue.',
        {'orders', 'customers', 'reviews', 'giftcards', 'waitlist'},
    ),
    'accounting': (
        'Comptabilité', 'Voit commandes, clientes, cartes cadeaux et statistiques. Ne modifie rien.',
        {'orders', 'customers', 'giftcards', 'analytics'},
    ),
}
ROLE_CHOICES = [(key, value[0]) for key, value in ROLES.items()]


def role_permissions(role, extra=None):
    """Droits effectifs : ceux du rôle, ajustés par `extra` ({droit: True/False})."""
    granted = set(ROLES.get(role, ('', '', set()))[2])
    for perm, allowed in (extra or {}).items():
        if perm in PERMISSIONS:
            (granted.add if allowed else granted.discard)(perm)
    return granted


def effective_permissions(user):
    """Ensemble des droits d'un utilisateur ; 'team' et 'journal' réservés à la propriétaire."""
    if not (user and user.is_authenticated and user.is_staff):
        return set()
    if user.is_superuser:
        return set(PERMISSIONS) | {'team', 'journal'}
    profile = getattr(user, 'staff_profile', None)
    if profile is None or not profile.is_active:
        return set()
    return role_permissions(profile.role, profile.extra_permissions)


def staff_can(*perms, **by_method):
    """Permission DRF : accepte si l'utilisateur a AU MOINS UN des droits `perms`.
    `by_method` (ex. GET='orders') remplace la liste pour cette méthode HTTP.
    Enregistre le droit utilisé sur la requête : le journal s'en sert pour savoir qu'il s'agit d'une action d'administration."""
    per_method = {m.upper(): (v if isinstance(v, (tuple, list)) else (v,)) for m, v in by_method.items()}

    class _StaffCan(BasePermission):
        message = "Votre rôle ne permet pas d'effectuer cette action. Demandez à la propriétaire du site."

        def has_permission(self, request, view):
            needed = per_method.get(request.method, perms)
            request._request._staff_area = needed[0]  # sert au journal
            return bool(effective_permissions(request.user) & set(needed))

    _StaffCan.__name__ = 'StaffCan_' + '_'.join(perms)
    return _StaffCan
