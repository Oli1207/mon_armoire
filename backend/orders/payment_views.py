import hashlib
import hmac
import secrets

from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from . import geniuspay
from . import paystack as paystack_client
from .models import Order, OrderStatusHistory, Payment
from .services import mark_order_paid


def _public_order(order):
    """Le retour de paiement est public (numéro de commande seul) : jamais d'adresse, de téléphone ni d'e-mail."""
    return {'order_number': order.order_number, 'status': order.status, 'total': order.total}


def _generate_reference(prefix):
    return f"{prefix}-{secrets.token_urlsafe(10)}"


def _mark_order_paid(order, payment, note=''):
    first_confirmation = payment.status != 'success'
    if first_confirmation:
        payment.status = 'success'
        payment.save(update_fields=['status'])
    mark_order_paid(order, note=note or 'Paiement confirmé.')
    if first_confirmation and order.status == 'cancelled':
        OrderStatusHistory.objects.create(
            order=order, status='cancelled',
            note='ATTENTION : paiement reçu après annulation — à rembourser ou à traiter manuellement.',
        )


# ── Initialisation du paiement ────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([AllowAny])
def payment_initiate(request, order_number):
    provider = request.data.get('provider')
    if provider not in ('geniuspay', 'paystack'):
        return Response({'error': 'Fournisseur de paiement invalide.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        order = Order.objects.select_related('address', 'user').get(order_number=order_number)
    except Order.DoesNotExist:
        return Response({'error': 'Commande introuvable.'}, status=status.HTTP_404_NOT_FOUND)

    if order.status != 'pending':
        return Response({'error': 'Cette commande a déjà été traitée.'}, status=status.HTTP_400_BAD_REQUEST)

    amount = int(order.total)
    contact_name  = (order.address.full_name if order.address else None) or (order.user.full_name if order.user else 'Client')
    contact_phone = (order.address.phone if order.address else None) or (order.user.phone if order.user else '')
    contact_email = order.contact_email

    if provider == 'geniuspay':
        reference = _generate_reference('MA')
        payment = Payment.objects.create(order=order, provider=provider, transaction_id=reference, amount=amount, status='pending')

        success_url = f"{settings.FRONTEND_URL}/paiement/retour?order_number={order.order_number}&provider=geniuspay"
        error_url   = f"{settings.FRONTEND_URL}/paiement/retour?order_number={order.order_number}&provider=geniuspay&status=error"

        try:
            result = geniuspay.create_payment(
                amount=amount, description=f"Commande {order.order_number} — Mon Armoire",
                customer_name=contact_name, customer_phone=contact_phone, customer_email=contact_email,
                success_url=success_url, error_url=error_url,
                metadata={'order_number': order.order_number},
            )
        except geniuspay.GeniusPayError as exc:
            payment.status = 'failed'
            payment.raw_response = {'error': str(exc)}
            payment.save(update_fields=['status', 'raw_response'])
            return Response({'error': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        data = result.get('data', {})
        payment.transaction_id = data.get('reference', reference)
        payment.raw_response = result
        payment.save(update_fields=['transaction_id', 'raw_response'])

        return Response({'checkout_url': data.get('checkout_url', ''), 'reference': payment.transaction_id}, status=status.HTTP_201_CREATED)

    # ── Paystack ──────────────────────────────────────────────────────────────
    reference = _generate_reference('MAPS')
    payment = Payment.objects.create(order=order, provider=provider, transaction_id=reference, amount=amount, status='pending')

    callback_url = f"{settings.FRONTEND_URL}/paiement/retour?order_number={order.order_number}&provider=paystack"

    try:
        result = paystack_client.initialize(
            email=contact_email or 'client@monarmoire.store', amount_cfa=amount, reference=reference,
            callback_url=callback_url, metadata={'order_number': order.order_number},
        )
    except paystack_client.PaystackError as exc:
        payment.status = 'failed'
        payment.raw_response = {'error': str(exc)}
        payment.save(update_fields=['status', 'raw_response'])
        return Response({'error': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

    payment.raw_response = result
    payment.save(update_fields=['raw_response'])

    auth_url = (result.get('data') or {}).get('authorization_url', '')
    return Response({'authorization_url': auth_url, 'reference': reference}, status=status.HTTP_201_CREATED)


# ── Vérification (retour client) ──────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([AllowAny])
def payment_verify(request, order_number):
    provider = request.query_params.get('provider')

    try:
        order = Order.objects.get(order_number=order_number)
    except Order.DoesNotExist:
        return Response({'error': 'Commande introuvable.'}, status=status.HTTP_404_NOT_FOUND)

    if order.status == 'paid':
        return Response({'paid': True, 'order': _public_order(order)})

    payment = Payment.objects.filter(order=order, provider=provider).order_by('-created_at').first()
    if not payment:
        return Response({'error': 'Aucun paiement initié pour cette commande.'}, status=status.HTTP_404_NOT_FOUND)

    try:
        if provider == 'geniuspay':
            result = geniuspay.get_payment(payment.transaction_id)
            payment_status = (result.get('data') or {}).get('status', '')
            success = payment_status in ('completed', 'success', 'paid')
        else:
            result = paystack_client.verify(payment.transaction_id)
            payment_status = (result.get('data') or {}).get('status', '')
            success = payment_status == 'success'
    except (geniuspay.GeniusPayError, paystack_client.PaystackError) as exc:
        return Response({'paid': False, 'pending': True, 'message': str(exc)}, status=status.HTTP_202_ACCEPTED)

    payment.raw_response = result
    payment.save(update_fields=['raw_response'])

    if success:
        _mark_order_paid(order, payment)
        return Response({'paid': True, 'order': _public_order(order)})

    return Response({'paid': False, 'status': payment_status})


# ── Webhooks (notification serveur-à-serveur) ─────────────────────────────────
@api_view(['POST'])
@permission_classes([AllowAny])
def geniuspay_webhook(request):
    webhook_secret = getattr(settings, 'GENIUSPAY_WEBHOOK_SECRET', '') or ''
    if not webhook_secret:
        # Sans secret configuré, impossible d'authentifier l'appelant : on refuse plutôt que d'accepter n'importe quoi.
        return Response({'message': 'Webhook non configuré.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    sig = request.headers.get('X-Webhook-Signature', '')
    timestamp = request.headers.get('X-Webhook-Timestamp', '')
    if not sig or not timestamp:
        return Response({'message': 'Headers manquants.'}, status=status.HTTP_400_BAD_REQUEST)

    expected = hmac.new(
        webhook_secret.encode(), f"{timestamp}.{request.body.decode()}".encode(), hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, sig):
        return Response({'message': 'Signature invalide.'}, status=status.HTTP_400_BAD_REQUEST)

    event = request.headers.get('X-Webhook-Event') or request.data.get('event', '')
    data = request.data.get('data', {})

    if event in ('payment.success', 'payment.completed', 'payment.paid'):
        reference = data.get('reference') or (data.get('metadata') or {}).get('order_number')
        payment = Payment.objects.filter(transaction_id=reference, provider='geniuspay').select_related('order').first()
        if payment:
            _mark_order_paid(payment.order, payment, note='Paiement confirmé par webhook GeniusPay.')

    return Response({'message': 'ok'})


@api_view(['POST'])
@permission_classes([AllowAny])
def paystack_webhook(request):
    secret = getattr(settings, 'PAYSTACK_SECRET_KEY', '') or ''
    signature = request.META.get('HTTP_X_PAYSTACK_SIGNATURE', '')

    if not secret:
        return Response({'message': 'Webhook non configuré.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    computed = hmac.new(secret.encode('utf-8'), request.body or b'', hashlib.sha512).hexdigest()
    if not hmac.compare_digest(computed, signature):
        return Response({'message': 'Signature invalide.'}, status=status.HTTP_400_BAD_REQUEST)

    payload = request.data or {}
    event = payload.get('event')
    data = payload.get('data') or {}
    reference = data.get('reference')

    if event == 'charge.success' and reference:
        payment = Payment.objects.filter(transaction_id=reference, provider='paystack').select_related('order').first()
        if payment:
            _mark_order_paid(payment.order, payment, note='Paiement confirmé par webhook Paystack.')

    return Response({'ok': True})
