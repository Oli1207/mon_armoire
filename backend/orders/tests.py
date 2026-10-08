from decimal import Decimal

from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase

from catalog.models import Category, Product, ProductVariant
from coffrets.models import Coffret, CoffretSlot
from orders.models import Cart, CartItem, DeliveryZone, GiftCard, LoyaltyTransaction, Order, Payment
from orders.services import cancel_unpaid_order, mark_order_paid
from userauths.models import User


class Base(APITestCase):
    def setUp(self):
        cache.clear()  # les limites de débit ne doivent pas fuir d'un test à l'autre
        self.category = Category.objects.create(name='Chaînes')
        self.product = Product.objects.create(name='Chaîne test', category=self.category)
        self.variant = ProductVariant.objects.create(product=self.product, price=Decimal('10000'), stock=1, is_default=True)
        self.zone = DeliveryZone.objects.create(name='Abidjan', shipping_cost=Decimal('2000'))
        self.user = User.objects.create_user(username='u1', email='u1@test.ci', password='Test-pass-123')
        self.cart = Cart.objects.create(user=self.user)

    def add_to_cart(self, quantity=1, cart=None):
        cart = cart or self.cart
        return CartItem.objects.create(cart=cart, variant=self.variant, quantity=quantity)

    def place_order(self, **extra):
        self.client.force_authenticate(self.user)
        address = self.user.addresses.create(full_name='U', phone='0100000000', city='Abidjan', street='Cocody')
        payload = {
            'cart_id': str(self.cart.id), 'delivery_method': 'shipping',
            'delivery_zone_id': str(self.zone.id), 'address_id': str(address.id), **extra,
        }
        return self.client.post('/api/orders/', payload, format='json')


class CartValidationTests(Base):
    def post_add(self, quantity):
        return self.client.post('/api/cart/add/', {
            'cart_id': str(self.cart.id), 'variant_id': str(self.variant.id), 'quantity': quantity,
        }, format='json')

    def test_rejects_invalid_quantities(self):
        for bad in (0, -3, 'abc', 21, 10**9):
            self.assertEqual(self.post_add(bad).status_code, 400, bad)
        self.assertEqual(CartItem.objects.count(), 0)

    def test_accepts_valid_quantity_within_stock(self):
        self.assertEqual(self.post_add(1).status_code, 201)

    def test_update_requires_matching_cart_id(self):
        item = self.add_to_cart()
        url = f'/api/cart/items/{item.id}/'
        self.assertEqual(self.client.patch(url, {'quantity': 1}, format='json').status_code, 403)
        self.assertEqual(self.client.patch(url, {'quantity': 1, 'cart_id': str(Cart.objects.create().id)}, format='json').status_code, 403)
        self.assertEqual(self.client.patch(url, {'quantity': 1, 'cart_id': str(self.cart.id)}, format='json').status_code, 200)

    def test_update_cannot_exceed_stock(self):
        item = self.add_to_cart()
        response = self.client.patch(f'/api/cart/items/{item.id}/', {'quantity': 5, 'cart_id': str(self.cart.id)}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_remove_requires_cart_id(self):
        item = self.add_to_cart()
        self.assertEqual(self.client.delete(f'/api/cart/items/{item.id}/remove/').status_code, 403)


class OrderCreationTests(Base):
    def test_order_created_and_cart_emptied(self):
        self.add_to_cart()
        response = self.place_order()
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(Decimal(response.data['total']), Decimal('12000'))
        self.assertFalse(self.cart.items.exists())

    def test_failed_order_leaves_no_partial_data(self):
        self.add_to_cart()
        self.client.force_authenticate(None)
        response = self.client.post('/api/orders/', {
            'cart_id': str(self.cart.id), 'delivery_method': 'shipping', 'delivery_zone_id': str(self.zone.id),
            'email': 'guest@test.ci', 'full_name': 'Guest', 'phone': '0100000000',
            'city': 'Abidjan', 'commune': 'Cocody', 'quartier': 'Riviera', 'street': 'Rue 1', 'create_account': True, 'gift_card_code': 'CADEAU-INCONNU',
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(email='guest@test.ci').exists())
        self.assertEqual(Order.objects.count(), 0)

    def test_guest_usernames_do_not_collide(self):
        User.objects.create_user(username='jean', email='jean@a.com', password='Test-pass-123')
        other = Cart.objects.create()
        CartItem.objects.create(cart=other, variant=self.variant, quantity=1)
        response = self.client.post('/api/orders/', {
            'cart_id': str(other.id), 'delivery_method': 'pickup', 'email': 'jean@b.com',
            'full_name': 'Jean', 'phone': '0100000000', 'create_account': True,
        }, format='json')
        self.assertEqual(response.status_code, 201, response.content)

    def test_invalid_loyalty_points_rejected(self):
        self.add_to_cart()
        self.assertEqual(self.place_order(loyalty_points='abc').status_code, 400)
        self.assertEqual(self.place_order(loyalty_points=-5).status_code, 400)

    def test_gift_card_cannot_be_spent_twice(self):
        purchase = Order.objects.create(user=self.user, total=Decimal('12000'), subtotal=Decimal('12000'))
        card = GiftCard.objects.create(
            purchase_order=purchase, initial_value=Decimal('12000'), balance=Decimal('12000'), status='active',
        )
        self.add_to_cart()
        first = self.place_order(gift_card_code=card.code)
        self.assertEqual(first.status_code, 201, first.content)
        self.assertEqual(first.data['status'], 'paid')
        card.refresh_from_db()
        self.assertEqual(card.balance, 0)
        self.assertEqual(card.status, 'used')

        self.variant.stock = 5
        self.variant.save()
        self.add_to_cart()
        second = self.place_order(gift_card_code=card.code)
        self.assertEqual(second.status_code, 400)

    def test_cancelling_unpaid_order_restores_gift_card_and_points(self):
        purchase = Order.objects.create(user=self.user, total=Decimal('5000'), subtotal=Decimal('5000'))
        card = GiftCard.objects.create(
            purchase_order=purchase, initial_value=Decimal('5000'), balance=Decimal('5000'), status='active',
        )
        LoyaltyTransaction.objects.create(user=self.user, points=30, reason='adjusted')
        self.add_to_cart()
        response = self.place_order(gift_card_code=card.code, loyalty_points=10)
        self.assertEqual(response.status_code, 201, response.content)
        order = Order.objects.get(order_number=response.data['order_number'])
        self.assertEqual(order.status, 'pending')

        self.assertTrue(cancel_unpaid_order(order))
        self.assertFalse(cancel_unpaid_order(order))
        card.refresh_from_db()
        self.assertEqual(card.balance, Decimal('5000'))
        self.assertEqual(card.status, 'active')
        self.assertEqual(sum(t.points for t in self.user.loyalty_transactions.all()), 30)


class PaymentIdempotencyTests(Base):
    def make_order(self, quantity=1):
        self.add_to_cart(quantity)
        response = self.place_order()
        return Order.objects.get(order_number=response.data['order_number'])

    def test_marking_paid_twice_applies_effects_once(self):
        order = self.make_order()
        self.assertTrue(mark_order_paid(order))
        self.assertFalse(mark_order_paid(order))
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock, 0)
        self.assertEqual(self.user.loyalty_transactions.filter(reason='earned').count(), 1)

    def test_oversold_last_item_is_flagged_not_negative(self):
        first = self.make_order()
        second = self.make_order()
        mark_order_paid(first)
        mark_order_paid(second)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock, 0)
        self.assertTrue(second.status_history.filter(note__startswith='Stock insuffisant').exists())
        self.assertFalse(first.status_history.filter(note__startswith='Stock insuffisant').exists())

    def test_webhook_without_secret_is_rejected(self):
        with override_settings(GENIUSPAY_WEBHOOK_SECRET='', PAYSTACK_SECRET_KEY=''):
            self.assertEqual(self.client.post('/api/payments/geniuspay/webhook/', {}, format='json').status_code, 503)
            self.assertEqual(self.client.post('/api/payments/paystack/webhook/', {}, format='json').status_code, 503)

    def test_payment_after_cancellation_is_flagged(self):
        from orders.payment_views import _mark_order_paid
        order = self.make_order()
        payment = Payment.objects.create(order=order, provider='paystack', transaction_id='X', amount=order.total)
        cancel_unpaid_order(order)
        _mark_order_paid(order, payment)
        self.assertTrue(order.status_history.filter(note__startswith='ATTENTION').exists())
        order.refresh_from_db()
        self.assertEqual(order.status, 'cancelled')


class AdminStatusTests(Base):
    def setUp(self):
        super().setUp()
        self.admin = User.objects.create_user(username='adm', email='adm@test.ci', password='Test-pass-123', is_staff=True, is_superuser=True)
        self.client.force_authenticate(self.admin)
        self.add_to_cart()
        self.client.force_authenticate(self.user)
        placed = self.place_order()
        self.order_number = placed.data['order_number']
        self.client.force_authenticate(self.admin)

    def set_status(self, value):
        return self.client.patch(f'/api/orders/{self.order_number}/status/', {'status': value}, format='json')

    def test_pending_cannot_skip_payment(self):
        self.assertEqual(self.set_status('shipped').status_code, 400)

    def test_paid_then_shipped_and_cancelled_is_final(self):
        self.assertEqual(self.set_status('paid').status_code, 200)
        self.assertEqual(self.set_status('shipped').status_code, 200)
        self.assertEqual(self.set_status('cancelled').status_code, 200)
        self.assertEqual(self.set_status('delivered').status_code, 400)


class GiftCardPurchaseTests(Base):
    def post(self, amount, **extra):
        return self.client.post('/api/giftcards/purchase/', {'amount': amount, 'purchaser_email': 'a@b.ci', **extra}, format='json')

    def test_rejects_nan_infinity_and_out_of_range(self):
        for bad in ('NaN', 'Infinity', '-Infinity', 'abc', 100, 10**9):
            self.assertEqual(self.post(bad).status_code, 400, bad)

    def test_rejects_bad_email(self):
        self.assertEqual(self.post(10000, recipient_email='pas-un-email').status_code, 400)

    def test_valid_purchase(self):
        response = self.post(10000)
        self.assertEqual(response.status_code, 201, response.content)

    def test_codes_are_long_and_unique(self):
        codes = {Order.objects.create().order_number for _ in range(50)}
        self.assertEqual(len(codes), 50)
        self.assertTrue(all(len(c) == 15 for c in codes))


class CoffretConfigureTests(Base):
    def test_rejects_negative_or_huge_quantities(self):
        coffret = Coffret.objects.create(name='Box', box_price=Decimal('1000'))
        slot = CoffretSlot.objects.create(coffret=coffret, label='Collier', min_select=0, max_select=5)
        for bad in (-1, 0, 999, 'x'):
            response = self.client.post('/api/coffrets/configure/', {
                'coffret': str(coffret.id),
                'selections': [{'slot': str(slot.id), 'variant': str(self.variant.id), 'quantity': bad}],
            }, format='json')
            self.assertEqual(response.status_code, 400, bad)
