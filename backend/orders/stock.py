from django.db.models import F

from catalog.models import ProductVariant


def _coffret_lines(configuration):
    """Articles réellement contenus dans un coffret configuré : éléments inclus conservés + choix de la cliente."""
    lines = [(i.variant, i.quantity) for i in configuration.kept_included_items]
    lines += [(i.variant, i.quantity) for i in configuration.items.select_related('variant__product')]
    return lines


def check_cart_stock(cart):
    """Vérifie que chaque article du panier a un stock suffisant. Retourne un message d'erreur ou None."""
    for item in cart.items.select_related('variant__product', 'coffret_configuration'):
        if item.variant:
            if item.quantity > item.variant.stock and not item.variant.allow_preorder:
                return f"Stock insuffisant pour « {item.variant.product.name} » ({item.variant.stock} disponible(s))."
        elif item.coffret_configuration:
            for variant, quantity in _coffret_lines(item.coffret_configuration):
                if quantity * item.quantity > variant.stock and not variant.allow_preorder:
                    return f"Stock insuffisant pour « {variant.product.name} » ({variant.stock} disponible(s))."
    return None


def _take(variant_id, quantity, allow_preorder):
    """Décrémente de façon atomique ; retourne False si le stock est insuffisant (rien n'est décrémenté)."""
    updated = ProductVariant.objects.filter(pk=variant_id, stock__gte=quantity).update(stock=F('stock') - quantity)
    if updated:
        return True
    if allow_preorder:
        ProductVariant.objects.filter(pk=variant_id).update(stock=0)
        return True
    return False


def decrement_stock_for_order(order):
    """Décrémente le stock (appelé une fois, au passage en 'paid', dans une transaction).

    Le paiement est déjà encaissé : en cas de stock insuffisant (vente simultanée du dernier
    article), on ne bloque pas, on renvoie la liste des articles à traiter à la main.
    """
    shortages = []
    for item in order.items.select_related('variant__product', 'coffret_configuration'):
        if item.variant_id:
            if not _take(item.variant_id, item.quantity, item.variant.allow_preorder):
                shortages.append(item.variant.product.name)
        elif item.coffret_configuration_id:
            for variant, quantity in _coffret_lines(item.coffret_configuration):
                if not _take(variant.pk, quantity * item.quantity, variant.allow_preorder):
                    shortages.append(variant.product.name)
    return shortages
