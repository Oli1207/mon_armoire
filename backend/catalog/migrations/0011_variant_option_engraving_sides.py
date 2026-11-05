from django.db import migrations, models


def engraving_from_product(apps, schema_editor):
    """Jusqu'ici la gravure se réglait sur le produit : ses versions héritent d'une gravure sur une face."""
    ProductVariant = apps.get_model('catalog', 'ProductVariant')
    ProductVariant.objects.filter(product__is_personalizable=True).update(engraving_sides=1)


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0010_category_thumbnail'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='productvariant',
            options={'ordering': ['-is_default', 'price', 'id'], 'verbose_name_plural': 'Variantes produit'},
        ),
        migrations.AddField(
            model_name='productvariant',
            name='option',
            field=models.CharField(blank=True, default='', help_text='Nom de la version, ex : Simple, Gravure recto', max_length=60),
        ),
        migrations.AddField(
            model_name='productvariant',
            name='engraving_sides',
            field=models.PositiveSmallIntegerField(choices=[(0, 'Sans gravure'), (1, 'Gravure sur une face'), (2, 'Gravure recto et verso')], default=0, help_text='Gravure comprise dans le prix de cette version'),
        ),
        migrations.RunPython(engraving_from_product, migrations.RunPython.noop),
    ]
