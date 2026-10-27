"""Notifications push via le service gratuit d'Expo (qui relaie à FCM / APNs).

Best-effort : un échec d'envoi ne doit jamais faire échouer l'action de
l'utilisateur (demande d'ami, défi, import). Les jetons d'appareils
désinstallés sont supprimés d'après la réponse d'Expo.
"""
import logging
import re
import threading

import requests

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
TOKEN_RE = re.compile(r"^Expo(nent)?PushToken\[[A-Za-z0-9_\-]+\]$")


def is_valid_token(token) -> bool:
    return isinstance(token, str) and len(token) <= 200 and bool(TOKEN_RE.match(token))


def _send(app, tokens: list, title: str, body: str, data: dict | None) -> None:
    messages = [
        {"to": t, "title": title, "body": body, "data": data or {}, "sound": "default", "channelId": "default"}
        for t in tokens
    ]
    try:
        resp = requests.post(EXPO_PUSH_URL, json=messages, timeout=10)
        tickets = resp.json().get("data", []) if resp.ok else []
    except Exception:
        logger.warning("Envoi push impossible", exc_info=True)
        return
    for token, ticket in zip(tokens, tickets):
        if ticket.get("status") == "error" and (ticket.get("details") or {}).get("error") == "DeviceNotRegistered":
            app.db.delete_push_token(token)


def notify_user(app, uid: str, title: str, body: str, data: dict | None = None) -> None:
    """Envoie une notification à tous les appareils de l'utilisateur."""
    if not app.config.get("PUSH_ENABLED", True):
        return
    tokens = app.db.get_push_tokens(uid)
    if not tokens:
        return
    if app.config.get("PUSH_ASYNC", True):
        threading.Thread(target=_send, args=(app, tokens, title, body, data), daemon=True).start()
    else:
        _send(app, tokens, title, body, data)
