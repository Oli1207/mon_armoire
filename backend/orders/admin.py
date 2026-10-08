from django.contrib import admin

from .models import DeliveryZone, Cart, CartItem, GiftCard, LoyaltyTransaction, Order, OrderItem, OrderStatusHistory, Payment


@admin.register(DeliveryZone)
class DeliveryZoneAdmin(admin.ModelAdmin):
    list_display = ('name', 'shipping_cost', 'estimated_days_min', 'estimated_days_max', 'is_active')
    list_filter  = ('is_active',)


class CartItemInline(admin.TabularInline):
    model = CartItem
    extra = 0


@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):
    inlines       = [CartItemInline]
    list_display  = ('id', 'user', 'session_key', 'created_at')
    search_fields = ('user__email', 'session_key')


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0


class OrderStatusHistoryInline(admin.TabularInline):
    model           = OrderStatusHistory
    extra           = 0
    readonly_fields = ('created_at',)


class PaymentInline(admin.TabularInline):
    model           = Payment
    extra           = 0
    readonly_fields = ('created_at',)


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    inlines         = [OrderItemInline, OrderStatusHistoryInline, PaymentInline]
    list_display    = ('order_number', 'client', 'status', 'delivery_method', 'total', 'created_at')
    list_filter     = ('status', 'delivery_method')
    search_fields   = ('order_number', 'user__email', 'guest_email')
    readonly_fields = ('order_number', 'created_at', 'updated_at')

    def client(self, obj):
        return obj.contact_email
    client.short_description = 'Client'


@admin.register(GiftCard)
class GiftCardAdmin(admin.ModelAdmin):
    list_display    = ('code', 'balance', 'initial_value', 'status', 'purchaser_email', 'recipient_email', 'created_at')
    list_filter     = ('status',)
    search_fields   = ('code', 'purchaser_email', 'recipient_email')
    readonly_fields = ('code', 'purchase_order', 'created_at')


@admin.register(LoyaltyTransaction)
class LoyaltyTransactionAdmin(admin.ModelAdmin):
    list_display    = ('user', 'points', 'reason', 'order', 'created_at')
    list_filter     = ('reason',)
    search_fields   = ('user__email',)
    readonly_fields = ('created_at',)
