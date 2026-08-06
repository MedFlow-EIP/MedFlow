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

from flask import current_app, g, jsonify, request

logger = logging.getLogger(__name__)


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
        g.uid = uid
        g.display_name = request.headers.get("X-User-Name") or "Utilisateur"
        g.photo_url = request.headers.get("X-User-Avatar") or None
        return f(*args, **kwargs)
    return decorated


def build_user_response() -> dict:
    """Build the user metadata dict expected by the frontend/mobile."""
    return {
        "uid": g.uid,
        "displayName": g.display_name,
        "photoURL": g.photo_url,
    }
