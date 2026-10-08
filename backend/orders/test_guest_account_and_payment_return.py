from decimal import Decimal

from django.core import mail
from rest_framework.test import APITestCase

from catalog.models import Category, Product, ProductVariant
from orders.models import Cart, CartItem, Order, Payment
from userauths.models import User


class GuestAccountTests(APITestCase):
    def setUp(self):
        category = Category.objects.create(name='Chaînes')
        product = Product.objects.create(name='Croix', category=category)
        self.variant = ProductVariant.objects.create(product=product, price=Decimal('10000'), stock=5, is_default=True)
        self.cart = Cart.objects.create()
        CartItem.objects.create(cart=self.cart, variant=self.variant, quantity=1)

    def order_as_guest(self):
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post('/api/orders/', {
                'cart_id': str(self.cart.id), 'delivery_method': 'pickup', 'email': 'nouvelle@test.ci',
                'full_name': 'Nouvelle Cliente', 'phone': '0102030405', 'create_account': True,
            }, format='json')

    def test_account_is_created_without_any_emailed_password(self):
        response = self.order_as_guest()
        self.assertEqual(response.status_code, 201, response.content)
        user = User.objects.get(email='nouvelle@test.ci')
        self.assertFalse(user.has_usable_password())
        body = mail.outbox[-1].body
        self.assertNotIn('Mot de passe temporaire', body)
        self.assertIn('/reset-password?token=', body)

    def test_link_in_the_email_lets_her_choose_a_password(self):
        self.order_as_guest()
        token = mail.outbox[-1].body.split('token=')[1].split()[0]
        reset = self.client.post('/api/auth/reset-password/', {'token': token, 'new_password': 'Mon-mot-de-passe-9'}, format='json')
        self.assertEqual(reset.status_code, 200, reset.content)
        login = self.client.post('/api/auth/token/', {'email': 'nouvelle@test.ci', 'password': 'Mon-mot-de-passe-9'}, format='json')
        self.assertEqual(login.status_code, 200, login.content)

    def test_token_is_stored_hashed(self):
        self.order_as_guest()
        token = mail.outbox[-1].body.split('token=')[1].split()[0]
        self.assertNotEqual(User.objects.get(email='nouvelle@test.ci').reset_token, token)


class PaymentReturnPrivacyTests(APITestCase):
    def test_public_payment_return_exposes_no_personal_data(self):
        user = User.objects.create_user(username='u', email='u@test.ci', password='Test-pass-123', full_name='Une Cliente')
        address = user.addresses.create(full_name='Une Cliente', phone='0102030405', city='Abidjan', street='Cocody, rue 12')
        order = Order.objects.create(user=user, address=address, total=Decimal('5000'), status='paid')
        Payment.objects.create(order=order, provider='paystack', transaction_id='X', amount=order.total, status='success')

        response = self.client.get(f'/api/orders/{order.order_number}/pay/verify/?provider=paystack')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(response.data['order']), {'order_number', 'status', 'total'})
        text = str(response.data)
        for secret in ('Cocody', '0102030405', 'u@test.ci', 'Une Cliente'):
            self.assertNotIn(secret, text)
