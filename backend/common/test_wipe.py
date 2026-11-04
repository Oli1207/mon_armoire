import shutil
import tempfile
from io import StringIO
from pathlib import Path

from django.core.management import call_command
from django.test import TestCase, override_settings

from catalog.models import Category, Product, ProductVariant
from coffrets.models import Coffret, CoffretConfiguration, CoffretItem
from common.models import SiteSettings
from notifications.models import PushSubscription, Verse
from orders.models import DeliveryZone
from reviews.models import Review
from userauths.models import User

MEDIA = tempfile.mkdtemp()


@override_settings(MEDIA_ROOT=MEDIA)
class WipeSiteContentTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        self.owner = User.objects.create_superuser(username='owner', email='owner@test.local', password='x')
        self.customer = User.objects.create_user(username='cliente', email='cliente@test.local', password='x')
        self.verse = Verse.objects.create(text='Texte', reference='Jean 3:16')
        category = Category.objects.create(name='C', slug='c')
        product = Product.objects.create(name='Chapelet', slug='chapelet', category=category)
        self.variant = ProductVariant.objects.create(product=product, price=1000, stock=1, sku='A1')
        coffret = Coffret.objects.create(name='Box', slug='box')
        CoffretItem.objects.create(coffret=coffret, variant=self.variant)
        CoffretConfiguration.objects.create(coffret=coffret)
        DeliveryZone.objects.create(name='Abidjan (FICTIF)', shipping_cost=2000, estimated_days_min=1, estimated_days_max=2)
        Review.objects.create(product=product, user=self.customer, rating=5, comment='Bien')
        for user, endpoint in ((self.owner, 'https://push.test/a'), (self.customer, 'https://push.test/b')):
            PushSubscription.objects.create(user=user, endpoint=endpoint, p256dh_key='k', auth_key='k')
        site = SiteSettings.objects.first() or SiteSettings.objects.create()
        SiteSettings.objects.filter(pk=site.pk).update(phone='+225 00 00 00 00', hero_image='site/a.jpg')
        for folder in ('products', 'site'):
            (Path(MEDIA) / folder).mkdir(exist_ok=True)
            (Path(MEDIA) / folder / 'a.webp').write_bytes(b'x')
        (Path(MEDIA) / '.htaccess').write_text('garder')

    def run_command(self, *args):
        out = StringIO()
        call_command('wipe_site_content', *args, stdout=out)
        return out.getvalue()

    def test_nothing_is_deleted_without_yes(self):
        self.assertIn("Rien n'a été supprimé", self.run_command())
        self.assertEqual(Product.objects.count(), 1)
        self.assertTrue((Path(MEDIA) / 'products' / 'a.webp').exists())

    def test_everything_goes_except_verses_team_texts_and_media_config(self):
        self.run_command('--yes')
        for model in (Product, ProductVariant, Category, Coffret, CoffretConfiguration, DeliveryZone, Review):
            self.assertEqual(model.objects.count(), 0, model)
        self.assertFalse(User.objects.filter(pk=self.customer.pk).exists())
        self.assertFalse((Path(MEDIA) / 'products').exists())
        self.assertFalse((Path(MEDIA) / 'site').exists())
        self.assertTrue((Path(MEDIA) / '.htaccess').exists())

        self.assertTrue(Verse.objects.filter(pk=self.verse.pk).exists())
        self.assertTrue(User.objects.filter(pk=self.owner.pk, is_superuser=True).exists())
        self.assertEqual(list(PushSubscription.objects.values_list('user', flat=True)), [self.owner.pk])
        site = SiteSettings.objects.first()
        self.assertEqual(site.phone, '+225 00 00 00 00')
        self.assertFalse(site.hero_image)

    def test_can_be_run_twice(self):
        self.run_command('--yes')
        self.assertIn('Site vidé', self.run_command('--yes'))
