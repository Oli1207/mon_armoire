from django.db import DatabaseError, migrations, transaction

EXTENSION_SQL = 'CREATE EXTENSION IF NOT EXISTS pg_trgm'


def try_enable_trigram(apps, schema_editor):
    """Active pg_trgm (recherche tolérante aux fautes) SI le serveur la propose.

    L'hébergement mutualisé LWS ne l'installe pas : l'échec est toléré (savepoint) et la recherche
    retombe sur une correspondance simple (voir catalog/search.py).
    """
    if schema_editor.connection.vendor != 'postgresql':
        return
    try:
        with transaction.atomic():
            with schema_editor.connection.cursor() as cursor:
                cursor.execute(EXTENSION_SQL)
    except DatabaseError:
        pass


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0004_productvariant_allow_preorder_and_more'),
    ]

    operations = [
        migrations.RunPython(try_enable_trigram, migrations.RunPython.noop),
    ]
