"""Journal des actions du personnel.

Un middleware enregistre, pour chaque action d'administration qui modifie quelque chose (création, modification,
suppression), QUI l'a faite, QUAND et SUR QUOI, avec une phrase lisible. Il note aussi les tentatives refusées et les
connexions du personnel. Rien du contenu des requêtes n'est conservé (jamais de mot de passe ni de donnée personnelle).

Ajouter une nouvelle route d'administration : l'ajouter à ROUTES ci-dessous (sinon elle est journalisée avec un libellé générique).
"""
import logging

from django.apps import apps

from .models import AuditLog

logger = logging.getLogger(__name__)

UNSAFE = {'POST', 'PUT', 'PATCH', 'DELETE'}
VERBS = {'POST': ('created', 'créé'), 'PUT': ('updated', 'modifié'), 'PATCH': ('updated', 'modifié'), 'DELETE': ('deleted', 'supprimé')}

# url_name -> (nom affiché, modèle retrouvé via le paramètre d'URL, nom du paramètre, accord au féminin)
ROUTES = {
    'admin_categories':           ('Catégorie', None, None, True),
    'admin_category_detail':      ('Catégorie', 'catalog.Category', 'pk', True),
    'admin_collections':          ('Occasion', None, None, True),
    'admin_collection_detail':    ('Occasion', 'catalog.Collection', 'pk', True),
    'admin_products':             ('Produit', None, None, False),
    'admin_product_detail':       ('Produit', 'catalog.Product', 'pk', False),
    'admin_variant_create':       ('Variante', 'catalog.Product', 'product_id', True),
    'admin_variant_detail':       ('Variante', 'catalog.ProductVariant', 'pk', True),
    'admin_image_create':         ('Photo de produit', 'catalog.Product', 'product_id', True),
    'admin_image_delete':         ('Photo de produit', 'catalog.ProductImage', 'pk', True),
    'admin_symbols':              ('Symbole', None, None, False),
    'admin_symbol_detail':        ('Symbole', 'catalog.SymbolGuideEntry', 'pk', False),
    'admin_lookbook':             ('Look du lookbook', None, None, False),
    'admin_lookbook_detail':      ('Look du lookbook', 'catalog.LookbookEntry', 'pk', False),
    'admin_coffrets':             ('Coffret', None, None, False),
    'admin_coffret_detail':       ('Coffret', 'coffrets.Coffret', 'pk', False),
    'admin_slot_create':          ('Choix de coffret', 'coffrets.Coffret', 'coffret_id', False),
    'admin_slot_detail':          ('Choix de coffret', 'coffrets.CoffretSlot', 'pk', False),
    'admin_coffret_item_create':  ('Article de coffret', 'coffrets.Coffret', 'coffret_id', False),
    'admin_coffret_item_detail':  ('Article de coffret', 'coffrets.CoffretItem', 'pk', False),
    'admin_waitlist_detail':      ('Inscription en liste d’attente', 'catalog.WaitlistEntry', 'pk', True),
    'admin_zones':                ('Zone de livraison', None, None, True),
    'admin_zone_detail':          ('Zone de livraison', 'orders.DeliveryZone', 'pk', True),
    'admin_verses':               ('Verset', None, None, False),
    'admin_verse_detail':         ('Verset', 'notifications.Verse', 'pk', False),
    'verse_override_detail':      ('Verset du jour', None, 'date', False),
    'admin_review_detail':        ('Avis', 'reviews.Review', 'pk', False),
    'order_update_status':        ('Commande', None, 'order_number', True),
    'admin_site_settings':        ('Réglages du site', None, None, False),
    'admin_team':                 ('Membre de l’équipe', None, None, False),
    'admin_team_detail':          ('Membre de l’équipe', 'userauths.StaffProfile', 'pk', False),
    'admin_team_invite':          ('Invitation d’un membre', 'userauths.StaffProfile', 'pk', True),
}


def _label(model_label, value):
    """Nom lisible de l'objet visé (avant l'action, pour qu'une suppression garde son nom)."""
    try:
        obj = apps.get_model(model_label).objects.get(pk=value)
    except Exception:
        return ''
    if model_label == 'reviews.Review':
        return f'sur « {obj.product.name} »'
    if model_label == 'userauths.StaffProfile':
        return obj.user.email
    if model_label == 'catalog.ProductImage':
        return obj.product.name
    if model_label == 'catalog.WaitlistEntry':   # pas d'e-mail ni de téléphone dans le journal
        return f'pour « {obj.variant.product.name} »'
    return str(obj)[:120]


def _agree(text, feminine):
    return text + 'e' if feminine else text


class AuditMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def process_view(self, request, view_func, view_args, view_kwargs):
        request._audit = None
        match = request.resolver_match
        if request.method not in UNSAFE or not match or match.url_name not in ROUTES:
            return None
        if not request.META.get('HTTP_AUTHORIZATION'):   # appel anonyme : refusé de toute façon, inutile de chercher l'objet
            return None
        noun, model_label, kwarg, feminine = ROUTES[match.url_name]
        target = ''
        value = view_kwargs.get(kwarg) if kwarg else None
        if value is not None:
            target = _label(model_label, value) if model_label else str(value)
        request._audit = (noun, feminine, target, model_label or '', str(value or '')[:40], match.url_name)
        return None

    def __call__(self, request):
        response = self.get_response(request)
        try:
            self._record(request, response)
        except Exception:   # le journal ne doit jamais casser une réponse
            logger.exception('Journal : enregistrement impossible')
        return response

    @staticmethod
    def _record(request, response):
        area = getattr(request, '_staff_area', None)
        user = getattr(request, 'user', None)
        info = getattr(request, '_audit', None)
        if not area or request.method not in UNSAFE or not (user and user.is_authenticated and user.is_staff):
            return
        denied = response.status_code in (401, 403)
        if response.status_code >= 400 and not denied:
            return   # erreur de saisie : rien n'a changé
        noun, feminine, target, model_label, object_id, _ = info or ('Action', False, '', '', '', '')
        action, verb = VERBS[request.method]
        if denied:
            action, summary = 'denied', f'Action refusée (droits insuffisants) : {noun.lower()}'
        else:
            if request.method == 'POST' and not target:
                data = getattr(response, 'data', None)
                if isinstance(data, dict):
                    target = str(data.get('name') or data.get('label') or data.get('title') or data.get('order_number') or '')[:120]
            if info and info[5] in ('verse_override_detail', 'order_update_status') and request.method in ('PUT', 'PATCH'):
                verb = 'modifié'
            summary = f'{noun} {_agree(verb, feminine)}'
            if info and info[5] == 'admin_variant_create':
                summary = f'Variante ajoutée au produit « {target} »' if target else 'Variante ajoutée'
            elif info and info[5] == 'admin_image_create':
                summary = f'Photo ajoutée au produit « {target} »' if target else 'Photo ajoutée'
            elif info and info[5] in ('admin_slot_create', 'admin_coffret_item_create'):
                summary = f'{noun} ajouté au coffret « {target} »' if target else f'{noun} ajouté'
            elif target:
                summary += f' : {target}' if not target.startswith(('sur ', 'pour ')) else f' {target}'
        AuditLog.objects.create(
            actor=user, actor_label=user.email[:254], area=area[:20], action=action, summary=summary[:300],
            object_type=model_label.split('.')[-1][:40], object_id=object_id, status_code=response.status_code,
        )
