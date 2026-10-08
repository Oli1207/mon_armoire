from decimal import Decimal

from django.core import mail
from rest_framework.test import APITestCase

from catalog.models import Category, Product, ProductVariant
from userauths.models import AuditLog, StaffProfile, User


def make_staff(email, role, **extra):
    user = User.objects.create_user(username=email.split('@')[0], email=email, password='Test-pass-123', is_staff=True)
    StaffProfile.objects.create(user=user, role=role, **extra)
    return user


class RolePermissionTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='boss', email='boss@test.ci', password='Test-pass-123', is_staff=True, is_superuser=True)
        self.category = Category.objects.create(name='Chaînes')

    def status(self, user, method, url, data=None):
        self.client.force_authenticate(user)
        return getattr(self.client, method)(url, data or {}, format='json').status_code

    def test_staff_account_without_profile_has_no_rights(self):
        user = User.objects.create_user(username='x', email='x@test.ci', password='Test-pass-123', is_staff=True)
        for url in ('/api/admin/products/', '/api/admin/orders/', '/api/admin/customers/', '/api/admin/stats/', '/api/auth/admin/team/'):
            self.assertEqual(self.status(user, 'get', url), 403, url)

    def test_inactive_profile_has_no_rights(self):
        user = make_staff('off@test.ci', 'manager', is_active=False)
        self.assertEqual(self.status(user, 'get', '/api/admin/products/'), 403)

    def test_orders_role_sees_orders_only(self):
        user = make_staff('prep@test.ci', 'orders')
        self.assertEqual(self.status(user, 'get', '/api/admin/orders/'), 200)
        for url in ('/api/admin/products/', '/api/admin/customers/', '/api/admin/stats/', '/api/admin/reviews/', '/api/admin/delivery-zones/', '/api/auth/admin/journal/'):
            self.assertEqual(self.status(user, 'get', url), 403, url)
        self.assertEqual(self.status(user, 'post', '/api/admin/products/', {'name': 'Intrus'}), 403)
        self.assertFalse(Product.objects.filter(name='Intrus').exists())

    def test_catalog_role_edits_products_but_not_money_or_customers(self):
        user = make_staff('cat@test.ci', 'catalog')
        self.assertEqual(self.status(user, 'post', '/api/admin/products/', {'name': 'Croix', 'category': str(self.category.id)}), 201)
        for url in ('/api/admin/orders/', '/api/admin/customers/', '/api/admin/stats/', '/api/admin/giftcards/'):
            self.assertEqual(self.status(user, 'get', url), 403, url)

    def test_individual_adjustment_adds_and_removes_rights(self):
        user = make_staff('adj@test.ci', 'orders', extra_permissions={'customers': True, 'orders_manage': False})
        self.assertEqual(self.status(user, 'get', '/api/admin/customers/'), 200)
        self.assertEqual(self.status(user, 'patch', '/api/orders/MA-INCONNU/status/', {'status': 'shipped'}), 403)

    def test_manager_cannot_reach_team_or_journal(self):
        user = make_staff('mgr@test.ci', 'manager')
        self.assertEqual(self.status(user, 'get', '/api/admin/products/'), 200)
        self.assertEqual(self.status(user, 'get', '/api/auth/admin/team/'), 403)
        self.assertEqual(self.status(user, 'get', '/api/auth/admin/journal/'), 403)

    def test_me_exposes_effective_rights(self):
        self.client.force_authenticate(make_staff('prep2@test.ci', 'orders'))
        staff = self.client.get('/api/auth/me/').data['staff']
        self.assertEqual(set(staff['permissions']), {'orders', 'orders_manage'})
        self.assertFalse(staff['is_owner'])
        self.client.force_authenticate(self.owner)
        self.assertTrue(self.client.get('/api/auth/me/').data['staff']['is_owner'])
        self.client.force_authenticate(User.objects.create_user(username='c', email='c@test.ci', password='Test-pass-123'))
        self.assertIsNone(self.client.get('/api/auth/me/').data['staff'])


class TeamManagementTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='boss', email='boss@test.ci', password='Test-pass-123', is_staff=True, is_superuser=True)
        self.client.force_authenticate(self.owner)

    def test_owner_invites_member_who_gets_an_email_link_not_a_password(self):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post('/api/auth/admin/team/', {'email': 'Nouvelle@Test.ci', 'role': 'catalog', 'full_name': 'Awa'}, format='json')
        self.assertEqual(response.status_code, 201, response.content)
        user = User.objects.get(email='nouvelle@test.ci')
        self.assertTrue(user.is_staff)
        self.assertFalse(user.has_usable_password())
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('/reset-password?token=', mail.outbox[0].body)

    def test_invalid_input_and_duplicates_are_refused_with_clear_messages(self):
        post = lambda data: self.client.post('/api/auth/admin/team/', data, format='json')
        self.assertIn('email', post({'email': 'pas-un-email', 'role': 'catalog'}).data)
        self.assertIn('role', post({'email': 'a@test.ci', 'role': 'dieu'}).data)
        self.assertEqual(post({'email': 'a@test.ci', 'role': 'catalog'}).status_code, 201)
        self.assertIn('email', post({'email': 'A@test.ci', 'role': 'orders'}).data)
        self.assertIn('email', post({'email': self.owner.email, 'role': 'orders'}).data)

    def test_existing_customer_can_be_promoted_without_losing_the_account(self):
        customer = User.objects.create_user(username='cl', email='cl@test.ci', password='Test-pass-123')
        self.assertEqual(self.client.post('/api/auth/admin/team/', {'email': 'cl@test.ci', 'role': 'support'}, format='json').status_code, 201)
        customer.refresh_from_db()
        self.assertTrue(customer.is_staff)
        self.assertTrue(customer.check_password('Test-pass-123'))

    def test_role_change_deactivation_and_removal(self):
        member = make_staff('m@test.ci', 'orders')
        profile = member.staff_profile
        url = f'/api/auth/admin/team/{profile.id}/'
        self.assertEqual(self.client.patch(url, {'role': 'catalog'}, format='json').data['role'], 'catalog')
        data = self.client.patch(url, {'extra_permissions': {'customers': True, 'catalog': True}}, format='json').data
        self.assertEqual(data['extra_permissions'], {'customers': True})  # 'catalog' fait déjà partie du rôle : pas un écart
        self.assertEqual(self.client.patch(url, {'extra_permissions': {'inexistant': True}}, format='json').status_code, 400)
        self.client.patch(url, {'is_active': False}, format='json')
        self.client.force_authenticate(member)
        self.assertEqual(self.client.get('/api/admin/products/').status_code, 403)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.delete(url).status_code, 204)
        member.refresh_from_db()
        self.assertFalse(member.is_staff)
        self.assertTrue(User.objects.filter(pk=member.pk).exists())

    def test_team_list_is_bounded_and_describes_roles(self):
        make_staff('m1@test.ci', 'orders')
        data = self.client.get('/api/auth/admin/team/').data
        self.assertEqual([m['email'] for m in data['members']], ['m1@test.ci'])
        self.assertEqual([o['email'] for o in data['owners']], ['boss@test.ci'])
        self.assertTrue(all(role['description'] for role in data['roles']))


class AuditLogTests(APITestCase):
    def setUp(self):
        # En production le jeton JWT est toujours envoyé ; force_authenticate le remplace dans les tests.
        self.client.credentials(HTTP_AUTHORIZATION='Bearer test')
        self.owner = User.objects.create_user(username='boss', email='boss@test.ci', password='Test-pass-123', is_staff=True, is_superuser=True)
        self.category = Category.objects.create(name='Chaînes')

    def test_actions_are_logged_with_readable_sentences_and_no_request_content(self):
        self.client.force_authenticate(self.owner)
        created = self.client.post('/api/admin/products/', {'name': 'Croix dorée', 'category': str(self.category.id), 'description': 'secret-123'}, format='json')
        self.assertEqual(created.status_code, 201)
        self.client.patch(f'/api/admin/products/{created.data["id"]}/', {'name': 'Croix argentée'}, format='json')
        self.client.delete(f'/api/admin/products/{created.data["id"]}/')
        self.client.get('/api/admin/products/')  # une lecture n'est pas journalisée
        entries = list(AuditLog.objects.order_by('created_at').values_list('action', 'summary'))
        self.assertEqual(entries[0], ('created', 'Produit créé : Croix dorée'))
        self.assertEqual(entries[1], ('updated', 'Produit modifié : Croix dorée'))
        self.assertEqual(entries[2], ('deleted', 'Produit supprimé : Croix argentée'))
        self.assertEqual(len(entries), 3)
        self.assertFalse(AuditLog.objects.filter(summary__icontains='secret').exists())

    def test_denied_attempts_are_logged_and_failed_validation_is_not(self):
        member = make_staff('prep@test.ci', 'orders')
        self.client.force_authenticate(member)
        self.client.post('/api/admin/products/', {'name': 'Intrus'}, format='json')
        entry = AuditLog.objects.get()
        self.assertEqual((entry.action, entry.actor_label), ('denied', 'prep@test.ci'))
        AuditLog.objects.all().delete()
        self.client.force_authenticate(self.owner)
        self.client.post('/api/admin/products/', {'name': ''}, format='json')   # refusé par la validation
        self.assertEqual(AuditLog.objects.count(), 0)

    def test_customers_actions_never_enter_the_journal(self):
        customer = User.objects.create_user(username='c', email='c@test.ci', password='Test-pass-123')
        self.client.force_authenticate(customer)
        self.client.post('/api/admin/products/', {'name': 'X'}, format='json')
        self.client.patch('/api/auth/me/update/', {'full_name': 'Awa'}, format='json')
        self.assertEqual(AuditLog.objects.count(), 0)

    def test_staff_login_is_logged_but_not_customer_login(self):
        User.objects.create_user(username='c', email='c@test.ci', password='Test-pass-123')
        self.client.post('/api/auth/token/', {'email': 'c@test.ci', 'password': 'Test-pass-123'}, format='json')
        self.assertEqual(AuditLog.objects.count(), 0)
        response = self.client.post('/api/auth/token/', {'email': 'boss@test.ci', 'password': 'Test-pass-123'}, format='json')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(AuditLog.objects.get().action, 'login')

    def test_only_the_owner_reads_the_journal_with_search_and_filter(self):
        self.client.force_authenticate(self.owner)
        self.client.post('/api/admin/products/', {'name': 'Croix', 'category': str(self.category.id)}, format='json')
        self.client.post('/api/admin/delivery-zones/', {'name': 'Abidjan', 'shipping_cost': '2000', 'min_days': 1, 'max_days': 2}, format='json')
        data = self.client.get('/api/auth/admin/journal/', {'search': 'zone'}).data
        self.assertEqual(data['count'], 1)
        self.assertEqual(self.client.get('/api/auth/admin/journal/', {'action': 'deleted'}).data['count'], 0)
        self.client.force_authenticate(make_staff('mgr@test.ci', 'manager'))
        self.assertEqual(self.client.get('/api/auth/admin/journal/').status_code, 403)
