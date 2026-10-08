"""Collecte des événements de navigation (publique, limitée en débit, sans donnée personnelle)."""
import re
from decimal import Decimal, InvalidOperation
from urllib.parse import urlparse

from django.conf import settings
from django.db import IntegrityError
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle

from catalog.models import Product

from .models import EVENT_KEYS, TrackEvent, VisitSession

MAX_BATCH = 25
SID_RE = re.compile(r'^[0-9a-fA-F-]{20,36}$')
BOT_RE = re.compile(r'bot|crawl|spider|slurp|preview|monitor|headless|lighthouse|facebookexternalhit|curl|python-requests', re.I)


class TrackThrottle(SimpleRateThrottle):
    """Par adresse IP, connectée ou non : un lot par visite suffit, 60 par minute est très large."""
    scope = 'track'

    def get_cache_key(self, request, view):
        return self.cache_format % {'scope': self.scope, 'ident': self.get_ident(request)}


def _text(value, limit):
    return value.strip()[:limit] if isinstance(value, str) else ''


def _device(agent):
    if re.search(r'iPad|Tablet|PlayBook', agent):
        return 'tablet'
    if re.search(r'Mobi|Android|iPhone|iPod', agent):
        return 'mobile'
    return 'desktop'


def _browser(agent):
    for needle, name in (('Edg', 'Edge'), ('OPR', 'Opera'), ('SamsungBrowser', 'Samsung'), ('Firefox', 'Firefox'),
                         ('Chrome', 'Chrome'), ('CriOS', 'Chrome'), ('Safari', 'Safari')):
        if needle in agent:
            return name
    return 'Autre'


def _source(meta):
    utm = _text(meta.get('utm_source'), 100)
    if utm:
        return utm.lower()
    host = urlparse(_text(meta.get('referrer'), 300)).netloc.lower().removeprefix('www.')
    own = urlparse(settings.FRONTEND_URL).netloc.lower().removeprefix('www.')
    return '' if not host or host == own else host[:100]


def _clean_event(raw, products_by_slug):
    if not isinstance(raw, dict) or raw.get('t') not in EVENT_KEYS:
        return None
    path = _text(raw.get('path'), 200)
    if path and not path.startswith('/') or path.startswith('/admin'):
        return None
    value = None
    if raw.get('v') is not None:
        try:
            value = Decimal(str(raw['v']))
            if not value.is_finite() or not (0 <= value < 10**9):
                value = None
        except (InvalidOperation, ValueError):
            value = None
    return TrackEvent(
        type=raw['t'], path=path, product=products_by_slug.get(_text(raw.get('p'), 220)),
        ref=_text(raw.get('ref'), 80), value=value,
    )


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([TrackThrottle])
def collect(request):
    data = request.data if isinstance(request.data, dict) else {}
    sid = data.get('sid')
    if not isinstance(sid, str) or not SID_RE.match(sid):
        return Response(status=400)
    agent = request.META.get('HTTP_USER_AGENT', '')[:300]
    if BOT_RE.search(agent):
        return Response(status=204)

    user = request.user if request.user.is_authenticated else None
    now = timezone.now()
    meta = data.get('meta') if isinstance(data.get('meta'), dict) else {}
    try:
        session, _ = VisitSession.objects.get_or_create(sid=sid, defaults={
            'user': user, 'device': _device(agent), 'browser': _browser(agent), 'source': _source(meta),
            'campaign': _text(meta.get('utm_campaign'), 100), 'landing_path': _text(meta.get('landing'), 200), 'last_seen': now,
            'is_internal': bool(user and user.is_staff),
        })
    except IntegrityError:   # deux lots simultanés du même navigateur
        session = VisitSession.objects.get(sid=sid)

    updates = {'last_seen': now}
    if user and user.is_staff and not session.is_internal:
        updates['is_internal'] = True    # le personnel s'est connecté après avoir navigué : ses visites passées sortent des chiffres
    if user and session.user_id != user.id:
        updates['user'] = user
    VisitSession.objects.filter(pk=session.pk).update(**updates)
    if session.is_internal or updates.get('is_internal'):
        return Response(status=204)

    raw_events = data.get('events') if isinstance(data.get('events'), list) else []
    raw_events = raw_events[:MAX_BATCH]
    slugs = {_text(e.get('p'), 220) for e in raw_events if isinstance(e, dict) and e.get('p')}
    products = {p.slug: p for p in Product.objects.filter(slug__in=slugs).only('id', 'slug')} if slugs else {}
    events = [e for e in (_clean_event(raw, products) for raw in raw_events) if e]
    for event in events:
        event.session_id, event.created_at = session.pk, now
    if events:
        TrackEvent.objects.bulk_create(events)
    return Response(status=204)
