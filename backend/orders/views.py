from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.utils.crypto import get_random_string
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from catalog.engraving import clean_engraving
from common.places import clean_place
from notifications.alerts import queue_order_status_push
from userauths.permissions import staff_can

from catalog.models import ProductVariant
from coffrets.models import CoffretConfiguration
from userauths.models import User, Address, unique_username
from .models import Cart, CartItem, DeliveryZone, GiftCard, LOYALTY_POINT_VALUE, LoyaltyTransaction, Order, OrderItem, OrderStatusHistory
from common.pagination import paginate
from .queries import order_queryset, serialize_cart, serialize_order
from .serializers import DeliveryZoneSerializer, LoyaltyTransactionSerializer, OrderSerializer
from common.throttles import LookupThrottle
from .emails import send_order_confirmation_email, send_order_status_email
from .loyalty import get_balance
from .services import cancel_unpaid_order, mark_order_paid
from .stock import check_cart_stock

MAX_LINE_QUANTITY = 20


def _parse_quantity(value, default=1):
    """Entier entre 1 et MAX_LINE_QUANTITY, sinon None (valeur négative, nulle, texte, trop grande)."""
    if value is None or value == '':
        return default
    try:
        quantity = int(value)
    except (TypeError, ValueError):
        return None
    return quantity if 1 <= quantity <= MAX_LINE_QUANTITY else None


def _get_or_create_cart(cart_id_str, user=None):
    cart = None
    if cart_id_str:
        try:
            cart, _ = Cart.objects.get_or_create(id=cart_id_str, defaults={'user': user})
        except (ValueError, ValidationError):
            cart = None
    if cart is None:
        cart = Cart.objects.create(user=user)
    if user and not cart.user_id:
        cart.user = user
        cart.save(update_fields=['user'])
    return cart


# ── Panier ────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([AllowAny])
def cart_detail(request):
    cart_id = request.query_params.get('cart_id')
    if not cart_id:
        return Response({'error': 'cart_id requis.'}, status=status.HTTP_400_BAD_REQUEST)
    user = request.user if request.user.is_authenticated else None
    cart = _get_or_create_cart(cart_id, user)
    return Response(serialize_cart(cart, request))


@api_view(['POST'])
@permission_classes([AllowAny])
def cart_add(request):
    cart_id                   = request.data.get('cart_id')
    variant_id                = request.data.get('variant_id')
    coffret_configuration_id  = request.data.get('coffret_configuration_id')
    quantity                  = _parse_quantity(request.data.get('quantity', 1))
    gift_wrap                 = bool(request.data.get('gift_wrap', False))
    gift_message              = str(request.data.get('gift_message') or '')[:500]
    raw_engraving             = request.data.get('engraving_text')

    if not cart_id or (not variant_id and not coffret_configuration_id):
        return Response(
            {'error': 'cart_id et (variant_id ou coffret_configuration_id) requis.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if quantity is None:
        return Response(
            {'error': f'La quantité doit être comprise entre 1 et {MAX_LINE_QUANTITY}.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = request.user if request.user.is_authenticated else None
    cart = _get_or_create_cart(cart_id, user)

    variant = None
    coffret_configuration = None
    if variant_id:
        try:
            variant = ProductVariant.objects.select_related('product').get(id=variant_id, product__is_active=True)
        except (ProductVariant.DoesNotExist, ValueError, ValidationError):
            return Response({'error': 'Variante introuvable.'}, status=status.HTTP_404_NOT_FOUND)
    else:
        try:
            coffret_configuration = CoffretConfiguration.objects.get(id=coffret_configuration_id)
        except (CoffretConfiguration.DoesNotExist, ValueError, ValidationError):
            return Response({'error': 'Coffret configuré introuvable.'}, status=status.HTTP_404_NOT_FOUND)

    engraving_text = ''
    if variant:
        engraving_text, engraving_error = clean_engraving(variant.product, raw_engraving)
        if engraving_error:
            return Response({'error': engraving_error}, status=status.HTTP_400_BAD_REQUEST)
        existing = CartItem.objects.filter(
            cart=cart, variant=variant, gift_wrap=gift_wrap, gift_message=gift_message, engraving_text=engraving_text,
        ).first()
        future_quantity = (existing.quantity if existing else 0) + quantity
        if future_quantity > MAX_LINE_QUANTITY:
            return Response(
                {'error': f'Maximum {MAX_LINE_QUANTITY} exemplaires par article.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if future_quantity > variant.stock and not variant.allow_preorder:
            return Response(
                {'error': f"Stock insuffisant pour « {variant.product.name} » ({variant.stock} disponible(s))."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if existing:
            existing.quantity = future_quantity
            existing.save(update_fields=['quantity'])
        else:
            CartItem.objects.create(
                cart=cart, variant=variant, quantity=quantity, gift_wrap=gift_wrap, gift_message=gift_message,
                engraving_text=engraving_text,
            )
    else:
        CartItem.objects.create(
            cart=cart, coffret_configuration=coffret_configuration, quantity=quantity,
            gift_wrap=gift_wrap, gift_message=gift_message, engraving_text=engraving_text,
        )

    return Response(serialize_cart(cart, request), status=status.HTTP_201_CREATED)


@api_view(['PATCH'])
@permission_classes([AllowAny])
def cart_item_update(request, item_id):
    cart_id = request.data.get('cart_id')
    try:
        item = CartItem.objects.select_related('cart', 'variant__product').get(id=item_id)
    except (CartItem.DoesNotExist, ValueError):
        return Response({'error': 'Article introuvable.'}, status=status.HTTP_404_NOT_FOUND)

    if not cart_id or str(item.cart.id) != str(cart_id):
        return Response({'error': 'Accès non autorisé à cet article.'}, status=status.HTTP_403_FORBIDDEN)

    quantity = request.data.get('quantity')
    if quantity is not None:
        try:
            quantity = int(quantity)
        except (TypeError, ValueError):
            return Response({'error': 'Quantité invalide.'}, status=status.HTTP_400_BAD_REQUEST)
        if quantity <= 0:
            cart = item.cart
            item.delete()
            return Response(serialize_cart(cart, request))
        if quantity > MAX_LINE_QUANTITY:
            return Response(
                {'error': f'Maximum {MAX_LINE_QUANTITY} exemplaires par article.'}, status=status.HTTP_400_BAD_REQUEST,
            )
        if item.variant and quantity > item.variant.stock and not item.variant.allow_preorder:
            return Response(
                {'error': f'Stock insuffisant ({item.variant.stock} disponible(s)).'}, status=status.HTTP_400_BAD_REQUEST,
            )
        item.quantity = quantity

    if 'gift_wrap' in request.data:
        item.gift_wrap = bool(request.data['gift_wrap'])
    if 'gift_message' in request.data:
        item.gift_message = str(request.data['gift_message'] or '')[:500]
    if 'engraving_text' in request.data:
        text, engraving_error = clean_engraving(item.variant.product if item.variant else None, request.data['engraving_text'])
        if engraving_error:
            return Response({'error': engraving_error}, status=status.HTTP_400_BAD_REQUEST)
        item.engraving_text = text
    item.save()

    return Response(serialize_cart(item.cart, request))


@api_view(['DELETE'])
@permission_classes([AllowAny])
def cart_item_remove(request, item_id):
    cart_id = request.query_params.get('cart_id')
    try:
        item = CartItem.objects.select_related('cart').get(id=item_id)
    except (CartItem.DoesNotExist, ValueError):
        return Response({'error': 'Article introuvable.'}, status=status.HTTP_404_NOT_FOUND)

    if not cart_id or str(item.cart.id) != str(cart_id):
        return Response({'error': 'Accès non autorisé à cet article.'}, status=status.HTTP_403_FORBIDDEN)

    cart = item.cart
    item.delete()
    return Response(serialize_cart(cart, request))


# ── Zones de livraison ────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([AllowAny])
def delivery_zones_list(request):
    qs = DeliveryZone.objects.filter(is_active=True)
    return Response(DeliveryZoneSerializer(qs, many=True).data)


# ── Commandes ─────────────────────────────────────────────────────────────────
def _cart_item_product_name(item):
    if item.variant:
        return item.variant.product.name
    return f'Coffret personnalisé — {item.coffret_configuration.coffret.name}'


class OrderError(Exception):
    """Erreur métier : annule la transaction en cours et renvoie un message clair au client."""


def _build_order(request):
    cart_id          = request.data.get('cart_id')
    delivery_method  = request.data.get('delivery_method', 'shipping')
    delivery_zone_id = request.data.get('delivery_zone_id')

    if delivery_method not in ('shipping', 'pickup'):
        raise OrderError('Mode de livraison invalide.')

    try:
        cart = Cart.objects.prefetch_related('items').get(id=cart_id)
    except (Cart.DoesNotExist, ValueError, ValidationError):
        raise OrderError('Panier introuvable.')

    if not cart.items.exists():
        raise OrderError('Le panier est vide.')

    stock_error = check_cart_stock(cart)
    if stock_error:
        raise OrderError(stock_error)

    user = request.user if request.user.is_authenticated else None
    guest_email = ''
    address = None
    delivery_zone = None
    shipping_cost = 0
    generated_password = None

    if user:
        # ── Client connecté : adresse existante requise pour la livraison ────
        address_id = request.data.get('address_id')
        if delivery_method == 'shipping':
            if not address_id or not delivery_zone_id:
                raise OrderError('Adresse et zone de livraison requises.')
            try:
                address = Address.objects.get(id=address_id, user=user)
            except (Address.DoesNotExist, ValueError, ValidationError):
                raise OrderError('Adresse invalide.')
    else:
        # ── Client invité : coordonnées saisies au checkout ──────────────────
        guest_email = str(request.data.get('email') or '').strip().lower()
        full_name   = str(request.data.get('full_name') or '').strip()[:200]
        phone       = str(request.data.get('phone') or '').strip()[:30]
        create_account = bool(request.data.get('create_account'))

        if not guest_email or not full_name or not phone:
            raise OrderError('Email, nom complet et téléphone requis.')
        try:
            validate_email(guest_email)
        except ValidationError:
            raise OrderError('Adresse e-mail invalide.')

        if create_account:
            if User.objects.filter(email=guest_email).exists():
                raise OrderError('Un compte existe déjà avec cet email. Connectez-vous pour continuer.')
            # Choix du client : mot de passe temporaire aléatoire envoyé par e-mail (à changer depuis « Mon compte »)
            generated_password = get_random_string(12)
            user = User.objects.create_user(
                username=unique_username(guest_email), email=guest_email,
                full_name=full_name, phone=phone, password=generated_password,
            )

        if delivery_method == 'shipping':
            city   = str(request.data.get('city') or '').strip()[:100]
            street = str(request.data.get('street') or '').strip()[:255]
            if not city or not street:
                raise OrderError('Ville et adresse requises pour la livraison.')
            commune, quartier, place_error = clean_place(city, request.data.get('commune'), request.data.get('quartier'))
            if place_error:
                raise OrderError(place_error)
            address = Address.objects.create(
                user=user, full_name=full_name, phone=phone, city=city, commune=commune, quartier=quartier, street=street, is_default=bool(user),
            )

    if delivery_method == 'shipping':
        try:
            delivery_zone = DeliveryZone.objects.get(id=delivery_zone_id, is_active=True)
        except (DeliveryZone.DoesNotExist, ValueError, ValidationError):
            raise OrderError('Zone de livraison invalide.')
        shipping_cost = delivery_zone.shipping_cost

    subtotal = cart.total
    total = subtotal + shipping_cost

    # ── Carte cadeau : ligne verrouillée jusqu'à la fin de la transaction, donc
    #    deux commandes simultanées ne peuvent pas dépenser deux fois le même solde ──
    gift_card = None
    gift_card_amount = 0
    gift_card_code = str(request.data.get('gift_card_code') or '').strip().upper()
    if gift_card_code:
        gift_card = GiftCard.objects.select_for_update().filter(
            code=gift_card_code, status='active', balance__gt=0,
        ).first()
        if not gift_card:
            raise OrderError('Carte cadeau invalide, déjà utilisée ou expirée.')
        gift_card_amount = min(gift_card.balance, total)
        total = total - gift_card_amount

    # ── Points de fidélité : même principe (verrou sur l'utilisateur) ────────
    loyalty_points_used = 0
    loyalty_discount_amount = 0
    try:
        loyalty_points_requested = int(request.data.get('loyalty_points') or 0)
    except (TypeError, ValueError):
        raise OrderError('Nombre de points invalide.')
    if loyalty_points_requested < 0:
        raise OrderError('Nombre de points invalide.')
    if loyalty_points_requested > 0:
        if not user:
            raise OrderError('Connectez-vous pour utiliser vos points de fidélité.')
        User.objects.select_for_update().get(pk=user.pk)
        if loyalty_points_requested > get_balance(user):
            raise OrderError('Solde de points de fidélité insuffisant.')
        max_useful_points = int(total // LOYALTY_POINT_VALUE)
        loyalty_points_used = min(loyalty_points_requested, max_useful_points)
        loyalty_discount_amount = loyalty_points_used * LOYALTY_POINT_VALUE
        total = total - loyalty_discount_amount

    order = Order.objects.create(
        user=user, guest_email='' if user else guest_email,
        delivery_method=delivery_method, address=address, delivery_zone=delivery_zone,
        subtotal=subtotal, shipping_cost=shipping_cost,
        gift_card=gift_card, gift_card_amount=gift_card_amount,
        loyalty_points_used=loyalty_points_used, loyalty_discount_amount=loyalty_discount_amount,
        total=total,
    )
    for item in cart.items.all():
        OrderItem.objects.create(
            order=order, variant=item.variant, coffret_configuration=item.coffret_configuration,
            product_name=_cart_item_product_name(item), quantity=item.quantity, unit_price=item.unit_price,
            gift_wrap=item.gift_wrap, gift_message=item.gift_message, engraving_text=item.engraving_text,
        )

    if gift_card:
        gift_card.balance -= gift_card_amount
        if gift_card.balance <= 0:
            gift_card.status = 'used'
        gift_card.save(update_fields=['balance', 'status'])

    if loyalty_points_used:
        LoyaltyTransaction.objects.create(
            user=user, order=order, points=-loyalty_points_used, reason='redeemed',
            note=f'Commande {order.order_number}',
        )

    OrderStatusHistory.objects.create(order=order, status='pending', note='Commande créée.')
    cart.items.all().delete()

    # ── Payée intégralement (carte cadeau et/ou points) : aucun paiement en ligne requis ──
    if order.total <= 0:
        mark_order_paid(order, note='Payée intégralement (carte cadeau / points de fidélité).', notify=False)

    transaction.on_commit(lambda: send_order_confirmation_email(order, generated_password=generated_password))
    return order


@api_view(['POST'])
@permission_classes([AllowAny])
def order_create(request):
    try:
        with transaction.atomic():
            order = _build_order(request)
    except OrderError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    return Response(serialize_order(order, request), status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def loyalty_balance(request):
    qs = request.user.loyalty_transactions.all()[:20]
    return Response({
        'balance': get_balance(request.user),
        'point_value': LOYALTY_POINT_VALUE,
        'transactions': LoyaltyTransactionSerializer(qs, many=True).data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def orders_list(request):
    qs = order_queryset().filter(user=request.user)
    return paginate(request, qs, OrderSerializer, context={'request': request})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def order_detail(request, order_number):
    try:
        order = order_queryset().get(order_number=order_number, user=request.user)
    except Order.DoesNotExist:
        return Response({'error': 'Commande introuvable.'}, status=status.HTTP_404_NOT_FOUND)
    return Response(OrderSerializer(order, context={'request': request}).data)


# ── Suivi de commande (public, avec ou sans compte) ──────────────────────────
@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([LookupThrottle])
def order_track(request):
    order_number = str(request.data.get('order_number') or '').strip().upper()
    email        = str(request.data.get('email') or '').strip().lower()

    if not order_number or not email:
        return Response({'error': 'Numéro de commande et email requis.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        order = order_queryset().get(order_number=order_number)
    except Order.DoesNotExist:
        return Response({'error': 'Commande introuvable.'}, status=status.HTTP_404_NOT_FOUND)

    if order.contact_email.lower() != email:
        return Response({'error': 'Commande introuvable.'}, status=status.HTTP_404_NOT_FOUND)

    return Response(OrderSerializer(order, context={'request': request}).data)


# ── Mise à jour du statut (back-office) ──────────────────────────────────────
@api_view(['PATCH'])
@permission_classes([staff_can('orders_manage')])
def order_update_status(request, order_number):
    new_status = request.data.get('status')
    note       = str(request.data.get('note') or '')[:255]

    valid_statuses = dict(Order._meta.get_field('status').choices)
    if new_status not in valid_statuses:
        return Response({'error': 'Statut invalide.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        order = Order.objects.get(order_number=order_number)
    except Order.DoesNotExist:
        return Response({'error': 'Commande introuvable.'}, status=status.HTTP_404_NOT_FOUND)

    if order.status == new_status:
        return Response(serialize_order(order, request))
    if order.status == 'cancelled':
        return Response({'error': 'Une commande annulée ne peut plus être modifiée.'}, status=status.HTTP_400_BAD_REQUEST)
    if order.status == 'pending' and new_status not in ('paid', 'cancelled'):
        return Response(
            {'error': "Cette commande n'est pas encore payée : marquez-la d'abord « Payée » ou annulez-la."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if new_status == 'pending':
        return Response({'error': 'Statut invalide.'}, status=status.HTTP_400_BAD_REQUEST)

    if order.status == 'pending' and new_status == 'paid':
        mark_order_paid(order, note=note or 'Paiement confirmé manuellement.')
    elif order.status == 'pending' and new_status == 'cancelled':
        cancel_unpaid_order(order, note=note or 'Commande annulée.')
        send_order_status_email(order, note=note)
    else:
        with transaction.atomic():
            order.status = new_status
            order.save(update_fields=['status', 'updated_at'])
            OrderStatusHistory.objects.create(order=order, status=new_status, note=note)
        queue_order_status_push(order)
        send_order_status_email(order, note=note)

    return Response(serialize_order(order, request))
