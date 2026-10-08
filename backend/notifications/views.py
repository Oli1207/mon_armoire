import datetime

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from userauths.permissions import staff_can

from common.http import public_cache
from common.throttles import SignupThrottle
from .models import VerseOverride, PushSubscription
from .serializers import PushSubscriptionSerializer
from .verse_selection import verse_for_date, natural_verse_for_date


@api_view(['GET'])
@permission_classes([AllowAny])
@public_cache(300)
def verse_of_the_day(request):
    verse = verse_for_date(datetime.date.today())
    if not verse:
        return Response({'error': 'Aucun verset disponible.'}, status=status.HTTP_404_NOT_FOUND)
    return Response(verse)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([SignupThrottle])
def push_subscribe(request):
    serializer = PushSubscriptionSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    user = request.user if request.user.is_authenticated else None
    PushSubscription.objects.update_or_create(
        endpoint=serializer.validated_data['endpoint'],
        defaults={
            'user': user,
            'p256dh_key': serializer.validated_data['p256dh_key'],
            'auth_key': serializer.validated_data['auth_key'],
        },
    )
    return Response({'message': 'Abonnement enregistré.'}, status=status.HTTP_201_CREATED)


# ── Back-office : planning de la semaine ─────────────────────────────────────
@api_view(['GET'])
@permission_classes([staff_can('settings')])
def verses_week(request):
    today = datetime.date.today()
    overrides = {o.date: o for o in VerseOverride.objects.filter(date__gte=today, date__lt=today + datetime.timedelta(days=7))}
    days = []
    for i in range(7):
        d = today + datetime.timedelta(days=i)
        natural = natural_verse_for_date(d)
        override = overrides.get(d)
        days.append({
            'date': d.isoformat(),
            'natural_text': natural.text if natural else '',
            'natural_reference': natural.reference if natural else '',
            'override_text': override.text if override else '',
            'override_reference': override.reference if override else '',
            'is_override': bool(override),
        })
    return Response(days)


@api_view(['PUT', 'DELETE'])
@permission_classes([staff_can('settings')])
def verse_override_detail(request, date):
    try:
        parsed_date = datetime.date.fromisoformat(date)
    except ValueError:
        return Response({'error': 'Date invalide (format attendu : AAAA-MM-JJ).'}, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'DELETE':
        VerseOverride.objects.filter(date=parsed_date).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    text = request.data.get('text', '').strip()
    reference = request.data.get('reference', '').strip()
    if not text or not reference:
        return Response({'error': 'Texte et référence requis.'}, status=status.HTTP_400_BAD_REQUEST)

    VerseOverride.objects.update_or_create(
        date=parsed_date, defaults={'text': text, 'reference': reference},
    )
    return Response({'message': 'Verset personnalisé enregistré.'}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([SignupThrottle])
def push_unsubscribe(request):
    """Désactive les notifications de cet appareil (l'adresse technique de l'appareil fait office de preuve)."""
    endpoint = str(request.data.get('endpoint') or '')[:500]
    if endpoint:
        PushSubscription.objects.filter(endpoint=endpoint).delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
