import time

from django.conf import settings
from django.core.mail import send_mail
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.views import TokenObtainPairView

from common.pagination import paginate
from .tokens import RESET_TOKEN_TTL, hash_token, issue_reset_token
from common.throttles import LoginThrottle, PasswordResetThrottle, SignupThrottle
from catalog.models import Product
from .models import User, Address, Favorite
from .serializers import (
    MyTokenObtainPairSerializer,
    RegisterSerializer,
    UserSerializer,
    ChangePasswordSerializer,
    ForgotPasswordSerializer,
    ResetPasswordSerializer,
    AddressSerializer,
    FavoriteSerializer,
)


def revoke_all_sessions(user):
    """Invalide tous les refresh tokens du compte (après changement ou réinitialisation du mot de passe)."""
    for outstanding in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=outstanding)


# ── JWT login (rate-limité : 10 tentatives/minute par IP) ────────────────────
class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer
    throttle_classes = [LoginThrottle]


# ── Inscription ───────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([SignupThrottle])
def register_view(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response({'message': 'Compte créé avec succès.'}, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ── Profil courant ────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me_view(request):
    return Response(UserSerializer(request.user).data)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_profile_view(request):
    serializer = UserSerializer(request.user, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ── Changement de mot de passe ────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password_view(request):
    serializer = ChangePasswordSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    user = request.user
    if not user.check_password(serializer.validated_data['old_password']):
        return Response({'old_password': 'Mot de passe actuel incorrect.'}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(serializer.validated_data['new_password'])
    user.save()
    return Response({'message': 'Mot de passe modifié avec succès.'})


# ── Mot de passe oublié (rate-limité : 5 demandes/minute par IP) ─────────────
@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([PasswordResetThrottle])
def forgot_password_view(request):
    serializer = ForgotPasswordSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    email = serializer.validated_data['email']
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        # Réponse identique qu'il existe ou non — évite l'énumération d'emails
        return Response({'message': 'Si ce compte existe, un email a été envoyé.'})

    token = issue_reset_token(user)

    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    send_mail(
        subject='Réinitialisation de votre mot de passe — Mon Armoire',
        message=(
            f"Cliquez sur ce lien pour réinitialiser votre mot de passe :\n\n"
            f"{reset_url}\n\nCe lien expire dans 1 heure."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=True,
    )
    return Response({'message': 'Si ce compte existe, un email a été envoyé.'})


# ── Réinitialisation du mot de passe ─────────────────────────────────────────
@api_view(['POST'])
@permission_classes([AllowAny])
def reset_password_view(request):
    serializer = ResetPasswordSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    token = serializer.validated_data['token']
    try:
        ts_str, _ = token.split(':', 1)
        if time.time() - int(ts_str) > RESET_TOKEN_TTL:
            return Response({'error': 'Ce lien a expiré. Veuillez faire une nouvelle demande.'}, status=status.HTTP_400_BAD_REQUEST)
    except (ValueError, AttributeError):
        return Response({'error': 'Lien invalide ou expiré.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.get(reset_token=hash_token(token))
    except User.DoesNotExist:
        return Response({'error': 'Lien invalide ou expiré.'}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(serializer.validated_data['new_password'])
    user.reset_token = None
    user.save()
    revoke_all_sessions(user)
    return Response({'message': 'Mot de passe réinitialisé avec succès.'})


# ── Adresses ──────────────────────────────────────────────────────────────────
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def addresses_view(request):
    if request.method == 'GET':
        qs = Address.objects.filter(user=request.user)
        return Response(AddressSerializer(qs, many=True).data)

    serializer = AddressSerializer(data=request.data)
    if serializer.is_valid():
        if serializer.validated_data.get('is_default'):
            Address.objects.filter(user=request.user, is_default=True).update(is_default=False)
        serializer.save(user=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def address_detail_view(request, address_id):
    try:
        address = Address.objects.get(id=address_id, user=request.user)
    except Address.DoesNotExist:
        return Response({'error': 'Adresse introuvable.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        address.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = AddressSerializer(address, data=request.data, partial=True)
    if serializer.is_valid():
        if serializer.validated_data.get('is_default'):
            Address.objects.filter(user=request.user, is_default=True).exclude(id=address.id).update(is_default=False)
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ── Favoris ───────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def favorites_list(request):
    qs = (
        Favorite.objects.filter(user=request.user)
        .select_related('product__category').prefetch_related('product__variants', 'product__images')
    )
    return paginate(request, qs, FavoriteSerializer, context={'request': request})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def favorite_ids(request):
    """Identifiants seuls (cœurs allumés dans le catalogue et les fiches) : réponse minimale, sans pagination."""
    return Response(list(Favorite.objects.filter(user=request.user).values_list('product_id', flat=True)))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def favorite_toggle(request, product_id):
    try:
        product = Product.objects.get(id=product_id, is_active=True)
    except Product.DoesNotExist:
        return Response({'error': 'Produit introuvable.'}, status=status.HTTP_404_NOT_FOUND)

    obj, created = Favorite.objects.get_or_create(user=request.user, product=product)
    if not created:
        obj.delete()
        return Response({'status': 'removed'})
    return Response({'status': 'added'}, status=status.HTTP_201_CREATED)
