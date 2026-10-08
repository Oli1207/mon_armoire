from django.apps import apps
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand

from common.image_signals import IMAGE_FIELDS
from common.imaging import _open, _webp, make_thumbnail, webp_name


class Command(BaseCommand):
    help = (
        "Convertit en WebP réduit les photos déjà en ligne (coffrets, lookbook, symboles, catégories, variantes, produits) "
        "et crée les miniatures manquantes. Non destructif : les fichiers d'origine restent sur le disque. "
        "Idempotent : une image déjà en WebP n'est pas retouchée."
    )

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=100, help="Nombre maximum d'images traitées par exécution.")

    def handle(self, *args, **options):
        budget = options['limit']
        done = failed = 0
        for label, field, max_side, thumb_field in IMAGE_FIELDS:
            if budget <= 0:
                break
            model = apps.get_model(label)
            todo = model.objects.exclude(**{field: ''}).exclude(**{f'{field}__isnull': True}).exclude(**{f'{field}__iendswith': '.webp'})
            if thumb_field:
                # fichier déjà en WebP mais miniature absente
                todo = todo | model.objects.filter(**{f'{field}__iendswith': '.webp'}).filter(**{thumb_field: ''})
            for obj in todo.distinct()[:budget]:
                budget -= 1
                try:
                    source = getattr(obj, field)
                    img = _open(source.file)
                    updates = {}
                    if not source.name.lower().endswith('.webp'):
                        source.save(webp_name(source.name), ContentFile(_webp(img, max_side)), save=False)
                        updates[field] = source.name
                    if thumb_field:
                        name, content = make_thumbnail(img, source.name)
                        getattr(obj, thumb_field).save(name, content, save=False)
                        updates[thumb_field] = getattr(obj, thumb_field).name
                    model.objects.filter(pk=obj.pk).update(**updates)  # update() : pas de signal, pas de double conversion
                    done += 1
                except Exception as exc:
                    failed += 1
                    self.stderr.write(f'{label} {obj.pk}: {exc}')
        self.stdout.write(f'{done} image(s) optimisée(s), {failed} échec(s).' + (' Relancez pour continuer.' if budget <= 0 else ''))
