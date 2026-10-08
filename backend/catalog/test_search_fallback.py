from decimal import Decimal
from unittest import mock

from rest_framework.test import APITestCase

from catalog.models import Category, Product, ProductVariant


class SimpleSearchTests(APITestCase):
    """Recherche sans pg_trgm (hébergement LWS)."""

    def setUp(self):
        patcher = mock.patch('catalog.search.trigram_available', return_value=False)
        patcher.start()
        self.addCleanup(patcher.stop)
        chains = Category.objects.create(name='Chaînes')
        books = Category.objects.create(name='Livres')

        def make(name, category, description=''):
            product = Product.objects.create(name=name, category=category, description=description)
            ProductVariant.objects.create(product=product, price=Decimal('1000'), stock=1, is_default=True)
            return product

        self.cross = make('Croix argentée', chains, 'Une croix simple')
        self.medal = make('Médaille', chains, 'Médaille avec une petite croix gravée')
        self.bible = make('Bible illustrée', books, 'Pour les enfants')

    def search(self, term):
        response = self.client.get('/api/products/', {'search': term})
        self.assertEqual(response.status_code, 200, response.content)
        return [p['name'] for p in response.data['results']]

    def test_matches_name_description_and_category(self):
        self.assertCountEqual(self.search('croix'), ['Croix argentée', 'Médaille'])
        self.assertEqual(self.search('enfants'), ['Bible illustrée'])
        self.assertCountEqual(self.search('livres'), ['Bible illustrée'])

    def test_name_matches_come_first(self):
        self.assertEqual(self.search('croix')[0], 'Croix argentée')

    def test_all_words_must_match_in_any_field(self):
        self.assertEqual(self.search('croix argentée'), ['Croix argentée'])
        self.assertEqual(self.search('médaille croix'), ['Médaille'])
        self.assertEqual(self.search('croix bible'), [])

    def test_is_case_insensitive_and_returns_each_product_once(self):
        self.assertEqual(self.search('CROIX').count('Croix argentée'), 1)

    def test_suggest_endpoint_works_without_trigrams(self):
        response = self.client.get('/api/search/suggest/', {'q': 'bible'})
        self.assertEqual([p['name'] for p in response.data], ['Bible illustrée'])

    def test_extra_long_input_is_harmless(self):
        self.assertEqual(self.search('croix ' * 50), ['Croix argentée', 'Médaille'])


class MigrationWithoutExtensionTests(APITestCase):
    def test_migration_tolerates_a_server_without_the_extension(self):
        import importlib
        from types import SimpleNamespace

        from django.db import connection

        migration = importlib.import_module('catalog.migrations.0005_enable_pg_trgm')
        fake_editor = SimpleNamespace(connection=connection)
        with mock.patch.object(migration, 'EXTENSION_SQL', 'CREATE EXTENSION IF NOT EXISTS extension_inexistante_xyz'):
            migration.try_enable_trigram(None, fake_editor)  # ne doit pas lever d'exception
        with connection.cursor() as cursor:  # la transaction du migrate reste utilisable après l'échec toléré
            cursor.execute('SELECT 1')
            self.assertEqual(cursor.fetchone()[0], 1)
