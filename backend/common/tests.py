from io import StringIO

from django.core.management import call_command
from django.test import TestCase, override_settings

from common.management.commands.preflight import FAIL, OK, run_checks


class PreflightTests(TestCase):
    def levels(self):
        return {message: level for level, message in run_checks()}

    def test_database_checks_pass_on_a_ready_database(self):
        results = run_checks()
        messages = ' | '.join(message for _, message in results)
        self.assertIn('PostgreSQL', messages)
        self.assertTrue(any(level == OK and 'pg_trgm' in message for level, message in results))
        self.assertTrue(any(level == OK and 'migrations à jour' in message for level, message in results))

    @override_settings(SECRET_KEY='court')
    def test_weak_secret_key_is_a_failure(self):
        self.assertTrue(any(level == FAIL and 'SECRET_KEY' in message for level, message in run_checks()))

    @override_settings(DEBUG=True)
    def test_debug_is_a_failure(self):
        self.assertTrue(any(level == FAIL and 'DEBUG' in message for level, message in run_checks()))

    @override_settings(GENIUSPAY_WEBHOOK_SECRET='', PAYSTACK_SECRET_KEY='')
    def test_missing_payment_secrets_are_failures(self):
        failures = [message for level, message in run_checks() if level == FAIL]
        self.assertTrue(any('GeniusPay' in m for m in failures))
        self.assertTrue(any('Paystack' in m for m in failures))

    def test_command_exits_with_error_code_when_something_fails(self):
        out = StringIO()
        with override_settings(DEBUG=True), self.assertRaises(SystemExit) as raised:
            call_command('preflight', stdout=out)
        self.assertEqual(raised.exception.code, 1)
        self.assertIn('ECHEC', out.getvalue())
