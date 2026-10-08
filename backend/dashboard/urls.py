from django.urls import path

from . import views

urlpatterns = [
    path('admin/stats/',                      views.stats_overview,   name='admin_stats'),
    path('admin/customers/',                  views.customers_list,   name='admin_customers_list'),
    path('admin/customers/<uuid:user_id>/',   views.customer_detail,  name='admin_customer_detail'),
    path('admin/orders/',                     views.admin_orders_list, name='admin_orders_list'),
]
