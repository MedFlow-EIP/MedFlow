"""Notifications push : via le service gratuit d'Expo (app Expo) ou via
Firebase Cloud Messaging (app Flutter iOS), selon le jeton de l'appareil.

Best-effort : un échec d'envoi ne doit jamais faire échouer l'action de
l'utilisateur (demande d'ami, défi, import). Les jetons d'appareils
désinstallés sont supprimés d'après la réponse d'Expo ou de FCM.

Les jetons des deux sortes vivent dans la même table : leur format suffit
à savoir par où envoyer.
"""
import logging
import re
import threading

import requests

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
TOKEN_RE = re.compile(r"^Expo(nent)?PushToken\[[A-Za-z0-9_\-]+\]$")
# Jeton d'enregistrement FCM (firebase_messaging) : ~160 caractères en pratique.
FCM_TOKEN_RE = re.compile(r"^[A-Za-z0-9_\-:]{20,512}$")


def is_expo_token(token) -> bool:
    return isinstance(token, str) and len(token) <= 200 and bool(TOKEN_RE.match(token))


def is_fcm_token(token) -> bool:
    return isinstance(token, str) and bool(FCM_TOKEN_RE.match(token))


def is_valid_token(token) -> bool:
    return is_expo_token(token) or is_fcm_token(token)


def _send_expo(app, tokens: list, title: str, body: str, data: dict | None) -> None:
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


def _fcm_ready() -> bool:
    """Firebase Admin est initialisé au démarrage quand FIREBASE_VERIFY est actif."""
    import firebase_admin

    return bool(firebase_admin._apps)


def _fcm_message(token: str, title: str, body: str, data: dict | None):
    from firebase_admin import messaging

    return messaging.Message(
        token=token,
        notification=messaging.Notification(title=title, body=body),
        # FCM n'accepte que des chaînes : l'app reconvertit les identifiants.
        data={k: str(v) for k, v in (data or {}).items() if v is not None},
        apns=messaging.APNSConfig(payload=messaging.APNSPayload(aps=messaging.Aps(sound="default"))),
        android=messaging.AndroidConfig(
            notification=messaging.AndroidNotification(channel_id="default", sound="default")
        ),
    )


def _fcm_send_each(messages: list):
    from firebase_admin import messaging

    return messaging.send_each(messages)


def _send_fcm(app, tokens: list, title: str, body: str, data: dict | None) -> None:
    if not _fcm_ready():
        logger.warning("Push FCM ignorée : Firebase Admin n'est pas initialisé")
        return
    from firebase_admin import messaging

    try:
        batch = _fcm_send_each([_fcm_message(t, title, body, data) for t in tokens])
    except Exception:
        logger.warning("Envoi push FCM impossible", exc_info=True)
        return
    for token, response in zip(tokens, batch.responses):
        # Application désinstallée, ou jeton d'un autre projet Firebase.
        if not response.success and isinstance(
            response.exception, (messaging.UnregisteredError, messaging.SenderIdMismatchError)
        ):
            app.db.delete_push_token(token)


def _send(app, tokens: list, title: str, body: str, data: dict | None) -> None:
    expo = [t for t in tokens if is_expo_token(t)]
    fcm = [t for t in tokens if not is_expo_token(t)]
    if expo:
        _send_expo(app, expo, title, body, data)
    if fcm:
        _send_fcm(app, fcm, title, body, data)


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
