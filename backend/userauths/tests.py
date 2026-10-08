from django.core import mail
from rest_framework.test import APITestCase
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
from rest_framework_simplejwt.tokens import RefreshToken

from userauths.models import User


class PasswordResetTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u', email='u@test.ci', password='Ancien-mot-de-passe-1')

    def request_token(self):
        self.client.post('/api/auth/forgot-password/', {'email': 'u@test.ci'}, format='json')
        body = mail.outbox[-1].body
        return body.split('token=')[1].split()[0]

    def test_token_is_stored_hashed_and_single_use(self):
        token = self.request_token()
        self.user.refresh_from_db()
        self.assertNotEqual(self.user.reset_token, token)
        self.assertNotIn(token.split(':')[1], self.user.reset_token)

        ok = self.client.post('/api/auth/reset-password/', {'token': token, 'new_password': 'Nouveau-mot-de-passe-9'}, format='json')
        self.assertEqual(ok.status_code, 200, ok.content)
        again = self.client.post('/api/auth/reset-password/', {'token': token, 'new_password': 'Autre-mot-de-passe-9'}, format='json')
        self.assertEqual(again.status_code, 400)

    def test_reset_revokes_existing_sessions(self):
        refresh = RefreshToken.for_user(self.user)
        token = self.request_token()
        self.client.post('/api/auth/reset-password/', {'token': token, 'new_password': 'Nouveau-mot-de-passe-9'}, format='json')
        response = self.client.post('/api/auth/token/refresh/', {'refresh': str(refresh)}, format='json')
        self.assertEqual(response.status_code, 401)
        self.assertTrue(BlacklistedToken.objects.exists())

    def test_unknown_email_gets_same_answer(self):
        known = self.client.post('/api/auth/forgot-password/', {'email': 'u@test.ci'}, format='json')
        unknown = self.client.post('/api/auth/forgot-password/', {'email': 'x@test.ci'}, format='json')
        self.assertEqual(known.status_code, unknown.status_code)
        self.assertEqual(known.data, unknown.data)

    def test_forged_token_rejected(self):
        response = self.client.post('/api/auth/reset-password/', {'token': '1:abc', 'new_password': 'Nouveau-mot-de-passe-9'}, format='json')
        self.assertEqual(response.status_code, 400)


class ApiHardeningTests(APITestCase):
    def test_api_returns_json_only(self):
        response = self.client.get('/api/categories/', HTTP_ACCEPT='text/html')
        self.assertEqual(response['Content-Type'], 'application/json')

    def test_unknown_url_is_json_404(self):
        response = self.client.get('/api/n-existe-pas/')
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response['Content-Type'], 'application/json')
