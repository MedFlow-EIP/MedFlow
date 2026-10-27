"""Remontée des erreurs serveur vers Sentry (facultatif).

Inactif tant que SENTRY_DSN n'est pas défini. Aucune donnée personnelle
n'est envoyée : ni en-têtes d'identité, ni contenu des requêtes (messages
du chat, cours importés), ni adresse IP.
"""
import logging
import os

logger = logging.getLogger(__name__)

_SENSITIVE_HEADERS = {"authorization", "cookie", "x-user-uid", "x-user-name", "x-user-avatar", "x-user-email"}


def scrub_event(event, _hint=None):
    """Retire de l'événement Sentry tout ce qui peut identifier ou décrire l'utilisateur."""
    request = event.get("request") or {}
    headers = request.get("headers") or {}
    if isinstance(headers, dict):
        request["headers"] = {k: v for k, v in headers.items() if k.lower() not in _SENSITIVE_HEADERS}
    for key in ("data", "cookies", "query_string", "env"):
        request.pop(key, None)
    event.pop("user", None)
    return event


def init_sentry() -> bool:
    """Initialise Sentry si SENTRY_DSN est défini. Renvoie True si actif."""
    dsn = os.getenv("SENTRY_DSN", "").strip()
    if not dsn:
        return False
    try:
        import sentry_sdk
        from sentry_sdk.integrations.flask import FlaskIntegration

        sentry_sdk.init(
            dsn=dsn,
            integrations=[FlaskIntegration()],
            environment=os.getenv("FLASK_ENV", "development"),
            send_default_pii=False,
            # Erreurs seulement (pas de suivi de performance) : reste dans le plan gratuit.
            traces_sample_rate=0.0,
            before_send=scrub_event,
        )
        logger.info("Sentry actif")
        return True
    except Exception:
        logger.exception("Initialisation Sentry impossible")
        return False
