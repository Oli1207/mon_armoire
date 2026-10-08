from decimal import Decimal
from io import StringIO
from unittest import mock

from django.core import mail
from django.core.management import call_command
from rest_framework.test import APITestCase

from catalog.models import Category, Product, ProductVariant, WaitlistEntry


class RestockNotificationTests(APITestCase):
    def setUp(self):
        category = Category.objects.create(name='Chaînes')
        self.product = Product.objects.create(name='Croix', category=category)
        self.variant = ProductVariant.objects.create(product=self.product, price=Decimal('1000'), stock=0, is_default=True)

    def run_command(self, **options):
        out = StringIO()
        call_command('send_restock_notifications', stdout=out, **options)
        return out.getvalue()

    def test_nothing_is_sent_while_the_item_is_out_of_stock(self):
        WaitlistEntry.objects.create(variant=self.variant, email='a@test.ci')
        self.run_command()
        self.assertEqual(len(mail.outbox), 0)
        self.assertFalse(WaitlistEntry.objects.get().notified)

    def test_email_is_sent_once_when_back_in_stock(self):
        WaitlistEntry.objects.create(variant=self.variant, email='a@test.ci', name='Awa')
        ProductVariant.objects.filter(pk=self.variant.pk).update(stock=3)
        self.run_command()
        self.run_command()
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['a@test.ci'])
        self.assertTrue(WaitlistEntry.objects.get().notified)

    def test_limit_is_respected(self):
        ProductVariant.objects.filter(pk=self.variant.pk).update(stock=3)
        for i in range(5):
            WaitlistEntry.objects.create(variant=self.variant, email=f'p{i}@test.ci')
        self.run_command(limit=2)
        self.assertEqual(len(mail.outbox), 2)
        self.run_command(limit=10)
        self.assertEqual(len(mail.outbox), 5)

    def test_failed_email_is_retried_next_time(self):
        ProductVariant.objects.filter(pk=self.variant.pk).update(stock=3)
        WaitlistEntry.objects.create(variant=self.variant, email='a@test.ci')
        with mock.patch('catalog.management.commands.send_restock_notifications.send_restock_notification', side_effect=OSError('SMTP')):
            self.assertIn('1 échec', self.run_command())
        self.assertFalse(WaitlistEntry.objects.get().notified)
        self.run_command()
        self.assertTrue(WaitlistEntry.objects.get().notified)

    def test_inactive_products_are_skipped(self):
        ProductVariant.objects.filter(pk=self.variant.pk).update(stock=3)
        Product.objects.filter(pk=self.product.pk).update(is_active=False)
        WaitlistEntry.objects.create(variant=self.variant, email='a@test.ci')
        self.run_command()
        self.assertEqual(len(mail.outbox), 0)


class WaitlistContactTests(APITestCase):
    def setUp(self):
        from django.core.cache import cache
        from notifications.models import PushSubscription
        from userauths.models import User
        cache.clear()   # la limite d'inscriptions par minute ne doit pas fuir d'un test à l'autre
        category = Category.objects.create(name='Chaînes')
        self.product = Product.objects.create(name='Croix', category=category)
        self.variant = ProductVariant.objects.create(product=self.product, price=Decimal('1000'), stock=0, is_default=True)
        self.subscription = PushSubscription.objects.create(endpoint='https://push.example/abc', p256dh_key='k', auth_key='a')
        self.owner = User.objects.create_user(username='boss', email='boss@test.ci', password='x', is_staff=True, is_superuser=True)

    def join(self, **data):
        payload = {'variant': str(self.variant.id), 'email': 'awa@test.ci', 'phone': '07 99 16 73 93', **data}
        return self.client.post('/api/waitlist/', payload, format='json')

    def test_email_and_phone_are_both_required_with_clear_messages(self):
        self.assertEqual(self.join().status_code, 201)
        for bad in ('', 'abc', '123', '0799;DROP', '+' + '9' * 20):
            response = self.join(email='b@test.ci', phone=bad)
            self.assertEqual(response.status_code, 400, bad)
            self.assertIn('phone', response.data)
        self.assertEqual(self.join(email='pas-un-mail').status_code, 400)
        self.assertEqual(self.join(email='').status_code, 400)

    def test_phone_is_normalised_and_push_subscription_is_linked(self):
        response = self.join(phone='+225 07-99-16-73-93', push_endpoint=self.subscription.endpoint)
        self.assertEqual(response.status_code, 201)
        entry = WaitlistEntry.objects.get()
        self.assertEqual(entry.phone, '+2250799167393')
        self.assertEqual(entry.push_subscription, self.subscription)
        self.assertEqual(self.join(push_endpoint='https://inconnu.example/x', email='c@test.ci').status_code, 201)
        self.assertIsNone(WaitlistEntry.objects.get(email='c@test.ci').push_subscription)

    def test_joining_again_updates_contact_details_instead_of_failing(self):
        self.join()
        response = self.join(phone='05 11 22 33 44')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(WaitlistEntry.objects.get().phone, '0511223344')

    def test_restock_sends_push_in_addition_to_email_and_only_once(self):
        self.join(push_endpoint=self.subscription.endpoint)
        ProductVariant.objects.filter(pk=self.variant.pk).update(stock=2)
        with mock.patch('catalog.management.commands.send_restock_notifications.send_push', return_value='sent') as push:
            call_command('send_restock_notifications', stdout=StringIO())
            call_command('send_restock_notifications', stdout=StringIO())
        self.assertEqual(push.call_count, 1)
        self.assertEqual(push.call_args.args[3], f'/produits/{self.product.slug}')
        self.assertEqual(len(mail.outbox), 1)
        entry = WaitlistEntry.objects.get()
        self.assertTrue(entry.notified and entry.push_notified)

    def test_failed_push_is_retried_without_resending_the_email(self):
        self.join(push_endpoint=self.subscription.endpoint)
        ProductVariant.objects.filter(pk=self.variant.pk).update(stock=2)
        with mock.patch('catalog.management.commands.send_restock_notifications.send_push', return_value='failed'):
            call_command('send_restock_notifications', stdout=StringIO())
        self.assertEqual((len(mail.outbox), WaitlistEntry.objects.get().push_notified), (1, False))
        with mock.patch('catalog.management.commands.send_restock_notifications.send_push', return_value='sent'):
            call_command('send_restock_notifications', stdout=StringIO())
        self.assertEqual((len(mail.outbox), WaitlistEntry.objects.get().push_notified), (1, True))

    def test_expired_subscription_is_removed_and_email_still_goes(self):
        from notifications.models import PushSubscription
        self.join(push_endpoint=self.subscription.endpoint)
        ProductVariant.objects.filter(pk=self.variant.pk).update(stock=2)
        with mock.patch('catalog.management.commands.send_restock_notifications.send_push', return_value='gone'):
            call_command('send_restock_notifications', stdout=StringIO())
        self.assertFalse(PushSubscription.objects.exists())
        self.assertEqual(len(mail.outbox), 1)
        self.assertIsNone(WaitlistEntry.objects.get().push_subscription)

    def test_admin_sees_contacts_filters_and_marks_manual_reminders_without_pii_in_journal(self):
        from userauths.models import AuditLog
        self.join()
        self.client.credentials(HTTP_AUTHORIZATION='Bearer test')
        self.client.force_authenticate(self.owner)
        row = self.client.get('/api/admin/waitlist/').data['results'][0]
        self.assertEqual((row['phone'], row['in_stock'], row['contacted'], row['product_slug']), ('0799167393', False, False, self.product.slug))
        self.assertEqual(self.client.get('/api/admin/waitlist/', {'state': 'to_call'}).data['count'], 0)
        ProductVariant.objects.filter(pk=self.variant.pk).update(stock=1)
        self.assertEqual(self.client.get('/api/admin/waitlist/', {'state': 'to_call'}).data['count'], 1)
        self.assertEqual(self.client.get('/api/admin/waitlist/', {'search': '0799'}).data['count'], 1)
        done = self.client.patch(f'/api/admin/waitlist/{row["id"]}/', {'contacted': True}, format='json')
        self.assertTrue(done.data['contacted'])
        self.assertIsNotNone(done.data['contacted_at'])
        self.assertEqual(self.client.get('/api/admin/waitlist/', {'state': 'to_call'}).data['count'], 0)
        self.assertEqual(self.client.get('/api/admin/waitlist/', {'state': 'contacted'}).data['count'], 1)
        entry = AuditLog.objects.get(summary__startswith='Inscription')
        self.assertNotIn('awa@test.ci', entry.summary)
        self.assertNotIn('0799', entry.summary)
        self.assertEqual(self.client.delete(f'/api/admin/waitlist/{row["id"]}/').status_code, 204)
        self.assertFalse(WaitlistEntry.objects.exists())

    def test_role_without_waitlist_right_is_refused(self):
        from userauths.models import StaffProfile, User
        member = User.objects.create_user(username='m', email='m@test.ci', password='x', is_staff=True)
        StaffProfile.objects.create(user=member, role='catalog')   # le rôle Catalogue inclut « waitlist »
        member2 = User.objects.create_user(username='m2', email='m2@test.ci', password='x', is_staff=True)
        StaffProfile.objects.create(user=member2, role='orders')
        self.client.force_authenticate(member)
        self.assertEqual(self.client.get('/api/admin/waitlist/').status_code, 200)
        self.client.force_authenticate(member2)
        self.assertEqual(self.client.get('/api/admin/waitlist/').status_code, 403)
