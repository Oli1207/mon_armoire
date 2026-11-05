from django.db import migrations, models
from django.db.models import Count


def keep_existing_stocks_separate(apps, schema_editor):
    """Les produits qui ont déjà plusieurs variantes gardent leurs stocks séparés : aucun nombre saisi n'est écrasé."""
    Product = apps.get_model('catalog', 'Product')
    Product.objects.annotate(variant_count=Count('variants')).filter(variant_count__gt=1).update(shared_stock=False)


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0011_variant_option_engraving_sides'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='shared_stock',
            field=models.BooleanField(default=True, help_text='Stock commun à toutes les variantes (même objet physique, seule la gravure ou le prix change). Toutes les variantes portent alors le même nombre.'),
        ),
        migrations.RunPython(keep_existing_stocks_separate, migrations.RunPython.noop),
    ]
