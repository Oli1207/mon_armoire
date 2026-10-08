from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand

from catalog.models import ProductImage
from common.imaging import _open, make_thumbnail


class Command(BaseCommand):
    help = "Crée les miniatures WebP manquantes des photos produit existantes (non destructif : les originaux ne sont pas modifiés)."

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=200, help="Nombre maximum d'images traitées par exécution.")

    def handle(self, *args, **options):
        done = failed = 0
        missing = ProductImage.objects.filter(thumbnail__isnull=True) | ProductImage.objects.filter(thumbnail='')
        for image in missing[:options['limit']]:
            try:
                name, content = make_thumbnail(_open(image.image.file), image.image.name)
                image.thumbnail.save(name, ContentFile(content.read()), save=False)
                ProductImage.objects.filter(pk=image.pk).update(thumbnail=image.thumbnail.name)
                done += 1
            except Exception as exc:
                failed += 1
                self.stderr.write(f'{image.pk}: {exc}')
        self.stdout.write(f'{done} miniature(s) créée(s), {failed} échec(s).')
