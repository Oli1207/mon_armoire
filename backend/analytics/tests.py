import uuid
from datetime import timedelta
from decimal import Decimal
from io import StringIO

from django.core.cache import cache
from django.core.management import call_command
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APITestCase

from analytics.models import DailyProductStat, DailyStat, TrackEvent, VisitSession
from analytics.services import persist_day
from catalog.models import Category, Product, ProductVariant
from orders.models import Cart, CartItem, Order
from userauths.models import Favorite, StaffProfile, User

MOBILE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1'


class Base(APITestCase):
    def setUp(self):
        cache.clear()
        self.category = Category.objects.create(name='Chaînes')
        self.product = Product.objects.create(name='Croix', category=self.category)
        self.variant = ProductVariant.objects.create(product=self.product, price=Decimal('5000'), stock=5, is_default=True)
        self.owner = User.objects.create_user(username='boss', email='boss@test.ci', password='x', is_staff=True, is_superuser=True)

    def send(self, sid=None, events=None, agent=MOBILE, meta=None):
        return self.client.post('/api/track/', {'sid': sid or str(uuid.uuid4()), 'events': events or [], 'meta': meta or {}},
                                format='json', HTTP_USER_AGENT=agent)


class CollectTests(Base):
    def test_events_are_stored_with_device_and_source(self):
        sid = str(uuid.uuid4())
        response = self.send(sid, [
            {'t': 'pageview', 'path': '/catalogue'},
            {'t': 'product_view', 'path': f'/produits/{self.product.slug}', 'p': self.product.slug},
            {'t': 'search', 'path': '/catalogue', 'ref': 'croix', 'v': 0},
        ], meta={'referrer': 'https://www.google.com/search?q=x', 'landing': '/'})
        self.assertEqual(response.status_code, 204)
        session = VisitSession.objects.get(sid=sid)
        self.assertEqual((session.device, session.source), ('mobile', 'google.com'))
        self.assertEqual(TrackEvent.objects.count(), 3)
        self.assertEqual(TrackEvent.objects.get(type='product_view').product, self.product)

    def test_invalid_data_is_ignored_not_stored(self):
        response = self.send(events=[
            {'t': 'inconnu', 'path': '/x'}, {'t': 'pageview', 'path': 'http://evil'}, {'t': 'pageview', 'path': '/admin/produits'},
            'pas-un-dict', {'t': 'add_to_cart', 'v': 'NaN', 'p': 'produit-inexistant'}, {'t': 'add_to_cart', 'v': '-5'},
        ])
        self.assertEqual(response.status_code, 204)
        stored = list(TrackEvent.objects.values_list('type', 'value', 'product'))
        self.assertEqual(stored, [('add_to_cart', None, None), ('add_to_cart', None, None)])

    def test_bad_session_id_is_a_400_and_bots_are_ignored(self):
        self.assertEqual(self.client.post('/api/track/', {'sid': 'x', 'events': []}, format='json').status_code, 400)
        self.assertEqual(self.client.post('/api/track/', {'events': []}, format='json').status_code, 400)
        self.assertEqual(self.send(agent='Googlebot/2.1', events=[{'t': 'pageview', 'path': '/'}]).status_code, 204)
        self.assertEqual(TrackEvent.objects.count(), 0)

    def test_batch_is_capped(self):
        self.send(events=[{'t': 'pageview', 'path': '/'}] * 200)
        self.assertEqual(TrackEvent.objects.count(), 25)

    def test_staff_visits_are_never_counted_even_retroactively(self):
        sid = str(uuid.uuid4())
        self.send(sid, [{'t': 'pageview', 'path': '/avant-connexion'}])
        self.client.force_authenticate(self.owner)
        self.client.post('/api/track/', {'sid': sid, 'events': [{'t': 'pageview', 'path': '/apres'}]}, format='json', HTTP_USER_AGENT=MOBILE)
        self.assertTrue(VisitSession.objects.get(sid=sid).is_internal)
        self.assertEqual(TrackEvent.objects.filter(path='/apres').count(), 0)
        self.client.force_authenticate(None)
        stats = persist_day(timezone.localdate())
        self.assertEqual(stats['visitors'], 0)
        self.assertEqual(stats['pageviews'], 0)

    def test_login_links_the_visit_to_the_customer(self):
        customer = User.objects.create_user(username='c', email='c@test.ci', password='x')
        sid = str(uuid.uuid4())
        self.send(sid, [{'t': 'pageview', 'path': '/'}])
        self.client.force_authenticate(customer)
        self.client.post('/api/track/', {'sid': sid, 'events': [{'t': 'pageview', 'path': '/panier'}]}, format='json', HTTP_USER_AGENT=MOBILE)
        self.assertEqual(VisitSession.objects.get(sid=sid).user, customer)

    def test_collection_has_a_constant_number_of_queries(self):
        events = [{'t': 'pageview', 'path': f'/p{i}'} for i in range(5)]
        sid = str(uuid.uuid4())
        self.send(sid, events)
        with CaptureQueriesContext(connection) as small:
            self.send(sid, events[:1])
        with CaptureQueriesContext(connection) as big:
            self.send(sid, events * 5)
        self.assertEqual(len(small), len(big))


class AggregationTests(Base):
    def test_daily_numbers_funnel_and_products(self):
        a, b = str(uuid.uuid4()), str(uuid.uuid4())
        self.send(a, [{'t': 'pageview', 'path': '/'}, {'t': 'product_view', 'p': self.product.slug, 'path': '/x'},
                      {'t': 'add_to_cart', 'p': self.product.slug, 'v': 5000}, {'t': 'begin_checkout', 'path': '/checkout'},
                      {'t': 'search', 'ref': 'bague', 'v': 0, 'path': '/catalogue'}])
        self.send(b, [{'t': 'pageview', 'path': '/'}, {'t': 'product_view', 'p': self.product.slug, 'path': '/x'}], agent='Mozilla/5.0 (Windows NT 10.0) Chrome/120')
        customer = User.objects.create_user(username='c', email='c@test.ci', password='x')
        Favorite.objects.create(user=customer, product=self.product)
        Order.objects.create(user=customer, total=Decimal('7000'), status='paid')
        Order.objects.create(user=customer, total=Decimal('9999'), status='pending')

        stats = persist_day(timezone.localdate())
        self.assertEqual((stats['visitors'], stats['viewers'], stats['carters'], stats['checkouts']), (2, 2, 1, 1))
        self.assertEqual((stats['orders'], stats['revenue']), (1, Decimal('7000.00')))
        self.assertEqual(stats['devices'], {'mobile': 1, 'desktop': 1})
        self.assertEqual(stats['empty_searches'], {'bague': 1})
        row = DailyProductStat.objects.get(product=self.product)
        self.assertEqual((row.views, row.adds, row.likes), (2, 1, 1))
        persist_day(timezone.localdate())   # relancé : aucun doublon
        self.assertEqual(DailyProductStat.objects.count(), 1)
        self.assertEqual(DailyStat.objects.count(), 1)

    def test_commands_run_and_purge_old_events_only(self):
        session = VisitSession.objects.create(sid=str(uuid.uuid4()), last_seen=timezone.now() - timedelta(days=200))
        TrackEvent.objects.create(session=session, type='pageview', created_at=timezone.now() - timedelta(days=200))
        fresh = VisitSession.objects.create(sid=str(uuid.uuid4()), last_seen=timezone.now())
        TrackEvent.objects.create(session=fresh, type='pageview', created_at=timezone.now())
        call_command('aggregate_analytics', '--days', '3', stdout=StringIO())
        self.assertEqual(DailyStat.objects.count(), 3)
        call_command('purge_old_data', stdout=StringIO())
        self.assertEqual(TrackEvent.objects.count(), 1)
        self.assertEqual(list(VisitSession.objects.values_list('sid', flat=True)), [fresh.sid])


class AdminAnalyticsTests(Base):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.owner)

    def test_overview_products_and_searches_payloads(self):
        self.client.force_authenticate(None)
        self.send(str(uuid.uuid4()), [{'t': 'product_view', 'p': self.product.slug, 'path': '/x'}, {'t': 'search', 'ref': 'croix', 'v': 3, 'path': '/c'}])
        customer = User.objects.create_user(username='c', email='c@test.ci', password='x')
        Favorite.objects.create(user=customer, product=self.product)
        self.client.force_authenticate(self.owner)
        overview = self.client.get('/api/admin/analytics/overview/', {'days': 7}).data
        self.assertEqual(overview['days'], 7)
        self.assertEqual(len(overview['series']), 7)
        self.assertEqual(overview['totals']['visits'], 1)
        self.assertEqual(overview['online_now'], 1)
        products = self.client.get('/api/admin/analytics/products/').data
        self.assertEqual(products['most_viewed'][0]['name'], 'Croix')
        self.assertEqual(products['most_liked'][0]['count'], 1)
        self.assertEqual(self.client.get('/api/admin/analytics/searches/').data['top'], [{'label': 'croix', 'count': 1}])
        self.assertEqual(self.client.get('/api/admin/analytics/overview/', {'days': 'abc'}).data['days'], 30)

    def test_rights_are_enforced(self):
        for role, allowed in (('accounting', True), ('orders', False), ('catalog', False)):
            user = User.objects.create_user(username=role, email=f'{role}@test.ci', password='x', is_staff=True)
            StaffProfile.objects.create(user=user, role=role)
            self.client.force_authenticate(user)
            status = self.client.get('/api/admin/analytics/overview/').status_code
            self.assertEqual(status, 200 if allowed else 403, role)

    def test_carts_list_states_and_constant_queries(self):
        customer = User.objects.create_user(username='c', email='c@test.ci', password='x')
        fresh = Cart.objects.create(user=customer)
        CartItem.objects.create(cart=fresh, variant=self.variant, quantity=2)
        old = Cart.objects.create(session_key='invite')
        CartItem.objects.create(cart=old, variant=self.variant, quantity=1)
        Cart.objects.filter(pk=old.pk).update(updated_at=timezone.now() - timedelta(days=3))
        Cart.objects.create(user=customer)   # vide : jamais listé
        staff_cart = Cart.objects.create(user=self.owner)
        CartItem.objects.create(cart=staff_cart, variant=self.variant)

        everything = self.client.get('/api/admin/analytics/carts/').data
        self.assertEqual(everything['count'], 2)
        active = self.client.get('/api/admin/analytics/carts/', {'state': 'active'}).data['results']
        self.assertEqual([c['customer']['email'] for c in active], ['c@test.ci'])
        abandoned = self.client.get('/api/admin/analytics/carts/', {'state': 'abandoned'}).data['results']
        self.assertIsNone(abandoned[0]['customer'])
        self.assertTrue(abandoned[0]['is_abandoned'])

        with CaptureQueriesContext(connection) as few:
            self.client.get('/api/admin/analytics/carts/')
        for i in range(6):
            cart = Cart.objects.create(user=User.objects.create_user(username=f'u{i}', email=f'u{i}@test.ci', password='x'))
            CartItem.objects.create(cart=cart, variant=self.variant)
        with CaptureQueriesContext(connection) as many:
            self.client.get('/api/admin/analytics/carts/')
        self.assertEqual(len(few), len(many))


class PlacesTests(Base):
    def make_order(self, commune, quartier, city='Abidjan', status='paid', total='5000'):
        from userauths.models import Address
        user = User.objects.create_user(username=f'u{Order.objects.count()}', email=f'u{Order.objects.count()}@test.ci', password='x')
        address = Address.objects.create(user=user, full_name='X', phone='0100000000', city=city, commune=commune, quartier=quartier, street='rue')
        return Order.objects.create(user=user, address=address, total=Decimal(total), status=status, delivery_method='shipping')

    def test_communes_and_quartiers_are_grouped_from_real_paid_orders(self):
        self.make_order('Cocody', 'Riviera')
        self.make_order('Cocody', 'riviera ')            # même quartier, saisie différente
        self.make_order('Cocody', 'Angré', total='10000')
        self.make_order('Yopougon', 'Niangon')
        self.make_order('Yopougon', '')                  # quartier non renseigné
        self.make_order('', '', city='Bouaké', total='7000')
        self.make_order('Cocody', 'Riviera', status='pending')   # non payée : jamais comptée
        self.client.force_authenticate(self.owner)
        data = self.client.get('/api/admin/analytics/places/').data
        self.assertEqual(data['orders'], 6)
        self.assertEqual([(c['label'], c['count']) for c in data['communes']], [('Cocody', 3), ('Yopougon', 2)])
        self.assertEqual(data['quartiers'][0], {'label': 'Riviera', 'commune': 'Cocody', 'count': 2, 'revenue': Decimal('10000.00')})
        self.assertEqual(data['unknown'], 1)
        self.assertEqual([(c['label'], c['count']) for c in data['cities']], [('Bouaké', 1)])

    def test_places_need_the_statistics_right(self):
        from userauths.models import StaffProfile
        member = User.objects.create_user(username='m', email='m@test.ci', password='x', is_staff=True)
        StaffProfile.objects.create(user=member, role='orders')
        self.client.force_authenticate(member)
        self.assertEqual(self.client.get('/api/admin/analytics/places/').status_code, 403)
