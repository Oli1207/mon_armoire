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
