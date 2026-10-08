from django.urls import path

from . import views
from . import payment_views
from . import giftcard_views

urlpatterns = [
    path('cart/',                          views.cart_detail,      name='cart_detail'),
    path('cart/add/',                      views.cart_add,         name='cart_add'),
    path('cart/items/<uuid:item_id>/',     views.cart_item_update, name='cart_item_update'),
    path('cart/items/<uuid:item_id>/remove/', views.cart_item_remove, name='cart_item_remove'),

    path('delivery-zones/',                views.delivery_zones_list, name='delivery_zones_list'),

    path('orders/',                        views.order_create,     name='order_create'),
    path('orders/mine/',                   views.orders_list,      name='orders_list'),
    path('loyalty/balance/',               views.loyalty_balance,  name='loyalty_balance'),
    path('orders/track/',                  views.order_track,      name='order_track'),
    path('orders/<str:order_number>/',     views.order_detail,     name='order_detail'),
    path('orders/<str:order_number>/status/', views.order_update_status, name='order_update_status'),

    path('orders/<str:order_number>/pay/',        payment_views.payment_initiate, name='payment_initiate'),
    path('orders/<str:order_number>/pay/verify/', payment_views.payment_verify,   name='payment_verify'),
    path('payments/geniuspay/webhook/', payment_views.geniuspay_webhook, name='geniuspay_webhook'),
    path('payments/paystack/webhook/',  payment_views.paystack_webhook,  name='paystack_webhook'),

    path('giftcards/purchase/', giftcard_views.giftcard_purchase, name='giftcard_purchase'),
    path('giftcards/check/',    giftcard_views.giftcard_check,    name='giftcard_check'),
    path('admin/giftcards/',    giftcard_views.admin_giftcards_list, name='admin_giftcards_list'),
]
