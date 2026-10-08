"""Équipe (comptes du personnel et leurs rôles) et journal des actions : réservés à la propriétaire (superuser)."""
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.core.exceptions import ValidationError
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.response import Response

from common.pagination import AdminPagination, paginate
from common.throttles import PasswordResetThrottle
from .models import AuditLog, StaffProfile, User, unique_username
from .permissions import PERMISSIONS, ROLES, role_permissions, staff_can
from .tokens import issue_reset_token

MAX_STAFF = 50


def _member(profile):
    return {
        'id': profile.id,
        'email': profile.user.email,
        'full_name': profile.user.full_name,
        'role': profile.role,
        'role_label': ROLES.get(profile.role, (profile.role,))[0],
        'extra_permissions': profile.extra_permissions,
        'permissions': sorted(role_permissions(profile.role, profile.extra_permissions)),
        'is_active': profile.is_active,
        'last_login': profile.user.last_login,
        'has_password': profile.user.has_usable_password(),
    }


def _meta():
    return {
        'roles': [{'key': k, 'label': v[0], 'description': v[1], 'permissions': sorted(v[2])} for k, v in ROLES.items()],
        'permissions': [{'key': k, 'label': v} for k, v in PERMISSIONS.items()],
    }


def _send_invitation(user):
    token = issue_reset_token(user)
    link = f'{settings.FRONTEND_URL}/reset-password?token={token}'
    send_mail(
        subject='Votre accès à l’administration de Mon Armoire',
        message=(
            f'Bonjour {user.full_name or ""},\n\n'
            'On vous a donné accès à l’espace Admin de Mon Armoire.\n'
            f'Choisissez votre mot de passe en cliquant sur ce lien (valable 1 heure) :\n\n{link}\n\n'
            'Ensuite, connectez-vous avec votre adresse e-mail, puis ouvrez « Admin » dans le menu.\n'
            'Si le lien a expiré, demandez à la propriétaire de vous renvoyer une invitation.'
        ),
        from_email=settings.DEFAULT_FROM_EMAIL, recipient_list=[user.email], fail_silently=True,
    )


class MemberWriteSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=list(ROLES), required=False)
    is_active = serializers.BooleanField(required=False)
    extra_permissions = serializers.DictField(child=serializers.BooleanField(), required=False)

    def validate_extra_permissions(self, value):
        unknown = set(value) - set(PERMISSIONS)
        if unknown:
            raise serializers.ValidationError('Droit inconnu.')
        return value


@api_view(['GET', 'POST'])
@permission_classes([staff_can('team')])
def admin_team(request):
    if request.method == 'GET':
        owners = User.objects.filter(is_staff=True, is_superuser=True).order_by('email')[:MAX_STAFF]
        members = StaffProfile.objects.select_related('user').order_by('user__email')[:MAX_STAFF]
        return Response({
            **_meta(),
            'owners': [{'email': o.email, 'full_name': o.full_name, 'last_login': o.last_login} for o in owners],
            'members': [_member(m) for m in members],
        })

    email = (request.data.get('email') or '').strip().lower()
    role = request.data.get('role')
    full_name = str(request.data.get('full_name') or '').strip()[:200]
    try:
        validate_email(email)
    except ValidationError:
        return Response({'email': 'Saisissez une adresse e-mail valide.'}, status=status.HTTP_400_BAD_REQUEST)
    if role not in ROLES:
        return Response({'role': 'Choisissez un rôle dans la liste.'}, status=status.HTTP_400_BAD_REQUEST)
    if StaffProfile.objects.count() >= MAX_STAFF:
        return Response({'error': f'Limite de {MAX_STAFF} membres atteinte.'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        user = User.objects.select_for_update().filter(email__iexact=email).first()
        if user and (user.is_superuser or hasattr(user, 'staff_profile')):
            return Response({'email': 'Cette personne fait déjà partie de l’équipe.'}, status=status.HTTP_400_BAD_REQUEST)
        if user is None:
            user = User(email=email, username=unique_username(email), full_name=full_name)
            user.set_unusable_password()
        elif full_name and not user.full_name:
            user.full_name = full_name
        user.is_staff = True
        try:
            user.save()
            profile = StaffProfile.objects.create(user=user, role=role, created_by=request.user)
        except IntegrityError:
            return Response({'error': 'Ce compte existe déjà.'}, status=status.HTTP_400_BAD_REQUEST)
        transaction.on_commit(lambda: _send_invitation(user))
    return Response(_member(profile), status=status.HTTP_201_CREATED)


@api_view(['PATCH', 'DELETE'])
@permission_classes([staff_can('team')])
def admin_team_detail(request, pk):
    try:
        profile = StaffProfile.objects.select_related('user').get(pk=pk)
    except (StaffProfile.DoesNotExist, ValueError):
        return Response({'error': 'Membre introuvable.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        # On retire seulement l'accès à l'Admin : le compte (et ses commandes éventuelles) reste.
        with transaction.atomic():
            user = profile.user
            profile.delete()
            user.is_staff = False
            user.save(update_fields=['is_staff'])
        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = MemberWriteSerializer(data=request.data, partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    data = serializer.validated_data
    if 'role' in data:
        profile.role = data['role']
        profile.extra_permissions = {}   # changer de rôle repart des droits standard du rôle
    if 'extra_permissions' in data:
        base = ROLES[profile.role][2]
        # on ne garde que les écarts réels par rapport au rôle
        profile.extra_permissions = {k: v for k, v in data['extra_permissions'].items() if (k in base) != v}
    if 'is_active' in data:
        profile.is_active = data['is_active']
    profile.save()
    if 'full_name' in data:
        profile.user.full_name = data['full_name'].strip()
        profile.user.save(update_fields=['full_name'])
    return Response(_member(profile))


@api_view(['POST'])
@permission_classes([staff_can('team')])
@throttle_classes([PasswordResetThrottle])
def admin_team_invite(request, pk):
    try:
        profile = StaffProfile.objects.select_related('user').get(pk=pk)
    except (StaffProfile.DoesNotExist, ValueError):
        return Response({'error': 'Membre introuvable.'}, status=status.HTTP_404_NOT_FOUND)
    _send_invitation(profile.user)
    return Response({'message': f'Invitation envoyée à {profile.user.email}.'})


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = ('id', 'created_at', 'actor_label', 'area', 'action', 'summary', 'status_code')


@api_view(['GET'])
@permission_classes([staff_can('journal')])
def admin_journal(request):
    qs = AuditLog.objects.all()
    search = (request.query_params.get('search') or '').strip()[:100]
    if search:
        qs = qs.filter(Q(actor_label__icontains=search) | Q(summary__icontains=search))
    action = request.query_params.get('action')
    if action in ('created', 'updated', 'deleted', 'denied', 'login'):
        qs = qs.filter(action=action)
    try:
        days = min(int(request.query_params.get('days', 0)), 730)
    except ValueError:
        days = 0
    if days > 0:
        qs = qs.filter(created_at__gte=timezone.now() - timedelta(days=days))
    return paginate(request, qs, AuditLogSerializer, pagination=AdminPagination)
