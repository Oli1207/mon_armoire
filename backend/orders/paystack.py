"""
orders/paystack.py
───────────────────
Couche d'abstraction Paystack (repris de babiresi/backend/listings/views.py).
"""
from __future__ import annotations

from typing import Any, Dict, Optional

import requests
from django.conf import settings


class PaystackError(Exception):
    """Erreur Paystack : API down, clé invalide, etc."""


def _headers() -> Dict[str, str]:
    secret = getattr(settings, "PAYSTACK_SECRET_KEY", "") or ""
    if not secret:
        raise PaystackError("PAYSTACK_SECRET_KEY absent du .env.")
    return {"Authorization": f"Bearer {secret}", "Content-Type": "application/json"}


def initialize(email: str, amount_cfa: int, reference: str, callback_url: Optional[str] = None,
               metadata: Optional[Dict[str, Any]] = None, timeout: int = 20) -> Dict[str, Any]:
    """POST /transaction/initialize."""
    base_url = getattr(settings, "PAYSTACK_BASE_URL", "https://api.paystack.co")
    payload: Dict[str, Any] = {
        "email": email,
        "amount": int(amount_cfa) * 100,  # Paystack attend le montant en sous-unité
        "reference": reference,
    }
    if callback_url:
        payload["callback_url"] = callback_url
    if metadata:
        payload["metadata"] = metadata

    try:
        resp = requests.post(f"{base_url}/transaction/initialize", headers=_headers(), json=payload, timeout=timeout)
        resp.raise_for_status()
    except requests.RequestException as exc:
        raise PaystackError(f"Erreur réseau Paystack : {exc}") from exc

    return resp.json()


def verify(reference: str, timeout: int = 20) -> Dict[str, Any]:
    """GET /transaction/verify/{reference}."""
    base_url = getattr(settings, "PAYSTACK_BASE_URL", "https://api.paystack.co")
    try:
        resp = requests.get(f"{base_url}/transaction/verify/{reference}", headers=_headers(), timeout=timeout)
        resp.raise_for_status()
    except requests.RequestException as exc:
        raise PaystackError(f"Erreur réseau Paystack : {exc}") from exc

    return resp.json()
