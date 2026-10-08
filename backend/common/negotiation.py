from rest_framework.negotiation import DefaultContentNegotiation


class JSONOnlyNegotiation(DefaultContentNegotiation):
    """Toujours du JSON, quel que soit l'en-tête Accept (un navigateur qui ouvre une URL d'API ne doit pas recevoir une erreur 406)."""

    def select_renderer(self, request, renderers, format_suffix=None):
        return renderers[0], renderers[0].media_type
