import json
import zlib

from django.test import TestCase


class UnsafeCharsetTests(TestCase):
    bomb = zlib.compress(json.dumps({'email': 'a@a.a', 'password': 'x' * 5_000_000}).encode(), 9)

    def post(self, path, body, content_type):
        return self.client.generic('POST', path, data=body, content_type=content_type)

    def test_compression_codecs_are_refused_on_public_routes(self):
        for path in ('/api/auth/token/', '/api/track/'):
            for charset in ('zlib_codec', 'zlib', 'ZIP', 'bz2_codec', 'base64_codec', 'hex_codec', 'rot13', 'unicode_escape'):
                with self.subTest(path=path, charset=charset):
                    response = self.post(path, self.bomb, f'application/json; charset={charset}')
                    self.assertEqual(response.status_code, 415)
                    self.assertEqual(response['Content-Type'], 'application/json')

    def test_normal_requests_are_untouched(self):
        body = json.dumps({'email': 'a@a.a', 'password': 'faux'}).encode()
        for content_type in ('application/json', 'application/json; charset=utf-8', 'application/json; charset=UTF8', 'application/json; charset=inconnu'):
            with self.subTest(content_type):
                self.assertEqual(self.post('/api/auth/token/', body, content_type).status_code, 401)

    def test_multipart_is_untouched(self):
        response = self.client.post('/api/auth/token/', {'email': 'a@a.a', 'password': 'faux'})
        self.assertEqual(response.status_code, 401)
