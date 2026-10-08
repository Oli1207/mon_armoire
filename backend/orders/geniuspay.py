"""
orders/geniuspay.py
────────────────────
Couche d'abstraction GeniusPay (repris de findit/backend/store/geniuspay_helpers.py).

Doc API : https://pay.genius.ci/api/v1/merchant
Auth    : X-API-Key (clé publique) + X-API-Secret (clé secrète)
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

GENIUSPAY_BASE_URL = "https://pay.genius.ci/api/v1/merchant"


class GeniusPayError(Exception):
    """Erreur GeniusPay : API down, clé invalide, montant invalide, etc."""


def _headers() -> Dict[str, str]:
    public_key = getattr(settings, "GENIUSPAY_PUBLIC_KEY", "") or ""
    secret_key = getattr(settings, "GENIUSPAY_SECRET_KEY", "") or ""
    if not public_key or not secret_key:
        raise GeniusPayError("GENIUSPAY_PUBLIC_KEY ou GENIUSPAY_SECRET_KEY absent du .env.")
    return {
        "X-API-Key":    public_key,
        "X-API-Secret": secret_key,
        "Content-Type": "application/json",
        "Accept":       "application/json",
        "User-Agent":   "MonArmoire/1.0 (+https://monarmoire.store)",
    }


def _parse_response(resp: requests.Response) -> Dict[str, Any]:
    try:
        data = resp.json()
    except Exception:
        raise GeniusPayError(f"Réponse GeniusPay non-JSON (HTTP {resp.status_code}) : {resp.text[:200]}")

    if resp.status_code >= 400:
        if isinstance(data, dict):
            nested = data.get("error")
            if isinstance(nested, dict):
                msg = nested.get("message") or data.get("message") or f"HTTP {resp.status_code}"
            else:
                msg = data.get("message") or data.get("error") or f"HTTP {resp.status_code}"
        else:
            msg = f"HTTP {resp.status_code}"
        raise GeniusPayError(f"GeniusPay : {msg}")

    return data


def create_payment(
    *,
    amount: int,
    description: str,
    customer_name: str,
    customer_phone: str,
    customer_email: str,
    success_url: str,
    error_url: str,
    metadata: Optional[Dict[str, Any]] = None,
    timeout: int = 15,
) -> Dict[str, Any]:
    """POST /payments — crée une transaction GeniusPay. Lève GeniusPayError en cas d'échec."""
    if not isinstance(amount, int) or amount <= 0:
        raise GeniusPayError(f"create_payment : amount doit être un entier > 0 (reçu {amount!r}).")

    payload: Dict[str, Any] = {
        "amount":      amount,
        "description": description,
        "customer": {
            "name":  customer_name or "Client",
            "phone": customer_phone or "",
            "email": customer_email or "client@monarmoire.store",
        },
        "success_url": success_url,
        "error_url":   error_url,
    }
    if metadata:
        payload["metadata"] = metadata

    try:
        resp = requests.post(
            f"{GENIUSPAY_BASE_URL}/payments", headers=_headers(), json=payload,
            timeout=timeout, allow_redirects=False,
        )
    except requests.RequestException as exc:
        raise GeniusPayError(f"Erreur réseau GeniusPay : {exc}") from exc

    return _parse_response(resp)


def get_payment(reference: str, *, timeout: int = 15) -> Dict[str, Any]:
    """GET /payments/{reference} — vérifie le statut d'une transaction."""
    if not reference:
        raise GeniusPayError("get_payment : référence vide.")

    try:
        resp = requests.get(
            f"{GENIUSPAY_BASE_URL}/payments/{reference}", headers=_headers(),
            timeout=timeout, allow_redirects=False,
        )
    except requests.RequestException as exc:
        raise GeniusPayError(f"Erreur réseau GeniusPay : {exc}") from exc

    return _parse_response(resp)
