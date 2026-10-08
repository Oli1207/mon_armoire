"""Textes et contacts du site : lecture publique (légère, mise en cache), modification réservée au droit « réglages »."""
import re

from rest_framework import serializers, status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from userauths.permissions import staff_can

from .http import public_cache
from .models import SiteSettings
from .uploads import ValidatedImagesMixin

PUBLIC_FIELDS = (
    'announcement', 'hero_kicker', 'hero_title', 'hero_text', 'hero_image', 'footer_text', 'tagline',
    'contact_email', 'phone', 'whatsapp', 'instagram', 'tiktok', 'facebook', 'youtube', 'location',
)
LEGAL_FIELDS = ('terms_text', 'privacy_text')
PRIVATE_FIELDS = ('notify_email',)   # jamais dans la réponse publique
SOCIAL_FIELDS = ('instagram', 'tiktok', 'facebook', 'youtube')


class SiteSettingsSerializer(ValidatedImagesMixin, serializers.ModelSerializer):
    class Meta:
        model = SiteSettings
        fields = PUBLIC_FIELDS + LEGAL_FIELDS + PRIVATE_FIELDS
        extra_kwargs = {name: {'required': False} for name in PUBLIC_FIELDS + LEGAL_FIELDS + PRIVATE_FIELDS}

    def validate_whatsapp(self, value):
        digits = re.sub(r'[\s+().-]', '', value or '')
        if digits and not re.fullmatch(r'\d{8,15}', digits):
            raise serializers.ValidationError('Saisissez le numéro avec l’indicatif, en chiffres (ex : 2250799167393).')
        return digits

    def validate(self, attrs):
        attrs = super().validate(attrs)   # vérifie aussi l'image envoyée
        for name in SOCIAL_FIELDS:
            url = attrs.get(name)
            if url and not url.lower().startswith('https://'):
                raise serializers.ValidationError({name: 'Le lien doit commencer par https:// (copiez-le depuis la barre d’adresse).'})
        return attrs


@api_view(['GET'])
@permission_classes([AllowAny])
@public_cache(120)
def site_public(request):
    row = SiteSettings.load()
    data = SiteSettingsSerializer(row, context={'request': request}).data
    return Response({
        **{name: data[name] for name in PUBLIC_FIELDS},
        'has_terms': bool(row.terms_text.strip()),     # les pages juridiques n'apparaissent dans le pied de page que si elles existent
        'has_privacy': bool(row.privacy_text.strip()),
    })


@api_view(['GET'])
@permission_classes([AllowAny])
@public_cache(300)
def site_legal(request):
    settings_row = SiteSettings.load()
    return Response({name: getattr(settings_row, name) for name in LEGAL_FIELDS})


@api_view(['GET', 'PATCH'])
@permission_classes([staff_can('settings')])
@parser_classes([JSONParser, MultiPartParser, FormParser])
def admin_site_settings(request):
    row = SiteSettings.load()
    if request.method == 'GET':
        return Response(SiteSettingsSerializer(row, context={'request': request}).data)
    serializer = SiteSettingsSerializer(row, data=request.data, partial=True, context={'request': request})
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
