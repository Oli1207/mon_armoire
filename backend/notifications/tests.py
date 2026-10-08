from decimal import Decimal
from io import StringIO
from unittest import mock

from django.core import mail
from django.core.cache import cache
from django.core.management import call_command
from rest_framework.test import APITestCase

from catalog.models import Category, Product, ProductVariant
from common.models import SiteSettings
from notifications.models import Alert, PushSubscription
from orders.models import Order, OrderItem
from orders.services import mark_order_paid
from userauths.models import StaffProfile, User

SEND = 'notifications.management.commands.send_pending_alerts.send_push'


def staff(email, role):
    user = User.objects.create_user(username=email.split('@')[0], email=email, password='x', is_staff=True)
    StaffProfile.objects.create(user=user, role=role)
    return user


def device(user, name):
    return PushSubscription.objects.create(user=user, endpoint=f'https://push.example/{name}', p256dh_key='k', auth_key='a')


class AlertTests(APITestCase):
    def setUp(self):
        cache.clear()
        category = Category.objects.create(name='Chaînes')
        self.product = Product.objects.create(name='Croix', category=category)
        self.variant = ProductVariant.objects.create(product=self.product, price=Decimal('5000'), stock=3, is_default=True)
        self.customer = User.objects.create_user(username='c', email='c@test.ci', password='x')
        self.owner = User.objects.create_user(username='boss', email='boss@test.ci', password='x', is_staff=True, is_superuser=True)

    def paid_order(self, quantity=1, engraving=''):
        order = Order.objects.create(user=self.customer, total=Decimal('5000') * quantity, status='pending')
        OrderItem.objects.create(
            order=order, variant=self.variant, quantity=quantity, unit_price=Decimal('5000'), engraving_text=engraving,
        )
        mark_order_paid(order)
        return order

    def test_paid_order_queues_staff_alert_and_customer_push_once(self):
        order = self.paid_order(engraving='Awa')
        staff_alert = Alert.objects.get(kind='order_paid')
        self.assertEqual((staff_alert.perm, staff_alert.url), ('orders', '/admin/commandes'))
        self.assertIn(order.order_number, staff_alert.body)
        self.assertIn('gravure', staff_alert.body)
        self.assertEqual(Alert.objects.get(kind='order_status').user, self.customer)
        mark_order_paid(order)   # appel répété : aucune alerte en plus
        self.assertEqual(Alert.objects.filter(kind='order_paid').count(), 1)

    def test_low_stock_and_out_of_stock_alerts(self):
        self.paid_order(quantity=1)    # il en reste 2
        self.assertEqual(Alert.objects.get(kind='low_stock').perm, 'catalog')
        self.paid_order(quantity=2)    # il n'en reste plus
        self.assertTrue(Alert.objects.filter(kind='out_of_stock', body__contains='Croix').exists())

    def test_alerts_reach_only_staff_with_the_right_and_only_subscribed_devices(self):
        prep, catalog = staff('prep@test.ci', 'orders'), staff('cat@test.ci', 'catalog')
        for user, name in ((self.owner, 'owner'), (prep, 'prep'), (catalog, 'catalog'), (self.customer, 'client')):
            device(user, name)
        self.paid_order()
        with mock.patch(SEND, return_value='sent') as push:
            call_command('send_pending_alerts', stdout=StringIO())
        reached = {(call.args[0].endpoint.rsplit('/', 1)[1], call.args[1]) for call in push.call_args_list}
        self.assertIn(('owner', 'Nouvelle commande payée'), reached)
        self.assertIn(('prep', 'Nouvelle commande payée'), reached)
        self.assertNotIn(('catalog', 'Nouvelle commande payée'), reached)   # le rôle Catalogue ne voit pas les commandes
        self.assertIn(('catalog', 'Stock faible'), reached)
        self.assertNotIn(('prep', 'Stock faible'), reached)
        self.assertIn(('client', 'Paiement reçu'), reached)
        self.assertNotIn(('client', 'Nouvelle commande payée'), reached)   # une cliente ne reçoit jamais les alertes de l'équipe
        self.assertFalse(Alert.objects.filter(done_at__isnull=True).exists())

    def test_email_goes_to_the_private_address_and_is_never_public(self):
        SiteSettings.objects.update_or_create(pk=1, defaults={'notify_email': 'patronne@test.ci'})
        self.paid_order()
        call_command('send_pending_alerts', stdout=StringIO())
        self.assertEqual({m.to[0] for m in mail.outbox}, {'patronne@test.ci'})
        self.assertIn('/admin/commandes', mail.outbox[0].body)
        self.assertNotIn('notify_email', self.client.get('/api/site/').data)

    def test_failed_push_is_retried_then_abandoned_and_expired_devices_removed(self):
        device(self.owner, 'owner')
        self.paid_order()
        with mock.patch(SEND, return_value='failed'):
            for _ in range(5):
                call_command('send_pending_alerts', stdout=StringIO())
        self.assertFalse(Alert.objects.filter(done_at__isnull=True).exists())   # abandonnées après 5 essais
        Alert.objects.all().delete()
        self.paid_order()
        with mock.patch(SEND, return_value='gone'):
            call_command('send_pending_alerts', stdout=StringIO())
        self.assertFalse(PushSubscription.objects.filter(endpoint='https://push.example/owner').exists())

    def test_delivery_is_not_repeated_once_done(self):
        device(self.owner, 'owner')
        self.paid_order()
        with mock.patch(SEND, return_value='sent') as first:
            call_command('send_pending_alerts', stdout=StringIO())
        self.assertGreaterEqual(first.call_count, 1)
        with mock.patch(SEND, return_value='sent') as again:
            call_command('send_pending_alerts', stdout=StringIO())
        self.assertEqual(again.call_count, 0)

    def test_new_review_and_waitlist_alerts(self):
        self.client.force_authenticate(self.customer)
        response = self.client.post(f'/api/products/{self.product.slug}/reviews/', {'rating': 5, 'comment': 'Superbe'}, format='json')
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(Alert.objects.get(kind='new_review').perm, 'reviews')
        self.client.force_authenticate(None)
        self.client.post('/api/waitlist/', {'variant': str(self.variant.id), 'email': 'a@test.ci', 'phone': '07 99 16 73 93'}, format='json')
        self.assertEqual(Alert.objects.get(kind='waitlist').perm, 'waitlist')

    def test_unsubscribe_removes_the_device(self):
        device(self.owner, 'owner')
        self.client.post('/api/notifications/push-unsubscribe/', {'endpoint': 'https://push.example/owner'}, format='json')
        self.assertFalse(PushSubscription.objects.exists())

    def test_a_problem_in_the_queue_never_breaks_an_order(self):
        with mock.patch('notifications.alerts.Alert.objects.create', side_effect=RuntimeError('base indisponible')):
            order = self.paid_order()
        order.refresh_from_db()
        self.assertEqual(order.status, 'paid')
