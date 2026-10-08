from decimal import Decimal

from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APITestCase

from catalog.models import Category, Product, ProductImage, ProductVariant
from orders.models import Cart, CartItem, DeliveryZone, Order
from reviews.models import Review
from userauths.models import Favorite, User


def make_products(category, count, start=0):
    for i in range(start, start + count):
        product = Product.objects.create(name=f'Bijou {i}', category=category)
        ProductVariant.objects.create(product=product, price=Decimal('5000') + i, stock=3, is_default=True)
        ProductVariant.objects.create(product=product, price=Decimal('6000') + i, stock=0)
        ProductImage.objects.create(product=product, image=f'products/{i}.jpg', is_main=True)


def count_queries(client, url, **kwargs):
    with CaptureQueriesContext(connection) as ctx:
        response = client.get(url, **kwargs)
    return response, len(ctx)


class CatalogScalingTests(APITestCase):
    def setUp(self):
        self.category = Category.objects.create(name='Chaînes')

    def test_product_list_query_count_does_not_grow_with_products(self):
        make_products(self.category, 3)
        _, few = count_queries(self.client, '/api/products/')
        make_products(self.category, 20, start=3)
        response, many = count_queries(self.client, '/api/products/?page_size=50')
        self.assertEqual(len(response.data['results']), 23)
        self.assertEqual(few, many)

    def test_product_list_is_paginated_with_stable_shape(self):
        make_products(self.category, 30)
        response = self.client.get('/api/products/')
        self.assertEqual(response.data['count'], 30)
        self.assertEqual(len(response.data['results']), 24)
        self.assertIsNotNone(response.data['next'])
        second = self.client.get('/api/products/?page=2')
        self.assertEqual(len(second.data['results']), 6)
        ids = {p['id'] for p in response.data['results']} | {p['id'] for p in second.data['results']}
        self.assertEqual(len(ids), 30)

    def test_page_size_is_capped(self):
        make_products(self.category, 5)
        self.assertEqual(self.client.get('/api/products/?page_size=100000').status_code, 200)

    def test_invalid_max_price_is_a_400_not_a_crash(self):
        self.assertEqual(self.client.get('/api/products/?max_price=abc').status_code, 400)

    def test_search_returns_each_product_once(self):
        make_products(self.category, 3)
        self.assertEqual(self.client.get('/api/products/?search=Bijou').data['count'], 3)

    def test_categories_expose_cover_image_in_one_query(self):
        make_products(self.category, 2)
        response, queries = count_queries(self.client, '/api/categories/')
        self.assertTrue(response.data[0]['cover_image'].startswith('/media/products/'))
        self.assertLessEqual(queries, 3)

    def test_public_reads_are_cacheable(self):
        self.assertIn('max-age=60', self.client.get('/api/products/')['Cache-Control'])


class OrdersScalingTests(APITestCase):
    def setUp(self):
        self.category = Category.objects.create(name='Chaînes')
        make_products(self.category, 6)
        self.user = User.objects.create_user(username='u', email='u@test.ci', password='Test-pass-123')
        self.zone = DeliveryZone.objects.create(name='Abidjan', shipping_cost=Decimal('0'))

    def make_orders(self, count, items=3):
        variants = list(ProductVariant.objects.filter(stock__gt=0)[:items])
        for _ in range(count):
            order = Order.objects.create(user=self.user, total=Decimal('1000'))
            for v in variants:
                order.items.create(variant=v, product_name=v.product.name, quantity=1, unit_price=v.price)

    def test_my_orders_query_count_is_constant(self):
        self.client.force_authenticate(self.user)
        self.make_orders(2)
        _, few = count_queries(self.client, '/api/orders/mine/')
        self.make_orders(8)
        response, many = count_queries(self.client, '/api/orders/mine/')
        self.assertEqual(response.data['count'], 10)
        self.assertEqual(few, many)

    def test_cart_query_count_is_constant(self):
        cart = Cart.objects.create(user=self.user)
        variants = list(ProductVariant.objects.filter(stock__gt=0))
        CartItem.objects.create(cart=cart, variant=variants[0])
        _, few = count_queries(self.client, f'/api/cart/?cart_id={cart.id}')
        for v in variants[1:]:
            CartItem.objects.create(cart=cart, variant=v)
        _, many = count_queries(self.client, f'/api/cart/?cart_id={cart.id}')
        self.assertEqual(few, many)

    def test_my_orders_requires_login_and_hides_others(self):
        self.assertEqual(self.client.get('/api/orders/mine/').status_code, 401)
        other = User.objects.create_user(username='o', email='o@test.ci', password='Test-pass-123')
        Order.objects.create(user=other, total=Decimal('1'))
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get('/api/orders/mine/').data['count'], 0)


class AdminScalingTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username='a', email='a@test.ci', password='Test-pass-123', is_staff=True)
        self.category = Category.objects.create(name='Chaînes')
        make_products(self.category, 4)
        self.client.force_authenticate(self.admin)

    def make_customers(self, count, start=0):
        product = Product.objects.first()
        for i in range(start, start + count):
            user = User.objects.create_user(username=f'c{i}', email=f'c{i}@test.ci', password='x')
            Order.objects.create(user=user, total=Decimal('1000'), status='paid')
            Favorite.objects.create(user=user, product=product)
            cart = Cart.objects.create(user=user)
            CartItem.objects.create(cart=cart, variant=product.variants.first())

    def test_customers_list_is_paginated_and_query_count_constant(self):
        self.make_customers(3)
        _, few = count_queries(self.client, '/api/admin/customers/')
        self.make_customers(15, start=3)
        response, many = count_queries(self.client, '/api/admin/customers/')
        self.assertEqual(response.data['count'], 18)
        self.assertEqual(len(response.data['results']), 18)
        self.assertEqual(few, many)
        row = response.data['results'][0]
        self.assertEqual(row['orders_count'], 1)
        self.assertEqual(row['favorites_count'], 1)
        self.assertEqual(row['cart_items_count'], 1)
        self.assertEqual(Decimal(str(row['total_spent'])), Decimal('1000'))

    def test_customers_search(self):
        self.make_customers(5)
        self.assertEqual(self.client.get('/api/admin/customers/?search=c3@').data['count'], 1)

    def test_admin_lists_require_staff(self):
        self.client.force_authenticate(User.objects.create_user(username='n', email='n@test.ci', password='x'))
        for url in ('customers', 'orders', 'products', 'reviews', 'waitlist', 'giftcards', 'variant-options'):
            self.assertEqual(self.client.get(f'/api/admin/{url}/').status_code, 403, url)

    def test_admin_orders_paginated_with_search_and_filter(self):
        user = User.objects.create_user(username='z', email='zed@test.ci', password='x')
        for _ in range(25):
            Order.objects.create(user=user, total=Decimal('10'))
        Order.objects.create(guest_email='autre@test.ci', total=Decimal('10'), status='paid')
        response = self.client.get('/api/admin/orders/')
        self.assertEqual(response.data['count'], 26)
        self.assertEqual(len(response.data['results']), 20)
        self.assertEqual(self.client.get('/api/admin/orders/?search=zed@').data['count'], 25)
        self.assertEqual(self.client.get('/api/admin/orders/?status=paid').data['count'], 1)

    def test_admin_products_paginated_and_searchable(self):
        self.assertEqual(self.client.get('/api/admin/products/?search=Bijou 2').data['count'], 1)

    def test_variant_options_is_compact(self):
        response = self.client.get('/api/admin/variant-options/')
        self.assertEqual(len(response.data), 8)
        self.assertEqual(set(response.data[0]), {'id', 'label', 'price', 'category'})

    def test_stats_are_cached(self):
        first = self.client.get('/api/admin/stats/')
        with CaptureQueriesContext(connection) as ctx:
            second = self.client.get('/api/admin/stats/')
        self.assertEqual(first.data, second.data)
        self.assertLessEqual(len(ctx), 4)


class ReviewAndFavoriteTests(APITestCase):
    def setUp(self):
        self.category = Category.objects.create(name='Chaînes')
        make_products(self.category, 1)
        self.product = Product.objects.first()
        self.user = User.objects.create_user(username='u', email='u@test.ci', password='Test-pass-123')

    def test_reviews_are_paginated(self):
        for i in range(12):
            u = User.objects.create_user(username=f'r{i}', email=f'r{i}@test.ci', password='x')
            Review.objects.create(product=self.product, user=u, rating=5, comment='ok', is_approved=True)
        response = self.client.get(f'/api/products/{self.product.slug}/reviews/')
        self.assertEqual(response.data['count'], 12)
        self.assertEqual(len(response.data['results']), 10)

    def test_review_rejects_fake_image(self):
        self.client.force_authenticate(self.user)
        fake = SimpleUploadedFile('x.jpg', b'<html>pas une image</html>', content_type='image/jpeg')
        response = self.client.post(
            f'/api/products/{self.product.slug}/reviews/', {'rating': 5, 'comment': 'ok', 'images': [fake]}, format='multipart',
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Review.objects.count(), 0)

    def test_favorite_ids_endpoint(self):
        Favorite.objects.create(user=self.user, product=self.product)
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get('/api/auth/favorites/ids/').data, [self.product.id])
        self.assertEqual(self.client.get('/api/auth/favorites/').data['count'], 1)


class ImageOptimizationTests(APITestCase):
    def setUp(self):
        import tempfile
        from django.test import override_settings
        self.media = tempfile.mkdtemp()
        self.override = override_settings(MEDIA_ROOT=self.media)
        self.override.enable()
        self.addCleanup(self.override.disable)
        self.category = Category.objects.create(name='Chaînes')
        self.product = Product.objects.create(name='Croix', category=self.category)

    def png(self, size=(3000, 2000)):
        from io import BytesIO
        from PIL import Image
        buffer = BytesIO()
        Image.new('RGB', size, (120, 40, 40)).save(buffer, format='PNG')
        return SimpleUploadedFile('photo.png', buffer.getvalue(), content_type='image/png')

    def test_upload_is_converted_to_webp_with_thumbnail(self):
        from PIL import Image
        image = ProductImage.objects.create(product=self.product, image=self.png(), is_main=True)
        self.assertTrue(image.image.name.endswith('.webp'))
        self.assertTrue(image.thumbnail.name.endswith('_thumb.webp'))
        with Image.open(image.image.path) as full, Image.open(image.thumbnail.path) as thumb:
            self.assertLessEqual(max(full.size), 1400)
            self.assertLessEqual(max(thumb.size), 720)
            self.assertEqual(full.format, 'WEBP')

    def test_small_images_are_never_enlarged(self):
        from PIL import Image
        image = ProductImage.objects.create(product=self.product, image=self.png((300, 200)))
        with Image.open(image.image.path) as full:
            self.assertEqual(full.size, (300, 200))

    def test_corrupt_file_does_not_block_saving(self):
        broken = SimpleUploadedFile('x.jpg', b'pas une image', content_type='image/jpeg')
        image = ProductImage.objects.create(product=self.product, image=broken)
        self.assertTrue(image.image.name.endswith('.jpg'))

    def test_lists_use_the_thumbnail_and_detail_the_full_image(self):
        ProductImage.objects.create(product=self.product, image=self.png(), is_main=True)
        ProductVariant.objects.create(product=self.product, price=Decimal('1000'), stock=1, is_default=True)
        listing = self.client.get('/api/products/').data['results'][0]['main_image']
        detail = self.client.get(f'/api/products/{self.product.slug}/').data['images'][0]
        self.assertIn('_thumb', listing)
        self.assertNotIn('_thumb', detail['image'])

    def test_thumbnail_command_backfills_missing_thumbnails(self):
        from django.core.management import call_command
        image = ProductImage.objects.create(product=self.product, image=self.png(), is_main=True)
        ProductImage.objects.filter(pk=image.pk).update(thumbnail='')
        call_command('generate_thumbnails')
        image.refresh_from_db()
        self.assertIn('_thumb', image.thumbnail.name)
        self.assertTrue(image.thumbnail.name.endswith('.webp'))


class SuggestionTests(APITestCase):
    URL = '/api/products/suggestions/'

    def setUp(self):
        self.chains = Category.objects.create(name='Chaînes')
        self.rings = Category.objects.create(name='Bagues')
        make_products(self.chains, 3)            # Bijou 0..2 (chaînes)
        make_products(self.rings, 3, start=3)    # Bijou 3..5 (bagues)

    def names(self, response):
        return [p['name'] for p in response.data]

    def test_excludes_viewed_product_and_prefers_same_category(self):
        response = self.client.get(self.URL, {'like': Product.objects.get(name='Bijou 0').slug})
        self.assertEqual(response.status_code, 200)
        names = self.names(response)
        self.assertNotIn('Bijou 0', names)
        self.assertEqual(set(names[:2]), {'Bijou 1', 'Bijou 2'})
        self.assertEqual(len(names), 4)

    def test_without_seed_returns_available_items_only(self):
        sold_out = Product.objects.get(name='Bijou 5')
        sold_out.variants.update(stock=0)
        hidden = Product.objects.get(name='Bijou 4')
        hidden.is_active = False
        hidden.save()
        names = self.names(self.client.get(self.URL))
        self.assertNotIn('Bijou 5', names)
        self.assertNotIn('Bijou 4', names)

    def test_cart_seeds_exclude_every_item(self):
        slugs = ','.join(Product.objects.filter(name__in=['Bijou 0', 'Bijou 3']).values_list('slug', flat=True))
        names = self.names(self.client.get(self.URL, {'like': slugs}))
        self.assertFalse({'Bijou 0', 'Bijou 3'} & set(names))

    def test_garbage_input_is_harmless(self):
        for like in ('', ',,,', 'inconnu', 'x' * 5000, ','.join(f's{i}' for i in range(200))):
            self.assertEqual(self.client.get(self.URL, {'like': like}).status_code, 200, like[:20])

    def test_query_count_is_constant(self):
        slug = Product.objects.get(name='Bijou 0').slug
        _, few = count_queries(self.client, self.URL, data={'like': slug})
        make_products(self.chains, 20, start=10)
        response, many = count_queries(self.client, self.URL, data={'like': slug})
        self.assertEqual(len(response.data), 4)
        self.assertEqual(few, many)

    def test_cart_items_expose_product_slug(self):
        user = User.objects.create_user(username='s1', email='s1@test.ci', password='Test-pass-123')
        cart = Cart.objects.create(user=user)
        product = Product.objects.get(name='Bijou 0')
        CartItem.objects.create(cart=cart, variant=product.variants.get(stock=3), quantity=1)
        self.client.force_authenticate(user)
        response = self.client.get('/api/cart/', {'cart_id': str(cart.id)})
        self.assertEqual(response.data['items'][0]['product_slug'], product.slug)
