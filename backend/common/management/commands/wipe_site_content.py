"""Vide le site avant d'y mettre les vraies données : tout part, sauf les versets et ce qui permet de travailler."""
import shutil
from pathlib import Path

from django.conf import settings
from django.core.cache import cache
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q

from analytics.models import DailyProductStat, DailyStat, TrackEvent, VisitSession
from catalog.models import Category, Collection, LookbookEntry, Product, SymbolGuideEntry, WaitlistEntry
from coffrets.models import Coffret, CoffretConfiguration
from common.models import SiteSettings
from notifications.models import Alert, PushSubscription, Verse, VerseOverride
from orders.models import Cart, DeliveryZone, GiftCard, LoyaltyTransaction, Order
from reviews.models import Review
from userauths.models import Address, Favorite, User

MEDIA_FOLDERS = ('categories', 'coffrets', 'collections', 'lookbook', 'products', 'reviews', 'site', 'symbols', 'variants')


class Command(BaseCommand):
    help = (
        "Supprime catalogue, coffrets, zones de livraison, commandes, clientes, avis, statistiques et leurs photos. "
        "Garde les versets, les comptes de l'équipe, le journal, les textes et contacts du site. "
        "Sans --yes : affiche seulement ce qui serait supprimé."
    )

    def add_arguments(self, parser):
        parser.add_argument('--yes', action='store_true', help='Confirme la suppression (irréversible : faire une sauvegarde avant).')

    def handle(self, *args, **options):
        team = User.objects.filter(Q(is_staff=True) | Q(is_superuser=True))
        # Dans cet ordre : les commandes et les coffrets protègent les produits qu'ils contiennent
        targets = [
            ('commandes', Order.objects.all()),
            ('cartes cadeaux', GiftCard.objects.all()),
            ('paniers', Cart.objects.all()),
            ('mouvements de points de fidélité', LoyaltyTransaction.objects.all()),
            ('avis', Review.objects.all()),
            ("inscriptions en liste d'attente", WaitlistEntry.objects.all()),
            ('favoris', Favorite.objects.all()),
            ('coffrets configurés par des clientes', CoffretConfiguration.objects.all()),
            ('coffrets', Coffret.objects.all()),
            ('statistiques par produit', DailyProductStat.objects.all()),
            ('statistiques par jour', DailyStat.objects.all()),
            ('événements de visite', TrackEvent.objects.all()),
            ('visites', VisitSession.objects.all()),
            ('produits (avec photos et variantes)', Product.objects.all()),
            ('occasions', Collection.objects.all()),
            ('catégories', Category.objects.all()),
            ('entrées du guide des symboles', SymbolGuideEntry.objects.all()),
            ('entrées du lookbook', LookbookEntry.objects.all()),
            ('zones de livraison', DeliveryZone.objects.all()),
            ('alertes', Alert.objects.all()),
            ('abonnements aux notifications des clientes', PushSubscription.objects.exclude(user__in=team)),
            ('adresses', Address.objects.all()),
            ('comptes clients', User.objects.filter(is_staff=False, is_superuser=False)),
        ]
        self.stdout.write('À SUPPRIMER')
        for label, queryset in targets:
            self.stdout.write(f'  {queryset.count():>6}  {label}')
        site = SiteSettings.objects.first()
        if site and site.hero_image:
            self.stdout.write('       1  photo de la bannière d’accueil (la photo d’origine revient)')
        folders = [Path(settings.MEDIA_ROOT) / name for name in MEDIA_FOLDERS]
        self.stdout.write(f"  dossiers de photos : {', '.join(str(f) for f in folders if f.exists()) or 'aucun'}")

        self.stdout.write('\nCONSERVÉ')
        self.stdout.write(f'  {Verse.objects.count():>6}  versets ({VerseOverride.objects.count()} choisis pour une date)')
        self.stdout.write(f"  {team.count():>6}  comptes de l'équipe : {', '.join(team.values_list('email', flat=True))}")
        self.stdout.write('         textes et contacts du site, journal')

        if not options['yes']:
            self.stdout.write(self.style.WARNING("\nRien n'a été supprimé. Relancer avec --yes pour confirmer (après une sauvegarde)."))
            return

        with transaction.atomic():
            for _, queryset in targets:
                queryset.delete()
            if site and site.hero_image:
                SiteSettings.objects.filter(pk=site.pk).update(hero_image='')
        cache.clear()

        kept = []
        for folder in folders:
            shutil.rmtree(folder, ignore_errors=True)
            if folder.exists():
                kept.append(str(folder))
        if kept:
            self.stdout.write(self.style.WARNING(f"\nDossiers de photos à vider à la main : {', '.join(kept)}"))
        self.stdout.write(self.style.SUCCESS('\nSite vidé. Les versets et les comptes de l’équipe sont intacts.'))
