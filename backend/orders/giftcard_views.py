from decimal import Decimal, InvalidOperation

from rest_framework import status
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from userauths.permissions import staff_can

from common.throttles import LookupThrottle, SignupThrottle
from common.pagination import AdminPagination, paginate
from .emails import send_order_confirmation_email
from .models import GiftCard, Order, OrderItem, OrderStatusHistory
from .queries import serialize_order
from .serializers import GiftCardAdminSerializer, GiftCardCheckSerializer

MIN_AMOUNT = 5000
MAX_AMOUNT = 1000000


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([SignupThrottle])
def giftcard_purchase(request):
    try:
        amount = Decimal(str(request.data.get('amount', '')))
        if not amount.is_finite():
            raise InvalidOperation
    except (InvalidOperation, TypeError, ValueError):
        return Response({'error': 'Montant invalide.'}, status=status.HTTP_400_BAD_REQUEST)

    amount = amount.quantize(Decimal('1'))
    if amount < MIN_AMOUNT:
        return Response({'error': f"Le montant minimum est de {MIN_AMOUNT} FCFA."}, status=status.HTTP_400_BAD_REQUEST)
    if amount > MAX_AMOUNT:
        return Response({'error': f"Le montant maximum est de {MAX_AMOUNT} FCFA."}, status=status.HTTP_400_BAD_REQUEST)

    purchaser_name  = str(request.data.get('purchaser_name') or '').strip()[:200]
    purchaser_email = str(request.data.get('purchaser_email') or '').strip().lower()
    recipient_name  = str(request.data.get('recipient_name') or '').strip()[:200]
    recipient_email = str(request.data.get('recipient_email') or '').strip().lower()
    message         = str(request.data.get('message') or '').strip()[:500]

    user = request.user if request.user.is_authenticated else None
    if not user and not purchaser_email:
        return Response({'error': 'Email requis.'}, status=status.HTTP_400_BAD_REQUEST)
    for address in (purchaser_email, recipient_email):
        if address:
            try:
                validate_email(address)
            except ValidationError:
                return Response({'error': 'Adresse e-mail invalide.'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        order = Order.objects.create(
            user=user, guest_email='' if user else purchaser_email,
            delivery_method='pickup', subtotal=amount, shipping_cost=0, total=amount,
        )
        OrderItem.objects.create(
            order=order, product_name=f"Carte cadeau Mon Armoire — {int(amount)} FCFA",
            quantity=1, unit_price=amount,
        )
        GiftCard.objects.create(
            purchase_order=order, initial_value=amount, balance=amount,
            purchaser_name=purchaser_name, purchaser_email=purchaser_email or (user.email if user else ''),
            recipient_name=recipient_name, recipient_email=recipient_email, message=message,
        )
        OrderStatusHistory.objects.create(order=order, status='pending', note='Achat de carte cadeau.')

    send_order_confirmation_email(order)

    return Response(serialize_order(order, request), status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([AllowAny])
@throttle_classes([LookupThrottle])
def giftcard_check(request):
    code = (request.query_params.get('code') or '').strip().upper()[:30]
    if not code:
        return Response({'error': 'Code requis.'}, status=status.HTTP_400_BAD_REQUEST)

    card = GiftCard.objects.filter(code=code).first()
    if not card or card.status != 'active' or card.balance <= 0:
        return Response({'valid': False})

    return Response({'valid': True, **GiftCardCheckSerializer(card).data})


# ── Back-office ───────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([staff_can('giftcards')])
def admin_giftcards_list(request):
    qs = GiftCard.objects.select_related('purchase_order').order_by('-created_at', 'id')
    search = (request.query_params.get('search') or '').strip().upper()[:50]
    if search:
        qs = qs.filter(
            Q(code__icontains=search) | Q(purchaser_email__icontains=search) | Q(recipient_email__icontains=search)
        )
    return paginate(request, qs, GiftCardAdminSerializer, pagination=AdminPagination)
