"""
Alimente le catalogue avec de vrais produits Mon Armoire, à partir des photos
fournies dans C:\\Users\\LENOVO\\Documents\\mon_armoire.
"""
from pathlib import Path

from django.core.files import File
from django.core.management.base import BaseCommand

from catalog.models import Category, Product, ProductImage, ProductVariant
from coffrets.models import Coffret

SOURCE_DIR = Path(r'C:\Users\LENOVO\Documents\mon_armoire')


def _attach_image(product, filename, is_main=True):
    path = SOURCE_DIR / filename
    if not path.exists():
        return None
    img = ProductImage(product=product, is_main=is_main)
    with open(path, 'rb') as f:
        img.image.save(path.name, File(f), save=True)
    return img


def _attach_variant_image(variant, filename):
    path = SOURCE_DIR / filename
    if not path.exists():
        return
    with open(path, 'rb') as f:
        variant.image.save(path.name, File(f), save=True)


def _attach_coffret_image(coffret, filename):
    path = SOURCE_DIR / filename
    if not path.exists():
        return
    with open(path, 'rb') as f:
        coffret.image.save(path.name, File(f), save=True)


class Command(BaseCommand):
    help = "Seed de vrais produits Mon Armoire (catégories, produits, variantes, images)."

    def handle(self, *args, **options):
        categories = {}
        for name, order in [('Chaînes', 1), ('Bracelets', 2), ('Chapelets', 3), ('Médailles', 4), ('Bibles & Livres', 5)]:
            cat, _ = Category.objects.get_or_create(name=name, defaults={'order': order})
            categories[name] = cat
        self.stdout.write('Catégories prêtes.')

        # ── Médaille miraculeuse (déjà existante — on lui ajoute une vraie photo) ─
        medaille = Product.objects.filter(slug='medaille-miraculeuse').first()
        if medaille and not medaille.images.exists():
            _attach_image(medaille, r'chapelet_simple\WhatsApp Image 2026-09-07 at 19.07.32.jpeg')
            self.stdout.write('Photo ajoutée à Médaille miraculeuse.')

        # ── Chaîne croix multicolore ──────────────────────────────────────────
        p, created = Product.objects.get_or_create(
            name='Chaîne Croix Multicolore',
            defaults={
                'category': categories['Chaînes'],
                'description': "Chaîne fine plaquée or avec pendentif croix orné de pierres colorées.",
                'symbolic_meaning': "La croix rappelle le sacrifice du Christ ; chaque pierre ajoute une touche de lumière et d'élégance.",
            },
        )
        if created:
            ProductVariant.objects.create(product=p, color='Or', price=18000, stock=6, is_default=True)
            _attach_image(p, r'chapelet_simple\WhatsApp Image 2026-09-07 at 19.07.44.jpeg')
            self.stdout.write('Créé : Chaîne Croix Multicolore')

        # ── Chaîne en chapelet ────────────────────────────────────────────────
        p, created = Product.objects.get_or_create(
            name='Chaîne en Chapelet',
            defaults={
                'category': categories['Chaînes'],
                'description': "Chaîne délicate ornée d'une médaille de la Vierge et d'une croix pendante.",
                'symbolic_meaning': "Porter la Vierge et la croix près du cœur, comme un rappel constant de protection.",
            },
        )
        if created:
            ProductVariant.objects.create(product=p, color='Or', price=20000, stock=4, is_default=True)
            _attach_image(p, 'chaine_en_chapelet_1.jpeg')
            self.stdout.write('Créé : Chaîne en Chapelet')

        # ── Bracelet bébé/enfant personnalisé ─────────────────────────────────
        p, created = Product.objects.get_or_create(
            name='Bracelet Bébé/Enfant Personnalisé',
            defaults={
                'category': categories['Bracelets'],
                'description': "Bracelet fin plaqué or, personnalisable avec le prénom de l'enfant et une médaille.",
                'symbolic_meaning': "Un bijou-souvenir, béni dès les premiers jours, pour accompagner l'enfant sous la protection de Marie.",
            },
        )
        if created:
            ProductVariant.objects.create(product=p, color='Or', price=10000, stock=8, is_default=True)
            _attach_image(p, 'bracelet_bebe_enfant_personnalise.jpeg')
            self.stdout.write('Créé : Bracelet Bébé/Enfant Personnalisé')

        # ── Chapelet simple (2 variantes de couleur) ─────────────────────────
        p, created = Product.objects.get_or_create(
            name='Chapelet Simple',
            defaults={
                'category': categories['Chapelets'],
                'description': "Chapelet classique à perles, médaille miraculeuse et crucifix.",
                'symbolic_meaning': "Un compagnon de prière quotidien, simple et durable.",
            },
        )
        if created:
            v1 = ProductVariant.objects.create(product=p, color='Noir & Or', price=12000, stock=10, is_default=True)
            _attach_variant_image(v1, r'chapelet_simple\WhatsApp Image 2026-09-07 at 19.07.14.jpeg')
            v2 = ProductVariant.objects.create(product=p, color='Noir & Argent', price=12000, stock=10)
            _attach_variant_image(v2, r'chapelet_simple\WhatsApp Image 2026-09-07 at 19.07.15.jpeg')
            _attach_image(p, r'chapelet_simple\WhatsApp Image 2026-09-07 at 19.07.14.jpeg')
            self.stdout.write('Créé : Chapelet Simple (2 variantes)')

        # ── Chapelet personnalisé ─────────────────────────────────────────────
        p, created = Product.objects.get_or_create(
            name='Chapelet Personnalisé',
            defaults={
                'category': categories['Chapelets'],
                'description': "Chapelet coloré, personnalisable avec un prénom sur les perles.",
                'symbolic_meaning': "Un chapelet unique, porteur d'une intention personnelle à chaque dizaine.",
            },
        )
        if created:
            ProductVariant.objects.create(product=p, color='Multicolore', price=15000, stock=5, is_default=True)
            _attach_image(p, 'chapelet_personnalise_1.jpeg')
            self.stdout.write('Créé : Chapelet Personnalisé')

        # ── Bible ─────────────────────────────────────────────────────────────
        p, created = Product.objects.get_or_create(
            name="Bible — Femmes à son écoute",
            defaults={
                'category': categories['Bibles & Livres'],
                'description': "Bible avec notes d'étude pensées pour les femmes, couverture rigide élégante.",
                'symbolic_meaning': "La Parole vivante, un repère quotidien pour la foi.",
            },
        )
        if created:
            ProductVariant.objects.create(product=p, price=8000, stock=6, is_default=True)
            _attach_image(p, r'chapelet_simple\WhatsApp Image 2026-09-07 at 19.07.31.jpeg')
            self.stdout.write('Créé : Bible — Femmes à son écoute')

        # ── Coffrets : photos réelles ─────────────────────────────────────────
        coffret_bapteme = Coffret.objects.filter(slug='coffret-bapteme').first()
        if coffret_bapteme and not coffret_bapteme.image:
            coffret_bapteme.box_price = 20000
            coffret_bapteme.description = "Coffret complet pour célébrer un baptême : statuette, chapelet, bible illustrée, bougie et bijoux."
            coffret_bapteme.save()
            _attach_coffret_image(coffret_bapteme, 'box_bapteme.jpeg')
            self.stdout.write('Photo ajoutée à Coffret Baptême')

        coffret_bijoux, created = Coffret.objects.get_or_create(
            name='Coffret Bijoux Surprise',
            defaults={
                'description': "Un assortiment de bijoux chrétiens soigneusement emballés — croix, médailles et chapelet doré.",
                'box_price': 30000,
                'is_active': True,
            },
        )
        if created:
            _attach_coffret_image(coffret_bijoux, 'box_bijoux_1.jpeg')
            self.stdout.write('Créé : Coffret Bijoux Surprise')

        self.stdout.write(self.style.SUCCESS('Seed terminé.'))
