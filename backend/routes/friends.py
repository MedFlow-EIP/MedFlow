import logging

from flask import Blueprint, current_app, g, jsonify, request

from middleware.auth import require_auth

logger = logging.getLogger(__name__)

friends_bp = Blueprint("friends", __name__)


@friends_bp.route("/api/users/search", methods=["GET"])
@require_auth
def search_users():
    """Recherche des utilisateurs par nom, pour les ajouter en ami."""
    try:
        db = current_app.db
        db.upsert_user_profile(g.uid, g.display_name)

        query = request.args.get("q", default="", type=str)
        results = db.search_users(query, exclude_uid=g.uid)
        return jsonify({"results": results})
    except Exception as e:
        logger.exception("Erreur recherche utilisateurs")
        return jsonify({"error": str(e)}), 500


@friends_bp.route("/api/friends", methods=["GET"])
@require_auth
def get_friends():
    """Liste des amis confirmés."""
    try:
        friends = current_app.db.get_friends(g.uid)
        return jsonify({"friends": friends})
    except Exception as e:
        logger.exception("Erreur liste amis")
        return jsonify({"error": str(e)}), 500


@friends_bp.route("/api/friends/requests", methods=["GET"])
@require_auth
def get_friend_requests():
    """Demandes reçues (à traiter) et envoyées (en attente)."""
    try:
        requests_data = current_app.db.get_pending_requests(g.uid)
        return jsonify(requests_data)
    except Exception as e:
        logger.exception("Erreur demandes amis")
        return jsonify({"error": str(e)}), 500


@friends_bp.route("/api/friends/request", methods=["POST"])
@require_auth
def send_friend_request():
    """Envoie une demande d'ami à l'uid fourni dans le body."""
    try:
        data = request.get_json(silent=True) or {}
        target_uid = data.get("uid")
        if not target_uid:
            return jsonify({"error": "uid requis"}), 400

        status = current_app.db.send_friend_request(g.uid, target_uid)
        return jsonify({"status": status})
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.exception("Erreur envoi demande ami")
        return jsonify({"error": str(e)}), 500


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
        return jsonify({"error": str(e)}), 500


@friends_bp.route("/api/friends/<friend_uid>", methods=["DELETE"])
@require_auth
def remove_friend(friend_uid):
    """Retire un ami (ou annule/refuse une demande liée à cet uid)."""
    try:
        current_app.db.remove_friend(g.uid, friend_uid)
        return jsonify({"success": True})
    except Exception as e:
        logger.exception("Erreur suppression ami")
        return jsonify({"error": str(e)}), 500


@friends_bp.route("/api/friends/leaderboard", methods=["GET"])
@require_auth
def get_friends_leaderboard():
    """Classement XP limité à soi + ses amis confirmés."""
    try:
        entries = current_app.db.get_friends_leaderboard(g.uid)
        return jsonify({"entries": entries, "yourUid": g.uid})
    except Exception as e:
        logger.exception("Erreur classement amis")
        return jsonify({"error": str(e)}), 500