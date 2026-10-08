from decimal import Decimal

from rest_framework.test import APITestCase

from catalog.models import Category, Product, ProductVariant
from common.places import clean_place
from orders.models import Cart, CartItem, DeliveryZone, Order
from userauths.models import Address, User


class PlaceRulesTests(APITestCase):
    def test_abidjan_needs_a_listed_commune_and_a_quartier(self):
        self.assertEqual(clean_place('Abidjan', 'cocody', ' Riviera   Palmeraie '), ('Cocody', 'Riviera Palmeraie', None))
        self.assertEqual(clean_place('abidjan', 'Port-Bouet', 'Vridi')[0], 'Port-Bouët')
        self.assertIn('commune', clean_place('Abidjan', '', 'Riviera')[2])
        self.assertIn('commune', clean_place('Abidjan', 'Atlantide', 'Riviera')[2])
        self.assertIn('quartier', clean_place('Abidjan', 'Cocody', '  ')[2])

    def test_other_cities_only_need_a_quartier_and_get_no_commune(self):
        self.assertEqual(clean_place('Bouaké', 'Cocody', 'Commerce'), ('', 'Commerce', None))
        self.assertIn('quartier', clean_place('Bouaké', '', '')[2])


class CheckoutPlaceTests(APITestCase):
    def setUp(self):
        category = Category.objects.create(name='Chaînes')
        product = Product.objects.create(name='Croix', category=category)
        variant = ProductVariant.objects.create(product=product, price=Decimal('5000'), stock=5, is_default=True)
        self.zone = DeliveryZone.objects.create(name='Abidjan', shipping_cost=Decimal('2000'))
        self.cart = Cart.objects.create(session_key='invite')
        CartItem.objects.create(cart=self.cart, variant=variant, quantity=1)

    def order(self, **extra):
        payload = {
            'cart_id': str(self.cart.id), 'delivery_method': 'shipping', 'delivery_zone_id': str(self.zone.id),
            'email': 'guest@test.ci', 'full_name': 'Guest', 'phone': '0100000000', 'city': 'Abidjan', 'street': 'Rue 1', **extra,
        }
        return self.client.post('/api/orders/', payload, format='json')

    def test_guest_order_without_commune_or_quartier_is_refused_with_a_clear_message(self):
        response = self.order(quartier='Riviera')
        self.assertEqual(response.status_code, 400)
        self.assertIn('commune', response.data['error'])
        response = self.order(commune='Cocody')
        self.assertEqual(response.status_code, 400)
        self.assertIn('quartier', response.data['error'])
        self.assertEqual(Order.objects.count(), 0)

    def test_guest_order_stores_commune_and_quartier_on_the_address(self):
        response = self.order(commune='Marcory', quartier='Zone 4')
        self.assertEqual(response.status_code, 201, response.content)
        address = Order.objects.get().address
        self.assertEqual((address.commune, address.quartier), ('Marcory', 'Zone 4'))
        self.assertEqual(response.data['address']['quartier'], 'Zone 4')

    def test_pickup_needs_no_address(self):
        self.assertEqual(self.order(delivery_method='pickup', delivery_zone_id=None).status_code, 201)


class AddressApiPlaceTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='c', email='c@test.ci', password='x')
        self.client.force_authenticate(self.user)
        self.base = {'full_name': 'Awa', 'phone': '0100000000', 'city': 'Abidjan', 'street': 'Rue 1'}

    def test_new_address_requires_commune_and_quartier(self):
        bad = self.client.post('/api/auth/addresses/', {**self.base, 'quartier': 'Riviera'}, format='json')
        self.assertEqual(bad.status_code, 400)
        self.assertIn('commune', bad.data)
        good = self.client.post('/api/auth/addresses/', {**self.base, 'commune': 'Cocody', 'quartier': 'Riviera'}, format='json')
        self.assertEqual(good.status_code, 201, good.content)

    def test_old_addresses_stay_editable_without_a_place(self):
        old = Address.objects.create(user=self.user, full_name='Awa', phone='0100000000', city='Abidjan', street='Cocody')
        response = self.client.patch(f'/api/auth/addresses/{old.id}/', {'is_default': True}, format='json')
        self.assertEqual(response.status_code, 200, response.content)
        refused = self.client.patch(f'/api/auth/addresses/{old.id}/', {'quartier': ''}, format='json')
        self.assertEqual(refused.status_code, 400)
