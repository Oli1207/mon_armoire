import io
import os
import shutil
import tempfile
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from catalog.models import Category, Product
from common import uploads
from common.management.commands.preflight import _photo_format_works
from common.uploads import validate_image_upload
from userauths.models import User

MEDIA = tempfile.mkdtemp()


def picture(image_format, size=(800, 600), mode='RGB', **options):
    buffer = io.BytesIO()
    Image.new(mode, size).save(buffer, image_format, **options)
    return buffer.getvalue()


def phone_jpeg():
    """Un .jpg de téléphone récent (HDR ou portrait) : plusieurs images dans le fichier, lu comme « MPO »."""
    return picture('MPO', save_all=True, append_images=[Image.new('RGB', (40, 30))])


def noisy_jpeg(side):
    """JPEG de plus de 2 Mo : Django le passe par un fichier temporaire, comme une vraie photo."""
    buffer = io.BytesIO()
    Image.frombytes('RGB', (side, side), os.urandom(side * side * 3)).save(buffer, 'JPEG', quality=95)
    return buffer.getvalue()


@override_settings(MEDIA_ROOT=MEDIA)
class AdminImageUploadTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(User.objects.create_superuser(username='owner', email='owner@test.local', password='x'))
        self.product = Product.objects.create(name='Chapelet', slug='chapelet', category=Category.objects.create(name='C', slug='c'))

    def send(self, data, name):
        return self.client.post(
            f'/api/admin/products/{self.product.id}/images/',
            {'image': SimpleUploadedFile(name, data, content_type='application/octet-stream'), 'is_main': 'false'},
            format='multipart',
        )

    def test_photos_are_accepted_whatever_the_format_and_stored_as_webp(self):
        cases = {
            'jpeg': (picture('JPEG'), 'a.jpg'),
            'jpeg de téléphone (MPO)': (phone_jpeg(), 'IMG_2031.JPG'),
            'jfif': (picture('JPEG'), 'photo.jfif'),
            'png transparent': (picture('PNG', mode='RGBA'), 'a.png'),
            'webp': (picture('WEBP'), 'a.webp'),
            'iphone': (picture('HEIF'), 'IMG_0001.HEIC'),
            'avif': (picture('AVIF'), 'a.avif'),
            'gif': (picture('GIF', mode='P'), 'a.gif'),
            'bmp': (picture('BMP'), 'a.bmp'),
            'tiff': (picture('TIFF'), 'a.tiff'),
            'cmyk': (picture('JPEG', mode='CMYK'), 'imprimerie.jpg'),
        }
        for label, (data, name) in cases.items():
            with self.subTest(label):
                response = self.send(data, name)
                self.assertEqual(response.status_code, 201, response.data)
                self.assertTrue(response.data['image'].endswith('.webp'), response.data['image'])

    def test_file_name_does_not_matter(self):
        for name in ('photo', 'photo.txt', 'webp-mal-nommé.jpg', 'x' * 150 + '.jpg', '....jpg', 'été n°1 (copie).jpeg'):
            with self.subTest(name):
                response = self.send(picture('JPEG'), name)
                self.assertEqual(response.status_code, 201, response.data)

    def test_large_phone_photo_goes_through_a_temporary_file(self):
        data = noisy_jpeg(1500)
        self.assertGreater(len(data), 2 * 1024 * 1024)
        self.assertEqual(self.send(data, 'grande.jpg').status_code, 201)

    def test_many_pixels_are_accepted(self):
        self.assertEqual(self.send(picture('JPEG', (9000, 6700), quality=30), '60mpx.jpg').status_code, 201)

    def test_refusals_tell_the_real_reason(self):
        with mock.patch.object(uploads, 'MAX_READABLE_PIXELS', 100):
            self.assertIn('trop de pixels', str(self.send(picture('JPEG'), 'a.jpg').data['image']))
        with mock.patch.object(uploads, 'MAX_ADMIN_IMAGE_BYTES', 10):
            self.assertIn('le maximum est', str(self.send(picture('JPEG'), 'a.jpg').data['image']))
        with mock.patch.object(Image, 'MAX_IMAGE_PIXELS', 10):
            self.assertIn('trop de pixels', str(self.send(picture('JPEG'), 'a.jpg').data['image']))

    def test_non_photos_are_still_refused(self):
        svg = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
        eps = b'%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 0 0 10 10\n%%EOF\n'
        for label, (data, name) in {
            'pdf': (b'%PDF-1.4 x', 'a.pdf'), 'video': (b'\x00\x00\x00\x18ftypmp42' + b'0' * 50, 'a.mp4'),
            'svg': (svg, 'a.svg'), 'eps': (eps, 'a.eps'), 'tronquée': (picture('JPEG')[:300], 'a.jpg'), 'vide': (b'', 'a.jpg'),
        }.items():
            with self.subTest(label):
                self.assertEqual(self.send(data, name).status_code, 400)
        self.assertEqual(self.product.images.count(), 0)


class PreflightPhotoTests(TestCase):
    def test_every_photo_format_is_checked(self):
        for image_format in ('JPEG', 'PNG', 'WEBP', 'HEIF', 'AVIF'):
            self.assertTrue(_photo_format_works(image_format), image_format)


class ReviewImageValidationTests(TestCase):
    def test_phone_jpeg_is_accepted_for_customers(self):
        validate_image_upload(SimpleUploadedFile('a.jpg', phone_jpeg()))

    def test_customers_stay_limited(self):
        with self.assertRaises(ValueError):
            validate_image_upload(SimpleUploadedFile('a.gif', picture('GIF', mode='P')))
        with mock.patch.object(Image, 'MAX_IMAGE_PIXELS', 10), self.assertRaises(ValueError):
            validate_image_upload(SimpleUploadedFile('a.jpg', picture('JPEG')))
