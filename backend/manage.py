#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys
from pathlib import Path


def _load_settings_from_env():
    """Lit DJANGO_SETTINGS_MODULE depuis .env avant l'init Django."""
    env_path = Path(__file__).resolve().parent / '.env'
    if env_path.exists():
        for line in env_path.read_text(encoding='utf-8').splitlines():
            line = line.strip()
            if line.startswith('DJANGO_SETTINGS_MODULE='):
                value = line.split('=', 1)[1].strip().strip('"').strip("'")
                os.environ.setdefault('DJANGO_SETTINGS_MODULE', value)
                return


def main():
    """Run administrative tasks."""
    _load_settings_from_env()
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings.development')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
