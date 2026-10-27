"""Authentication middleware for MEDFLOW Flask backend.

Two operating modes controlled by ``app.config["FIREBASE_VERIFY"]``:

Production (FIREBASE_VERIFY=True):
  Reads ``Authorization: Bearer <firebase_id_token>`` and verifies it with
  the Firebase Admin SDK.  The decoded UID is stored in ``flask.g.uid``.

Development / Testing (FIREBASE_VERIFY=False):
  Falls back to the legacy behaviour: reads the raw ``X-User-UID`` header
  (or ``uid`` in the JSON body / form data / query string).  This keeps
  full backward-compatibility with the existing frontend and mobile apps
  during local development without requiring real Firebase tokens.
"""
from functools import wraps

import logging
import re

from flask import current_app, g, jsonify, request

logger = logging.getLogger(__name__)

# Forme d'un uid Firebase (lettres, chiffres, - et _).
_UID_PATTERN = re.compile(r"[A-Za-z0-9_-]{1,128}")


# ---------------------------------------------------------------------------
# UID extraction helpers
# ---------------------------------------------------------------------------

def _extract_uid_legacy(data=None) -> str | None:
    """Extract raw UID the old way (header → body → form → query)."""
    uid = request.headers.get("X-User-UID")
    if not uid and data:
        uid = data.get("uid")
    if not uid and request.form:
        uid = request.form.get("uid")
    if not uid:
        uid = request.args.get("uid")
    return uid or None


def _extract_verified_uid(data=None) -> str | None:
    """Return a verified UID, method depends on FIREBASE_VERIFY config flag."""
    if current_app.config.get("FIREBASE_VERIFY", True):
        return _verify_firebase_token()
    return _extract_uid_legacy(data)


def _verify_firebase_token() -> str | None:
    """Verify a Firebase ID token from the Authorization header."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        logger.debug("No Bearer token found in Authorization header")
        return None
    token = auth_header[len("Bearer "):]
    try:
        import firebase_admin.auth as fb_auth
        decoded = fb_auth.verify_id_token(token)
        # Email certifié par Firebase : seule source fiable pour la recherche
        # d'amis par email (un header pourrait être falsifié).
        g.token_email = decoded.get("email")
        # Nom du profil Firebase : fait foi, l'en-tête X-User-Name pourrait être falsifié.
        g.token_name = decoded.get("name")
        g.email_verified = bool(decoded.get("email_verified"))
        # Date de la dernière vraie connexion (pas du rafraîchissement du token) :
        # sert à exiger une reconnexion récente avant de supprimer le compte.
        g.auth_time = decoded.get("auth_time")
        return decoded.get("uid")
    except Exception as e:
        logger.warning("Firebase token verification failed: %s", e)
        return None


# ---------------------------------------------------------------------------
# Decorator
# ---------------------------------------------------------------------------

def require_auth(f):
    """Route decorator that extracts and validates the caller's UID.

    On success, sets:
      - ``g.uid``           — Firebase UID string
      - ``g.display_name``  — from X-User-Name header (default: "Utilisateur")
      - ``g.photo_url``     — from X-User-Avatar header (or None)

    On failure, returns HTTP 400 with ``{"error": "UID Firebase requis"}``.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        data = None
        if request.is_json:
            data = request.get_json(silent=True)
        uid = _extract_verified_uid(data)
        if not uid:
            return jsonify({"error": "UID Firebase requis"}), 400
        # L'uid sert à construire des chemins (avatar, dossier d'upload) : on
        # refuse tout ce qui n'a pas la forme d'un uid Firebase (ex. « ../ »).
        if not _UID_PATTERN.fullmatch(uid):
            return jsonify({"error": "UID invalide"}), 400
        g.uid = uid
        g.display_name = _display_name()
        g.photo_url = request.headers.get("X-User-Avatar") or None
        _register_user(uid)
        return f(*args, **kwargs)
    return decorated


_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")
MAX_DISPLAY_NAME = 60


def _display_name() -> str:
    """Nom affiché aux autres (classement, amis, notifications).

    En production, celui du token Firebase vérifié ; à défaut (ancien token
    sans nom), l'en-tête de l'app, nettoyé et tronqué."""
    name = getattr(g, "token_name", None) or request.headers.get("X-User-Name") or ""
    name = _CONTROL_CHARS.sub("", name).strip()[:MAX_DISPLAY_NAME]
    return name or "Utilisateur"


def _register_user(uid: str) -> None:
    """Inscrit l'utilisateur dans user_stats dès sa première requête
    authentifiée, pour qu'il apparaisse au classement et dans la recherche
    d'amis même s'il n'a encore ouvert ni Compte ni Amis. Ne doit jamais
    faire échouer la requête."""
    display_name = g.display_name if g.display_name != "Utilisateur" else None
    if current_app.config.get("FIREBASE_VERIFY", True):
        email = getattr(g, "token_email", None)
    else:
        # Mode dev : pas de token vérifié, on accepte le header du client.
        email = request.headers.get("X-User-Email") or None
    profile = (display_name, email.lower() if email else None)
    # Dernier (nom, email) écrit par UID, rattaché à l'app (et donc à sa
    # base) : on n'écrit en base que lorsque quelque chose change.
    registered = current_app.extensions.setdefault("registered_profiles", {})
    if registered.get(uid) == profile:
        return
    try:
        current_app.db.register_user(uid, profile[0], profile[1])
        registered[uid] = profile
    except Exception:
        logger.exception("Enregistrement du profil impossible pour %s", uid)


def build_user_response() -> dict:
    """Build the user metadata dict expected by the frontend/mobile."""
    return {
        "uid": g.uid,
        "displayName": g.display_name,
        "photoURL": g.photo_url,
    }
