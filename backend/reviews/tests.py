from decimal import Decimal

from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APITestCase

from catalog.models import Category, Product, ProductVariant
from reviews.models import Review
from userauths.models import User


def make_product(name='Croix'):
    product = Product.objects.create(name=name, category=Category.objects.get_or_create(name='Chaînes')[0])
    ProductVariant.objects.create(product=product, price=Decimal('1000'), stock=2, is_default=True)
    return product


def make_reviews(product, ratings, approved=True):
    for i, rating in enumerate(ratings):
        user = User.objects.create_user(username=f'{product.slug}-{i}-{approved}', email=f'{product.slug}-{i}-{approved}@test.ci', password='x')
        Review.objects.create(product=product, user=user, rating=rating, comment='ok', is_approved=approved)


class ReviewSummaryTests(APITestCase):
    def test_summary_gives_average_count_and_distribution(self):
        product = make_product()
        make_reviews(product, [5, 5, 4, 2])
        make_reviews(product, [1], approved=False)  # non approuvé : jamais compté
        data = self.client.get(f'/api/products/{product.slug}/reviews/').data
        self.assertEqual(data['summary'], {'average': 4.0, 'count': 4, 'distribution': {'5': 2, '4': 1, '3': 0, '2': 1, '1': 0}})

    def test_summary_without_reviews(self):
        product = make_product()
        data = self.client.get(f'/api/products/{product.slug}/reviews/').data
        self.assertEqual(data['summary']['count'], 0)
        self.assertEqual(data['summary']['average'], 0)

    def test_catalogue_cards_carry_the_rating_without_extra_queries(self):
        first = make_product('Croix A')
        make_reviews(first, [5, 4])
        with CaptureQueriesContext(connection) as few:
            response = self.client.get('/api/products/')
        by_name = {p['name']: p for p in response.data['results']}
        self.assertEqual(by_name['Croix A']['rating_average'], 4.5)
        self.assertEqual(by_name['Croix A']['rating_count'], 2)

        for i in range(6):
            product = make_product(f'Bijou {i}')
            make_reviews(product, [3, 5])
        with CaptureQueriesContext(connection) as many:
            self.client.get('/api/products/')
        self.assertEqual(len(few), len(many))

    def test_products_without_reviews_have_no_rating(self):
        make_product('Sans avis')
        card = self.client.get('/api/products/').data['results'][0]
        self.assertIsNone(card['rating_average'])
        self.assertEqual(card['rating_count'], 0)

    def test_overlong_comment_is_refused(self):
        product = make_product()
        user = User.objects.create_user(username='u', email='u@test.ci', password='Test-pass-123')
        self.client.force_authenticate(user)
        response = self.client.post(f'/api/products/{product.slug}/reviews/', {'rating': 5, 'comment': 'x' * 1501}, format='json')
        self.assertEqual(response.status_code, 400)
        ok = self.client.post(f'/api/products/{product.slug}/reviews/', {'rating': 5, 'comment': 'Magnifique !'}, format='json')
        self.assertEqual(ok.status_code, 201, ok.content)
