"""
Alimente le guide des symboles, le lookbook et les collections « occasion »
utilisées par le quiz et le module « Je cherche un cadeau ».
"""
from pathlib import Path

from django.core.files import File
from django.core.management.base import BaseCommand

from catalog.models import Category, Collection, LookbookEntry, Product, SymbolGuideEntry

SOURCE_DIR   = Path(r'C:\Users\LENOVO\Documents\mon_armoire')
SIMPLE_DIR   = SOURCE_DIR / 'chapelet_simple'

SYMBOLS = [
    {
        'name': 'La Croix',
        'subtitle': "Le signe central de la foi chrétienne",
        'meaning': "La croix rappelle le sacrifice du Christ et sa victoire sur la mort. La porter, c'est "
                    "affirmer sa foi avec discrétion et garder près de soi un rappel constant d'espérance.",
        'image': SIMPLE_DIR / 'WhatsApp Image 2026-09-07 at 19.07.45.jpeg',
        'category_slug': 'chaines',
    },
    {
        'name': 'Le Chapelet',
        'subtitle': "Un compagnon de prière, grain après grain",
        'meaning': "Le chapelet accompagne la récitation du Rosaire : chaque grain correspond à une prière "
                    "(Je vous salue Marie, Notre Père) et invite à méditer les grands moments de la vie du Christ "
                    "et de la Vierge Marie.",
        'image': SOURCE_DIR / 'chapelet_personnalise_1.jpeg',
        'category_slug': 'chapelets',
    },
    {
        'name': 'La Médaille Miraculeuse',
        'subtitle': "Sous la protection de la Vierge Marie",
        'meaning': "Née de l'apparition de la Vierge Marie à Sainte Catherine Labouré en 1830, cette médaille "
                    "est portée comme un signe de protection et de confiance en l'intercession de Marie.",
        'image': SIMPLE_DIR / 'WhatsApp Image 2026-09-07 at 19.07.41.jpeg',
        'category_slug': 'medailles',
    },
    {
        'name': 'Le Bracelet Béni',
        'subtitle': "La foi portée au quotidien, tout en délicatesse",
        'meaning': "Souvent offert lors d'un baptême ou d'une communion, le bracelet est un rappel discret et "
                    "quotidien de la foi, à porter comme un petit trésor personnel.",
        'image': SOURCE_DIR / 'bracelet_bebe_enfant_personnalise.jpeg',
        'category_slug': 'bracelets',
    },
    {
        'name': 'La Bible',
        'subtitle': "La Parole comme fondation",
        'meaning': "Plus qu'un livre, la Bible est la Parole de Dieu et un guide de vie. L'offrir, c'est "
                    "transmettre une source d'inspiration et de réconfort pour chaque étape de la vie.",
        'image': SIMPLE_DIR / 'WhatsApp Image 2026-09-07 at 19.07.31.jpeg',
        'category_slug': 'bibles-livres',
    },
]

LOOKBOOK = [
    {
        'title': "Un matin de lumière",
        'description': "La chaîne en chapelet, portée avec élégance pour accompagner chaque journée.",
        'image': SOURCE_DIR / 'chaine_en_chapelet_1.jpeg',
        'product_names': ['Chaîne en Chapelet'],
    },
    {
        'title': "Un coffret à offrir",
        'description': "Une sélection de bijoux et médailles, prête à être offerte pour un moment important.",
        'image': SOURCE_DIR / 'box_bijoux_1.jpeg',
        'product_names': ['Chaîne Croix Multicolore', 'Médaille miraculeuse'],
    },
    {
        'title': "Prière et douceur",
        'description': "Le chapelet personnalisé, posé aux côtés de la Bible — un rituel simple, chaque jour.",
        'image': SOURCE_DIR / 'chapelet_personnalise_1.jpeg',
        'product_names': ['Chapelet Personnalisé', 'Bible — Femmes à son écoute'],
    },
]

OCCASIONS = [
    {'name': 'Baptême',        'products': ['Bracelet Bébé/Enfant Personnalisé', 'Médaille miraculeuse']},
    {'name': 'Communion',      'products': ['Bible — Femmes à son écoute', 'Chapelet Simple']},
    {'name': 'Confirmation',   'products': ['Chaîne Croix Multicolore', 'Chapelet Personnalisé']},
    {'name': 'Fête des Mères', 'products': ['Chaîne en Chapelet', 'Médaille miraculeuse']},
    {'name': 'Anniversaire',   'products': ['Chaîne Croix Multicolore', 'Chapelet Simple']},
]


class Command(BaseCommand):
    help = "Seed guide des symboles, lookbook et collections occasion."

    def handle(self, *args, **options):
        # ── Guide des symboles ───────────────────────────────────────────────
        for order, data in enumerate(SYMBOLS):
            category = Category.objects.filter(slug=data['category_slug']).first()
            entry, created = SymbolGuideEntry.objects.update_or_create(
                name=data['name'],
                defaults={
                    'subtitle': data['subtitle'],
                    'meaning': data['meaning'],
                    'category': category,
                    'order': order,
                    'is_active': True,
                },
            )
            if data['image'].exists() and not entry.image:
                with open(data['image'], 'rb') as f:
                    entry.image.save(data['image'].name, File(f), save=True)
            self.stdout.write(self.style.SUCCESS(f"Symbole : {entry.name}"))

        # ── Lookbook ──────────────────────────────────────────────────────────
        for order, data in enumerate(LOOKBOOK):
            entry, created = LookbookEntry.objects.update_or_create(
                title=data['title'],
                defaults={'description': data['description'], 'order': order, 'is_active': True},
            )
            if data['image'].exists() and not entry.image:
                with open(data['image'], 'rb') as f:
                    entry.image.save(data['image'].name, File(f), save=True)
            products = Product.objects.filter(name__in=data['product_names'])
            entry.products.set(products)
            self.stdout.write(self.style.SUCCESS(f"Look : {entry.title} ({products.count()} produit(s))"))

        # ── Collections occasion ─────────────────────────────────────────────
        for data in OCCASIONS:
            collection, created = Collection.objects.update_or_create(
                kind='occasion', name=data['name'],
            )
            products = Product.objects.filter(name__in=data['products'])
            for p in products:
                p.collections.add(collection)
            self.stdout.write(self.style.SUCCESS(f"Occasion : {collection.name} ({products.count()} produit(s))"))
