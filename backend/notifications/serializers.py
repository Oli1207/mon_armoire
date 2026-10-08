from rest_framework import serializers

from .models import Verse, PushSubscription


class VerseSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Verse
        fields = ('id', 'text', 'reference')


class PushSubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model  = PushSubscription
        fields = ('endpoint', 'p256dh_key', 'auth_key')
