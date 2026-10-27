"""Quotas d'appels IA par utilisateur, pour borner la facture Vertex AI."""
import logging

from flask import current_app, g, jsonify

logger = logging.getLogger(__name__)

_MESSAGES = {
    "chat": "Tu as atteint la limite de messages à l'assistant. Réessaie un peu plus tard.",
    "process": "Tu as atteint la limite d'imports de cours. Réessaie un peu plus tard.",
    "case": "Tu as atteint la limite de cas cliniques. Réessaie un peu plus tard.",
}
_GLOBAL_MESSAGE = "L'IA est très sollicitée en ce moment. Réessaie plus tard."


def _limits(kind: str, config) -> list:
    if kind == "chat":
        return [(60, config["AI_CHAT_PER_MINUTE"]), (86400, config["AI_CHAT_PER_DAY"])]
    if kind == "case":
        return [(3600, config["AI_CASE_PER_HOUR"]), (86400, config["AI_CASE_PER_DAY"])]
    return [(3600, config["AI_PROCESS_PER_HOUR"]), (86400, config["AI_PROCESS_PER_DAY"])]


def consume_ai_quota(kind: str):
    """Réserve un appel IA pour ``g.uid``. Renvoie None si autorisé,
    sinon la réponse 429 à renvoyer telle quelle."""
    config = current_app.config
    # En production, l'IA est réservée aux emails vérifiés : créer des comptes
    # jetables en masse pour multiplier les quotas devient bien plus pénible.
    # (Les comptes Google sont vérifiés d'office.)
    if config.get("FIREBASE_VERIFY", True) and not getattr(g, "email_verified", False):
        return jsonify({
            "error": "Vérifie ton adresse email pour utiliser l'IA (lien envoyé à l'inscription).",
            "code": "email_not_verified",
        }), 403

    blocked = current_app.db.consume_ai_quota(
        g.uid, kind, _limits(kind, config), config["AI_GLOBAL_PER_DAY"]
    )
    if blocked is None:
        return None
    if blocked == "global":
        logger.warning("Plafond IA global atteint (%s)", kind)
        message = _GLOBAL_MESSAGE
    else:
        logger.info("Quota IA atteint uid=%s kind=%s", g.uid, kind)
        message = _MESSAGES[kind]
    return jsonify({"error": message, "code": "quota_exceeded"}), 429
