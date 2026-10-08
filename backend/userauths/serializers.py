from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from catalog.serializers import ProductListSerializer
from common.places import clean_place
from .models import AuditLog, User, Address, Favorite, unique_username
from .permissions import ROLES, effective_permissions


# ── JWT token enrichi ─────────────────────────────────────────────────────────
class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['email']     = user.email
        token['full_name'] = user.full_name
        token['username']  = user.username
        token['is_staff']  = user.is_staff
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        if self.user.is_staff:   # connexion du personnel : tracée dans le journal
            AuditLog.objects.create(actor=self.user, actor_label=self.user.email[:254], action='login', summary='Connexion à l’espace Admin')
        return data


# ── Inscription ───────────────────────────────────────────────────────────────
class RegisterSerializer(serializers.ModelSerializer):
    password       = serializers.CharField(write_only=True, validators=[validate_password])
    password2      = serializers.CharField(write_only=True)
    referral_code  = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model  = User
        fields = ('email', 'full_name', 'phone', 'password', 'password2', 'referral_code')

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({'password': 'Les mots de passe ne correspondent pas.'})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password2')
        referral_code = (validated_data.pop('referral_code', '') or '').strip().upper()
        referrer = User.objects.filter(referral_code=referral_code).first() if referral_code else None

        user = User.objects.create_user(
            username  = unique_username(validated_data['email']),
            email     = validated_data['email'],
            full_name = validated_data.get('full_name', ''),
            phone     = validated_data.get('phone', ''),
            password  = validated_data['password'],
            referred_by = referrer,
        )

        if referrer:
            from orders.models import LoyaltyTransaction
            LoyaltyTransaction.objects.create(
                user=user, points=10, reason='referral',
                note=f'Bienvenue — parrainé(e) par {referrer.full_name or referrer.email}',
            )

        return user


# ── Profil ────────────────────────────────────────────────────────────────────
class UserSerializer(serializers.ModelSerializer):
    referrals_count = serializers.IntegerField(source='referrals.count', read_only=True)
    staff           = serializers.SerializerMethodField()

    class Meta:
        model  = User
        fields = ('id', 'email', 'username', 'full_name', 'phone', 'is_staff', 'staff', 'referral_code', 'referrals_count')
        read_only_fields = ('id', 'email', 'username', 'is_staff', 'staff', 'referral_code', 'referrals_count')

    def get_staff(self, user):
        """Droits du personnel (le menu Admin n'affiche que ce qui est permis ; le serveur revérifie chaque action)."""
        perms = effective_permissions(user)
        if not perms:
            return None
        profile = getattr(user, 'staff_profile', None)
        return {
            'is_owner': user.is_superuser,
            'role': 'Propriétaire' if user.is_superuser else ROLES.get(profile.role, (profile.role,))[0],
            'permissions': sorted(perms),
            'tour_seen': user.tour_seen_at is not None,
        }


# ── Changement de mot de passe ────────────────────────────────────────────────
class ChangePasswordSerializer(serializers.Serializer):
    old_password  = serializers.CharField(required=True)
    new_password  = serializers.CharField(required=True, validators=[validate_password])
    new_password2 = serializers.CharField(required=True)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password2']:
            raise serializers.ValidationError({'new_password': 'Les mots de passe ne correspondent pas.'})
        return attrs


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)


class ResetPasswordSerializer(serializers.Serializer):
    token        = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])


# ── Adresses ──────────────────────────────────────────────────────────────────
class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Address
        fields = ('id', 'label', 'full_name', 'phone', 'country', 'city', 'commune', 'quartier', 'street', 'is_default')
        extra_kwargs = {'commune': {'required': False}, 'quartier': {'required': False}}

    def validate(self, attrs):
        # Création, ou modification de la ville / commune / quartier : le lieu doit être complet (les anciennes adresses restent modifiables autrement)
        touched = self.instance is None or {'city', 'commune', 'quartier'} & set(attrs)
        if touched:
            city = attrs.get('city', getattr(self.instance, 'city', ''))
            commune = attrs.get('commune', getattr(self.instance, 'commune', ''))
            quartier = attrs.get('quartier', getattr(self.instance, 'quartier', ''))
            attrs['commune'], attrs['quartier'], error = clean_place(city, commune, quartier)
            if error:
                raise serializers.ValidationError({'quartier' if 'quartier' in error else 'commune': error})
        return attrs


# ── Favoris ───────────────────────────────────────────────────────────────────
class FavoriteSerializer(serializers.ModelSerializer):
    product = ProductListSerializer(read_only=True)

    class Meta:
        model  = Favorite
        fields = ('id', 'product', 'created_at')
