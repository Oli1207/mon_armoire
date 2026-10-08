import hashlib
import secrets
import time

RESET_TOKEN_TTL = 3600  # 1 heure, en secondes


def hash_token(token):
    return hashlib.sha256(token.encode()).hexdigest()


def issue_reset_token(user):
    """Crée un jeton de définition de mot de passe ; seule son empreinte est stockée (une fuite de la base ne donne aucun lien valide)."""
    token = f'{int(time.time())}:{secrets.token_urlsafe(32)}'
    user.reset_token = hash_token(token)
    user.save(update_fields=['reset_token'])
    return token
