import logging

from flask import Blueprint, current_app, g, jsonify, request

from middleware.auth import require_auth
from routes.errors import internal_error
from services.push import notify_user

logger = logging.getLogger(__name__)

friends_bp = Blueprint("friends", __name__)


@friends_bp.route("/api/users/search", methods=["GET"])
@require_auth
def search_users():
    """Recherche des utilisateurs par nom, pour les ajouter en ami."""
    try:
        db = current_app.db
        db.upsert_user_profile(g.uid, g.display_name)

        query = request.args.get("q", default="", type=str).strip()
        if len(query) < 2:
            return jsonify({"results": []})
        if db.hit_rate_limit(g.uid, "search", 60, current_app.config.get("SEARCH_PER_MINUTE", 30)):
            return jsonify({"error": "Trop de recherches. Réessaie dans une minute."}), 429
        results = db.search_users(query[:100], exclude_uid=g.uid)
        return jsonify({"results": results})
    except Exception as e:
        logger.exception("Erreur recherche utilisateurs")
        return internal_error("Erreur interne")


@friends_bp.route("/api/friends", methods=["GET"])
@require_auth
def get_friends():
    """Liste des amis confirmés."""
    try:
        friends = current_app.db.get_friends(g.uid)
        return jsonify({"friends": friends})
    except Exception as e:
        logger.exception("Erreur liste amis")
        return internal_error("Erreur interne")


@friends_bp.route("/api/friends/requests", methods=["GET"])
@require_auth
def get_friend_requests():
    """Demandes reçues (à traiter) et envoyées (en attente)."""
    try:
        requests_data = current_app.db.get_pending_requests(g.uid)
        return jsonify(requests_data)
    except Exception as e:
        logger.exception("Erreur demandes amis")
        return internal_error("Erreur interne")


@friends_bp.route("/api/friends/request", methods=["POST"])
@require_auth
def send_friend_request():
    """Envoie une demande d'ami à l'uid fourni dans le body."""
    try:
        data = request.get_json(silent=True) or {}
        target_uid = data.get("uid")
        if not target_uid:
            return jsonify({"error": "uid requis"}), 400

        limit = current_app.config.get("FRIEND_REQUESTS_PER_DAY", 50)
        if current_app.db.hit_rate_limit(g.uid, "friend_request", 86400, limit):
            return jsonify({"error": "Trop de demandes d'ami aujourd'hui. Réessaie demain."}), 429
        status = current_app.db.send_friend_request(g.uid, target_uid)
        app = current_app._get_current_object()
        if status == "pending":
            notify_user(app, target_uid, "👋 Nouvelle demande d’ami", f"{g.display_name} veut t’ajouter en ami.",
                        {"screen": "Friends"})
        elif status == "accepted":
            notify_user(app, target_uid, "🤝 Vous êtes amis", f"{g.display_name} a accepté ta demande.",
                        {"screen": "Friends"})
        return jsonify({"status": status})
    except ValueError:
        # Seul cas : s'ajouter soi-même.
        return jsonify({"error": "Impossible de s'ajouter soi-même"}), 400
    except Exception as e:
        logger.exception("Erreur envoi demande ami")
        return internal_error("Erreur interne")


@friends_bp.route("/api/friends/respond", methods=["POST"])
@require_auth
def respond_friend_request():
    """Accepte ou refuse une demande reçue. Body: {uid, accept: bool}."""
    try:
        data = request.get_json(silent=True) or {}
        requester_uid = data.get("uid")
        accept = bool(data.get("accept"))
        if not requester_uid:
            return jsonify({"error": "uid requis"}), 400

        current_app.db.respond_to_friend_request(g.uid, requester_uid, accept)
        return jsonify({"success": True})
    except Exception as e:
        logger.exception("Erreur réponse demande ami")
        return internal_error("Erreur interne")


@friends_bp.route("/api/friends/<friend_uid>", methods=["DELETE"])
@require_auth
def remove_friend(friend_uid):
    """Retire un ami (ou annule/refuse une demande liée à cet uid)."""
    try:
        current_app.db.remove_friend(g.uid, friend_uid)
        return jsonify({"success": True})
    except Exception as e:
        logger.exception("Erreur suppression ami")
        return internal_error("Erreur interne")


@friends_bp.route("/api/friends/leaderboard", methods=["GET"])
@require_auth
def get_friends_leaderboard():
    """Classement XP limité à soi + ses amis confirmés."""
    try:
        entries = current_app.db.get_friends_leaderboard(g.uid)
        return jsonify({"entries": entries, "yourUid": g.uid})
    except Exception as e:
        logger.exception("Erreur classement amis")
        return internal_error("Erreur interne")