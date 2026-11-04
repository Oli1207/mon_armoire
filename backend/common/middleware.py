import codecs

from django.http import JsonResponse

ACCEPTED_CHARSETS = {'utf-8', 'ascii', 'iso8859-1', 'cp1252'}


class RejectUnsafeCharsetMiddleware:
    """Refuse un Content-Type dont le charset n'est pas un encodage de texte courant.

    DRF 3.17 (CVE-2026-114136) décode le corps JSON avec le charset annoncé : `charset=zlib_codec` le décompresse sans
    limite et contourne DATA_UPLOAD_MAX_MEMORY_SIZE, sans authentification. Le correctif de DRF 3.18 exige un Django
    que PostgreSQL 13 de LWS interdit. Un charset inconnu reste sans danger : Django l'ignore et lit en UTF-8.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        charset = request.content_params.get('charset')
        if charset:
            try:
                unsafe = codecs.lookup(charset).name not in ACCEPTED_CHARSETS
            except LookupError:
                unsafe = False
            if unsafe:
                return JsonResponse({'error': 'Encodage de la requête non pris en charge.'}, status=415)
        return self.get_response(request)
