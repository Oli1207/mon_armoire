"""Remise à zéro avant l'ouverture : supprime les données de TEST (commandes, clients, avis…) et garde le catalogue."""
from django.core.management.base import BaseCommand
from django.db import transaction

from catalog.models import WaitlistEntry
from coffrets.models import CoffretConfiguration
from notifications.models import PushSubscription
from orders.models import Cart, GiftCard, LoyaltyTransaction, Order
from reviews.models import Review
from userauths.models import User


class Command(BaseCommand):
    help = (
        "Supprime commandes, paniers, cartes cadeaux, points de fidélité, avis, listes d'attente, abonnements push "
        "et comptes clients (hors administrateurs). Garde produits, catégories, coffrets, zones de livraison et versets. "
        "Sans --yes : affiche seulement ce qui serait supprimé."
    )

    def add_arguments(self, parser):
        parser.add_argument('--yes', action='store_true', help='Confirme la suppression (irréversible : faire une sauvegarde avant).')

    def handle(self, *args, **options):
        targets = [
            ('commandes', Order.objects.all()),
            ('paniers', Cart.objects.all()),
            ('cartes cadeaux', GiftCard.objects.all()),
            ('mouvements de points de fidélité', LoyaltyTransaction.objects.all()),
            ('avis', Review.objects.all()),
            ("inscriptions en liste d'attente", WaitlistEntry.objects.all()),
            ('abonnements aux notifications', PushSubscription.objects.all()),
            ('coffrets configurés par des clientes', CoffretConfiguration.objects.all()),
            ('comptes clients (administrateurs conservés)', User.objects.filter(is_staff=False, is_superuser=False)),
        ]
        for label, queryset in targets:
            self.stdout.write(f'  {queryset.count():>6}  {label}')

        if not options['yes']:
            self.stdout.write(self.style.WARNING("\nRien n'a été supprimé. Relancer avec --yes pour confirmer (après une sauvegarde)."))
            return

        with transaction.atomic():
            for _, queryset in targets:
                queryset.delete()
        self.stdout.write(self.style.SUCCESS('\nDonnées de test supprimées. Les photos d\'avis restent sur le disque (dossier media/reviews).'))
