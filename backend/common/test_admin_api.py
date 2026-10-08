import re
import uuid
from decimal import Decimal
from io import StringIO

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.urls import URLPattern, URLResolver, get_resolver
from rest_framework.test import APITestCase

from catalog.models import Category, Product, ProductImage, ProductVariant
from coffrets.models import Coffret, CoffretItem
from notifications.models import Verse
from orders.models import Cart, DeliveryZone, GiftCard, Order
from reviews.models import Review
from userauths.models import User

CONVERTER_SAMPLES = {'uuid': str(uuid.uuid4()), 'slug': 'exemple', 'str': 'exemple', 'int': '1', 'path': 'exemple'}


def all_routes():
    """Toutes les routes de l'application, avec des valeurs d'exemple à la place des paramètres."""
    def walk(patterns, prefix=''):
        for pattern in patterns:
            route = prefix + str(pattern.pattern)
            if isinstance(pattern, URLResolver):
                yield from walk(pattern.url_patterns, route)
            elif isinstance(pattern, URLPattern):
                yield re.sub(r'<(\w+):\w+>', lambda m: CONVERTER_SAMPLES[m.group(1)], route)
    return sorted(set(walk(get_resolver().url_patterns)))


STAFF_ONLY_MARKERS = ('admin/', 'verses/week', 'verses/library', '/status/')
ALL_METHODS = ('get', 'post', 'patch', 'put', 'delete')


class RouteAuditTests(APITestCase):
    """Un pentester peut lister les URL (elles sont dans le code du site) : seule l'autorisation compte."""

    def setUp(self):
        self.customer = User.objects.create_user(username='c', email='c@test.ci', password='Test-pass-123')

    def staff_routes(self):
        return [f'/{r}' for r in all_routes() if any(marker in f'/{r}' for marker in STAFF_ONLY_MARKERS) and not r.startswith('admin/')]

    def test_routes_are_discovered(self):
        self.assertGreater(len(self.staff_routes()), 25)

    def test_every_staff_route_refuses_anonymous_visitors(self):
        for route in self.staff_routes():
            for method in ALL_METHODS:
                response = getattr(self.client, method)(route, {}, format='json')
                self.assertIn(response.status_code, (401, 403, 405), f'{method.upper()} {route} -> {response.status_code}')

    def test_every_staff_route_refuses_ordinary_customers(self):
        self.client.force_authenticate(self.customer)
        for route in self.staff_routes():
            for method in ALL_METHODS:
                response = getattr(self.client, method)(route, {}, format='json')
                self.assertIn(response.status_code, (403, 405), f'{method.upper()} {route} -> {response.status_code}')

    def test_no_route_crashes_on_garbage_input(self):
        """Aucune route publique ne doit répondre par une erreur serveur (500) à des données absurdes."""
        garbage = {'cart_id': 'pas-un-uuid', 'variant_id': '???', 'quantity': 'abc', 'email': 12, 'code': {'a': 1}, 'search': 'x' * 500}
        for route in all_routes():
            path = f'/{route}'
            if any(marker in path for marker in STAFF_ONLY_MARKERS) or route.startswith('admin/'):
                continue
            for method in ALL_METHODS:
                response = getattr(self.client, method)(path, garbage, format='json')
                self.assertLess(response.status_code, 500, f'{method.upper()} {path} -> {response.status_code}')

    def test_error_responses_are_json_and_leak_nothing(self):
        for path in ('/api/inconnu/', '/api/admin/stats/', '/api/orders/nope/'):
            response = self.client.get(path)
            self.assertEqual(response['Content-Type'], 'application/json', path)
            text = response.content.decode().lower()
            for leak in ('traceback', 'django', '/home/', 'settings.py', 'debug'):
                self.assertNotIn(leak, text, path)

    def test_django_admin_is_only_mounted_when_configured(self):
        from django.test import override_settings
        from importlib import reload
        from django.urls import clear_url_caches
        import backend.urls

        with override_settings(ADMIN_URL=''):
            reload(backend.urls)
            clear_url_caches()
            self.assertEqual(self.client.get('/admin/').status_code, 404)
        reload(backend.urls)
        clear_url_caches()


class AdminManagementTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username='a', email='a@test.ci', password='Test-pass-123', is_staff=True)
        self.client.force_authenticate(self.admin)
        self.category = Category.objects.create(name='Chaînes')

    # ── zones de livraison ──
    def test_delivery_zone_crud(self):
        created = self.client.post('/api/admin/delivery-zones/', {
            'name': 'Abidjan', 'shipping_cost': '2000', 'estimated_days_min': 1, 'estimated_days_max': 2, 'is_active': True,
        }, format='json')
        self.assertEqual(created.status_code, 201, created.content)
        zone_id = created.data['id']
        self.assertEqual(len(self.client.get('/api/admin/delivery-zones/').data), 1)
        updated = self.client.patch(f'/api/admin/delivery-zones/{zone_id}/', {'shipping_cost': '2500', 'is_active': False}, format='json')
        self.assertEqual(Decimal(updated.data['shipping_cost']), Decimal('2500'))
        self.assertEqual(self.client.get('/api/delivery-zones/').data, [])  # désactivée : invisible pour les clientes
        self.assertEqual(self.client.delete(f'/api/admin/delivery-zones/{zone_id}/').status_code, 204)

    def test_delivery_zone_validation(self):
        bad_cost = self.client.post('/api/admin/delivery-zones/', {'name': 'X', 'shipping_cost': '-5'}, format='json')
        self.assertEqual(bad_cost.status_code, 400)
        bad_days = self.client.post('/api/admin/delivery-zones/', {
            'name': 'X', 'shipping_cost': '1000', 'estimated_days_min': 5, 'estimated_days_max': 2,
        }, format='json')
        self.assertEqual(bad_days.status_code, 400)

    def test_deleting_a_zone_keeps_past_orders(self):
        zone = DeliveryZone.objects.create(name='Z', shipping_cost=Decimal('1000'))
        order = Order.objects.create(delivery_zone=zone, shipping_cost=Decimal('1000'), total=Decimal('6000'))
        self.client.delete(f'/api/admin/delivery-zones/{zone.id}/')
        order.refresh_from_db()
        self.assertIsNone(order.delivery_zone)
        self.assertEqual(order.shipping_cost, Decimal('1000'))

    # ── bibliothèque de versets ──
    def test_verse_library(self):
        created = self.client.post('/api/notifications/verses/library/', {'text': 'Dieu est amour.', 'reference': '1 Jean 4:8'}, format='json')
        self.assertEqual(created.status_code, 201, created.content)
        self.assertEqual(self.client.post('/api/notifications/verses/library/', {'text': ' ', 'reference': 'X'}, format='json').status_code, 400)
        listing = self.client.get('/api/notifications/verses/library/?search=amour')
        self.assertEqual(listing.data['count'], 1)
        verse_id = created.data['id']
        self.assertFalse(self.client.patch(f'/api/notifications/verses/library/{verse_id}/', {'is_active': False}, format='json').data['is_active'])
        self.assertEqual(self.client.delete(f'/api/notifications/verses/library/{verse_id}/').status_code, 204)
        self.assertEqual(Verse.objects.count(), 0)

    # ── photos de produit ──
    def png(self, size=(400, 300)):
        from io import BytesIO
        from PIL import Image
        buffer = BytesIO()
        Image.new('RGB', size, (10, 80, 50)).save(buffer, format='PNG')
        return SimpleUploadedFile('p.png', buffer.getvalue(), content_type='image/png')

    def test_only_one_main_image_per_product(self):
        import tempfile
        from django.test import override_settings
        with override_settings(MEDIA_ROOT=tempfile.mkdtemp()):
            product = Product.objects.create(name='Croix', category=self.category)
            first = ProductImage.objects.create(product=product, image=self.png(), is_main=True)
            second = ProductImage.objects.create(product=product, image=self.png())
            response = self.client.patch(f'/api/admin/images/{second.id}/', {'is_main': True}, format='json')
            self.assertEqual(response.status_code, 200)
            first.refresh_from_db(); second.refresh_from_db()
            self.assertTrue(second.is_main)
            self.assertFalse(first.is_main)

    def test_fake_image_is_refused_in_admin_uploads(self):
        product = Product.objects.create(name='Croix', category=self.category)
        fake = SimpleUploadedFile('x.jpg', b'<html>pas une image</html>', content_type='image/jpeg')
        response = self.client.post(f'/api/admin/products/{product.id}/images/', {'image': fake}, format='multipart')
        self.assertEqual(response.status_code, 400, response.content)
        self.assertEqual(ProductImage.objects.count(), 0)

    # ── suppressions protégées : message clair, jamais d'erreur 500 ──
    def test_deleting_a_product_used_in_a_coffret_is_a_clear_409(self):
        product = Product.objects.create(name='Croix', category=self.category)
        variant = ProductVariant.objects.create(product=product, price=Decimal('1000'), stock=1, is_default=True)
        coffret = Coffret.objects.create(name='Box', box_price=Decimal('500'))
        CoffretItem.objects.create(coffret=coffret, variant=variant, quantity=1)
        for url in (f'/api/admin/variants/{variant.id}/', f'/api/admin/products/{product.id}/'):
            response = self.client.delete(url)
            self.assertEqual(response.status_code, 409, url)
            self.assertIn('désactiver', response.data['error'])
        self.assertTrue(Product.objects.filter(pk=product.pk).exists())

    def test_exactly_one_default_variant_per_product(self):
        product = Product.objects.create(name='Croix', category=self.category)
        first = self.client.post(f'/api/admin/products/{product.id}/variants/', {'price': '1000', 'stock': 1}, format='json')
        self.assertTrue(first.data['is_default'])  # la première variante devient la variante par défaut
        second = self.client.post(f'/api/admin/products/{product.id}/variants/', {'price': '2000', 'stock': 1, 'is_default': True}, format='json')
        self.assertTrue(second.data['is_default'])
        self.assertEqual(ProductVariant.objects.filter(product=product, is_default=True).count(), 1)
        self.assertTrue(ProductVariant.objects.get(pk=second.data['id']).is_default)
        # décocher l'unique défaut : une autre variante prend le relais
        self.client.patch(f'/api/admin/variants/{second.data["id"]}/', {'is_default': False}, format='json')
        self.assertEqual(ProductVariant.objects.filter(product=product, is_default=True).count(), 1)

    def test_negative_variant_price_is_refused(self):
        product = Product.objects.create(name='Croix', category=self.category)
        response = self.client.post(f'/api/admin/products/{product.id}/variants/', {'price': '-1', 'stock': 1}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_product_options_endpoint(self):
        Product.objects.create(name='Croix', category=self.category)
        response = self.client.get('/api/admin/product-options/')
        self.assertEqual([p['name'] for p in response.data], ['Croix'])
        self.assertEqual(set(response.data[0]), {'id', 'name'})


class ResetShopDataTests(APITestCase):
    def test_dry_run_deletes_nothing_and_confirmation_keeps_catalogue(self):
        category = Category.objects.create(name='Chaînes')
        product = Product.objects.create(name='Croix', category=category)
        ProductVariant.objects.create(product=product, price=Decimal('1000'), stock=1, is_default=True)
        DeliveryZone.objects.create(name='Z', shipping_cost=Decimal('1000'))
        staff = User.objects.create_user(username='s', email='s@test.ci', password='x', is_staff=True)
        customer = User.objects.create_user(username='c', email='c@test.ci', password='x')
        order = Order.objects.create(user=customer, total=Decimal('1000'))
        Cart.objects.create(user=customer)
        GiftCard.objects.create(purchase_order=order, initial_value=Decimal('5000'), balance=Decimal('5000'))
        Review.objects.create(product=product, user=customer, rating=5, comment='ok')

        out = StringIO()
        call_command('reset_shop_data', stdout=out)
        self.assertIn('Rien', out.getvalue())
        self.assertEqual(Order.objects.count(), 1)

        call_command('reset_shop_data', '--yes', stdout=StringIO())
        self.assertEqual((Order.objects.count(), Cart.objects.count(), GiftCard.objects.count(), Review.objects.count()), (0, 0, 0, 0))
        self.assertEqual(list(User.objects.values_list('email', flat=True)), [staff.email])
        self.assertEqual((Product.objects.count(), ProductVariant.objects.count(), DeliveryZone.objects.count()), (1, 1, 1))


class OptimizeImagesCommandTests(APITestCase):
    def test_converts_legacy_jpeg_and_is_idempotent(self):
        import tempfile
        from io import BytesIO, StringIO

        from django.core.files.base import ContentFile
        from django.core.files.storage import default_storage
        from django.core.management import call_command
        from django.test import override_settings
        from PIL import Image

        from coffrets.models import Coffret

        with tempfile.TemporaryDirectory() as media, override_settings(MEDIA_ROOT=media):
            buffer = BytesIO()
            Image.new('RGB', (2400, 1800), (200, 30, 30)).save(buffer, format='JPEG')
            default_storage.save('coffrets/ancien.jpg', ContentFile(buffer.getvalue()))
            coffret = Coffret.objects.create(name='Ancien coffret')
            Coffret.objects.filter(pk=coffret.pk).update(image='coffrets/ancien.jpg')

            call_command('optimize_images', stdout=StringIO())
            coffret.refresh_from_db()
            self.assertTrue(coffret.image.name.endswith('.webp'))
            with default_storage.open(coffret.image.name) as f:
                self.assertLessEqual(max(Image.open(f).size), 1400)

            out = StringIO()
            name = coffret.image.name
            call_command('optimize_images', stdout=out)
            coffret.refresh_from_db()
            self.assertEqual(coffret.image.name, name)
            self.assertIn('0 image(s)', out.getvalue())
