"""Suivi des visiteurs, sans donnée personnelle : pas d'adresse IP, pas d'empreinte d'appareil.

Volume : les événements bruts (TrackEvent) sont nombreux, donc minimalistes (clé entière, peu d'index) et purgés après
EVENT_RETENTION_DAYS ; les écrans de l'Admin lisent les tableaux journaliers (DailyStat, DailyProductStat) remplis par la
commande `aggregate_analytics` (cron toutes les heures).
"""
from django.db import models

EVENT_RETENTION_DAYS = 90

EVENT_TYPES = (
    ('pageview', 'Page vue'),
    ('product_view', 'Fiche produit vue'),
    ('add_to_cart', 'Ajout au panier'),
    ('remove_from_cart', 'Retrait du panier'),
    ('favorite_add', 'Ajout aux favoris'),
    ('favorite_remove', 'Retrait des favoris'),
    ('search', 'Recherche'),
    ('begin_checkout', 'Début de commande'),
)
EVENT_KEYS = {key for key, _ in EVENT_TYPES}


class VisitSession(models.Model):
    """Un navigateur (identifiant tiré au hasard, gardé dans le navigateur). `is_internal` : personnel de la boutique, jamais compté."""
    sid           = models.CharField(max_length=36, unique=True)
    user          = models.ForeignKey('userauths.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='visit_sessions')
    is_internal   = models.BooleanField(default=False, db_index=True)
    device        = models.CharField(max_length=10, blank=True)      # mobile / tablet / desktop
    browser       = models.CharField(max_length=30, blank=True)
    source        = models.CharField(max_length=100, blank=True)     # site d'origine (domaine) ou utm_source
    campaign      = models.CharField(max_length=100, blank=True)
    landing_path  = models.CharField(max_length=200, blank=True)
    first_seen    = models.DateTimeField(auto_now_add=True)
    last_seen     = models.DateTimeField(db_index=True)


class TrackEvent(models.Model):
    session    = models.ForeignKey(VisitSession, on_delete=models.CASCADE, related_name='events')
    type       = models.CharField(max_length=20, choices=EVENT_TYPES)
    path       = models.CharField(max_length=200, blank=True)
    product    = models.ForeignKey('catalog.Product', on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    ref        = models.CharField(max_length=80, blank=True)          # autre objet (slug de coffret…) ou texte de recherche
    value      = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)  # prix, nombre de résultats…
    created_at = models.DateTimeField(db_index=True)

    class Meta:
        indexes = [models.Index(fields=['type', 'created_at'], name='track_type_date_idx')]


class DailyStat(models.Model):
    date          = models.DateField(unique=True)
    visitors      = models.PositiveIntegerField(default=0)
    pageviews     = models.PositiveIntegerField(default=0)
    product_views = models.PositiveIntegerField(default=0)
    add_to_carts  = models.PositiveIntegerField(default=0)
    checkouts     = models.PositiveIntegerField(default=0)    # visiteurs ayant ouvert la page de commande
    viewers       = models.PositiveIntegerField(default=0)    # visiteurs ayant vu au moins une fiche produit
    carters       = models.PositiveIntegerField(default=0)    # visiteurs ayant ajouté au panier
    orders        = models.PositiveIntegerField(default=0)    # commandes payées (source : table des commandes)
    revenue       = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    devices       = models.JSONField(default=dict)            # {"mobile": 12, ...}
    sources       = models.JSONField(default=dict)            # {"google.com": 5, "direct": 8}
    pages         = models.JSONField(default=dict)            # 20 pages les plus vues
    searches      = models.JSONField(default=dict)            # 20 recherches les plus fréquentes
    empty_searches = models.JSONField(default=dict)           # recherches sans résultat
    updated_at    = models.DateTimeField(auto_now=True)


class DailyProductStat(models.Model):
    date    = models.DateField()
    product = models.ForeignKey('catalog.Product', on_delete=models.CASCADE, related_name='daily_stats')
    views   = models.PositiveIntegerField(default=0)
    adds    = models.PositiveIntegerField(default=0)
    likes   = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['date', 'product'], name='unique_daily_product')]
        indexes = [models.Index(fields=['date'], name='dps_date_idx')]
