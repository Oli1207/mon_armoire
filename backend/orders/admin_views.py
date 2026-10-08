from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from common.admin_crud import list_create, update_delete
from .models import DeliveryZone


class DeliveryZoneAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model  = DeliveryZone
        fields = ('id', 'name', 'shipping_cost', 'estimated_days_min', 'estimated_days_max', 'is_active')

    def validate_shipping_cost(self, value):
        if value < 0 or value > 1_000_000:
            raise serializers.ValidationError('Le tarif doit être compris entre 0 et 1 000 000 FCFA.')
        return value

    def validate(self, attrs):
        low = attrs.get('estimated_days_min', getattr(self.instance, 'estimated_days_min', 1))
        high = attrs.get('estimated_days_max', getattr(self.instance, 'estimated_days_max', 3))
        if high < low:
            raise serializers.ValidationError({'estimated_days_max': 'Le délai maximum ne peut pas être inférieur au délai minimum.'})
        return attrs


@api_view(['GET', 'POST'])
@permission_classes([IsAdminUser])
def admin_zones(request):
    return list_create(request, DeliveryZone.objects.order_by('name'), DeliveryZoneAdminSerializer)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAdminUser])
def admin_zone_detail(request, pk):
    try:
        zone = DeliveryZone.objects.get(pk=pk)
    except (DeliveryZone.DoesNotExist, ValueError):
        return Response({'error': 'Zone introuvable.'}, status=status.HTTP_404_NOT_FOUND)
    return update_delete(request, zone, DeliveryZoneAdminSerializer)
