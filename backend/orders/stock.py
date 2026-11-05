from django.db.models import F, Sum

from catalog.models import Product, ProductVariant


def _coffret_lines(configuration):
    """Articles réellement contenus dans un coffret configuré : éléments inclus conservés + choix de la cliente."""
    lines = [(i.variant, i.quantity) for i in configuration.kept_included_items]
    lines += [(i.variant, i.quantity) for i in configuration.items.select_related('variant__product')]
    return lines


def _pool(variant):
    """Réserve de stock de cette variante : celle du produit si le stock est commun, sinon la sienne."""
    return ('product', variant.product_id) if variant.product.shared_stock else ('variant', variant.pk)


def check_cart_stock(cart):
    """Vérifie que le stock suffit pour tout le panier, y compris plusieurs lignes qui puisent dans la même réserve
    (deux variantes à stock commun, ou la même variante avec deux gravures). Retourne un message d'erreur ou None."""
    lines = []
    for item in cart.items.select_related('variant__product', 'coffret_configuration'):
        if item.variant:
            lines.append((item.variant, item.quantity))
        elif item.coffret_configuration:
            lines += [(variant, quantity * item.quantity) for variant, quantity in _coffret_lines(item.coffret_configuration)]
    wanted = {}
    for variant, quantity in lines:
        wanted[_pool(variant)] = wanted.get(_pool(variant), 0) + quantity
    for variant, _ in lines:
        if wanted[_pool(variant)] > variant.stock and not variant.allow_preorder:
            return f"Stock insuffisant pour « {variant.product.name} » ({variant.stock} disponible(s))."
    return None


def reserved_in_cart(cart, variant, exclude_item=None):
    """Quantité déjà au panier qui puise dans la même réserve que cette variante."""
    lines = cart.items.filter(variant__product_id=variant.product_id) if variant.product.shared_stock else cart.items.filter(variant=variant)
    if exclude_item is not None:
        lines = lines.exclude(pk=exclude_item.pk)
    return lines.aggregate(total=Sum('quantity'))['total'] or 0


def _take(variant, quantity):
    """Décrémente de façon atomique ; retourne False si le stock est insuffisant (rien n'est décrémenté)."""
    rows = ProductVariant.objects.filter(pk=variant.pk)
    if variant.product.shared_stock:
        # Toutes les lignes du produit bougent ensemble : le verrou du produit évite qu'elles se bloquent entre deux ventes
        list(Product.objects.select_for_update().filter(pk=variant.product_id).values_list('pk'))
        rows = ProductVariant.objects.filter(product_id=variant.product_id)
    if rows.filter(stock__gte=quantity).update(stock=F('stock') - quantity):
        return True
    if variant.allow_preorder:
        rows.update(stock=0)
        return True
    return False


LOW_STOCK = 2   # en dessous (ou égal) : « stock faible » ; 0 : rupture


def low_stock_variants(order):
    """Variantes de la commande dont le stock est faible ou épuisé APRÈS décrémentation (pour alerter l'équipe)."""
    ids = set()
    for item in order.items.select_related('coffret_configuration'):
        if item.variant_id:
            ids.add(item.variant_id)
        elif item.coffret_configuration_id:
            ids.update(variant.pk for variant, _ in _coffret_lines(item.coffret_configuration))
    low = ProductVariant.objects.filter(pk__in=ids, stock__lte=LOW_STOCK).select_related('product')
    return list({_pool(variant): variant for variant in low}.values())  # stock commun : une seule alerte par produit


def decrement_stock_for_order(order):
    """Décrémente le stock (appelé une fois, au passage en 'paid', dans une transaction).

    Le paiement est déjà encaissé : en cas de stock insuffisant (vente simultanée du dernier
    article), on ne bloque pas, on renvoie la liste des articles à traiter à la main.
    """
    shortages = []
    for item in order.items.select_related('variant__product', 'coffret_configuration'):
        if item.variant_id:
            if not _take(item.variant, item.quantity):
                shortages.append(item.variant.product.name)
        elif item.coffret_configuration_id:
            for variant, quantity in _coffret_lines(item.coffret_configuration):
                if not _take(variant, quantity * item.quantity):
                    shortages.append(variant.product.name)
    return shortages
