import re


def clean_phone(raw):
    """(numéro nettoyé, message d'erreur). Accepte « 07 99 16 73 93 », « +225 07 99 16 73 93 », « 0799-16-73-93 »…
    Garde les chiffres (et un « + » initial) ; 8 à 15 chiffres."""
    text = str(raw or '').strip()
    digits = re.sub(r'\D', '', text)
    if not re.fullmatch(r'[\d\s+().-]+', text) or not 8 <= len(digits) <= 15:
        return '', 'Saisissez un numéro de téléphone valide, par exemple 07 99 16 73 93.'
    return ('+' if text.startswith('+') else '') + digits, None
