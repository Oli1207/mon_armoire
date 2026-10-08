"""
Alimente quelques avis clients (avec photos) pour la mise en avant sur la page
d'accueil, à partir des photos fournies dans
C:\\Users\\LENOVO\\Documents\\mon_armoire\\chapelet_simple.
"""
from pathlib import Path

from django.contrib.auth.hashers import make_password
from django.core.files import File
from django.core.management.base import BaseCommand

from catalog.models import Product
from reviews.models import Review, ReviewImage
from userauths.models import User

SOURCE_DIR = Path(r'C:\Users\LENOVO\Documents\mon_armoire\chapelet_simple')

REVIEWS = [
    {
        'email': 'aminata.kone@example.com',
        'full_name': 'Aminata Koné',
        'product_slug': 'chaine-croix-multicolore',
        'rating': 5,
        'comment': "Encore plus belle en vrai ! Les pierres brillent magnifiquement et la carte avec le verset "
                    "était une attention magnifique. Je la porte tous les jours.",
        'images': [
            'WhatsApp Image 2026-09-07 at 19.07.45.jpeg',
            'WhatsApp Image 2026-09-07 at 19.07.48.jpeg',
        ],
    },
    {
        'email': 'christelle.boa@example.com',
        'full_name': 'Christelle Boa',
        'product_slug': 'chapelet-personnalise',
        'rating': 5,
        'comment': "J'ai commandé des bracelets personnalisés au prénom de chacune de mes sœurs pour Noël. "
                    "La qualité est top et la finition avec le prénom gravé est superbe. Elles ont adoré !",
        'images': [
            'WhatsApp Image 2026-09-07 at 19.07.36.jpeg',
            'WhatsApp Image 2026-09-07 at 19.07.58 (1).jpeg',
        ],
    },
    {
        'email': 'marie-ange.toure@example.com',
        'full_name': 'Marie-Ange Touré',
        'product_slug': 'chapelet-simple',
        'rating': 4,
        'comment': "Très joli chapelet, les perles sont bien travaillées et la médaille est délicate. "
                    "Livraison rapide sur Abidjan, je recommande.",
        'images': [
            'WhatsApp Image 2026-09-07 at 19.07.16.jpeg',
        ],
    },
    {
        'email': 'fatou.diallo@example.com',
        'full_name': 'Fatou Diallo',
        'product_slug': 'medaille-miraculeuse',
        'rating': 5,
        'comment': "Exactement ce que je cherchais pour le baptême de ma fille. Emballage soigné, service client "
                    "très réactif sur WhatsApp. Merci Mon Armoire !",
        'images': [],
    },
]


class Command(BaseCommand):
    help = "Crée des avis clients de démonstration (avec photos) mis en avant sur la page d'accueil."

    def handle(self, *args, **options):
        for data in REVIEWS:
            try:
                product = Product.objects.get(slug=data['product_slug'])
            except Product.DoesNotExist:
                self.stdout.write(self.style.WARNING(f"Produit introuvable : {data['product_slug']}"))
                continue

            user, _ = User.objects.get_or_create(
                email=data['email'],
                defaults={
                    'username': data['email'].split('@')[0],
                    'full_name': data['full_name'],
                    'password': make_password('DemoPass123!'),
                },
            )

            review, created = Review.objects.update_or_create(
                product=product, user=user,
                defaults={
                    'rating': data['rating'],
                    'comment': data['comment'],
                    'is_approved': True,
                    'is_featured': True,
                },
            )

            review.images.all().delete()
            for i, filename in enumerate(data['images']):
                path = SOURCE_DIR / filename
                if not path.exists():
                    continue
                with open(path, 'rb') as f:
                    img = ReviewImage(review=review, order=i)
                    img.image.save(path.name, File(f), save=True)

            verb = 'Créé' if created else 'Mis à jour'
            self.stdout.write(self.style.SUCCESS(f"{verb} : {user.full_name} — {product.name} ({review.images.count()} photo(s))"))
