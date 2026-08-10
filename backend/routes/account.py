import logging
import os

from flask import Blueprint, current_app, g, jsonify, request, send_from_directory

from middleware.auth import build_user_response, require_auth

logger = logging.getLogger(__name__)

account_bp = Blueprint("account", __name__)

MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024  # 5 Mo
ALLOWED_AVATAR_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}


@account_bp.route("/api/account", methods=["GET"])
@require_auth
def get_account():
    """Return complete user profile and statistics."""
    try:
        db = current_app.db
        uid = g.uid

        db.upsert_user_profile(uid, g.display_name)

        courses = db.fetch_courses(uid)
        session_stats = db.get_user_session_stats(uid)
        total_flashcards = sum(len(c.flashcards or []) for c in courses)

        with db.connection() as conn:
            row = conn.execute(
                "SELECT xp, streak FROM user_stats WHERE uid=?", (uid,)
            ).fetchone()

        xp = row["xp"] if row else 0
        streak = row["streak"] if row else 0
        rank = db.get_user_rank(uid)

        return jsonify({
            "user": build_user_response(),
            "stats": {
                "courses": len(courses),
                "flashcards": total_flashcards,
                "sessions": session_stats["total_sessions"],
                "avg_score": session_stats["avg_score"],
                "revision_sessions": session_stats["revision_sessions"],
                "flashcard_sessions": session_stats["flashcard_sessions"],
                "quiz_sessions": session_stats["quiz_sessions"],
                "xp": xp,
                "streak": streak,
                "rank": rank,
            },
        })

    except Exception as e:
        logger.exception("Erreur account")
        return jsonify({"error": str(e)}), 500


@account_bp.route("/api/leaderboard", methods=["GET"])
@require_auth
def get_leaderboard():
    """Classement des utilisateurs par XP (top 20 par défaut)."""
    try:
        db = current_app.db
        db.upsert_user_profile(g.uid, g.display_name)

        limit = request.args.get("limit", default=20, type=int)
        limit = max(1, min(limit, 100))

        entries = db.get_leaderboard(limit=limit)
        your_rank = db.get_user_rank(g.uid)

        return jsonify({
            "entries": entries,
            "yourUid": g.uid,
            "yourRank": your_rank,
        })

    except Exception as e:
        logger.exception("Erreur leaderboard")
        return jsonify({"error": str(e)}), 500


def _avatars_folder() -> str:
    folder = os.path.join(current_app.config.get("UPLOAD_FOLDER", "uploads"), "avatars")
    os.makedirs(folder, exist_ok=True)
    return folder


@account_bp.route("/api/account/avatar", methods=["POST"])
@require_auth
def upload_avatar():
    """Upload la photo de profil de l'utilisateur, stockée sur le disque
    du backend (alternative à Firebase Storage, qui exige désormais le
    plan payant Blaze). Écrase l'avatar précédent s'il existe déjà."""
    try:
        if request.content_length and request.content_length > MAX_AVATAR_SIZE_BYTES:
            return jsonify({"error": "Fichier trop volumineux (5 Mo max)"}), 413

        if "file" not in request.files:
            return jsonify({"error": "Aucun fichier fourni"}), 400

        file = request.files["file"]
        if not file or file.filename == "":
            return jsonify({"error": "Nom de fichier vide"}), 400

        ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
        if ext not in ALLOWED_AVATAR_EXTENSIONS:
            return jsonify({
                "error": "Format non supporté (jpg, jpeg, png, webp uniquement)"
            }), 400

        # Un seul avatar par utilisateur : nom de fichier basé sur l'uid,
        # écrase automatiquement l'ancien à chaque nouvel upload.
        filename = f"{g.uid}.{ext}"
        filepath = os.path.join(_avatars_folder(), filename)
        file.save(filepath)

        # Supprime les anciens fichiers avec une autre extension pour cet
        # utilisateur (ex: il avait un .png, il upload un .jpg cette fois).
        for other_ext in ALLOWED_AVATAR_EXTENSIONS - {ext}:
            stale_path = os.path.join(_avatars_folder(), f"{g.uid}.{other_ext}")
            if os.path.exists(stale_path):
                os.remove(stale_path)

        avatar_url = f"{request.host_url.rstrip('/')}/avatars/{filename}"
        return jsonify({"avatarUrl": avatar_url})

    except Exception as e:
        logger.exception("Erreur upload avatar")
        return jsonify({"error": str(e)}), 500


@account_bp.route("/avatars/<path:filename>", methods=["GET"])
def serve_avatar(filename):
    """Sert les avatars uploadés. Volontairement public (pas de @require_auth) :
    une photo de profil doit être visible par les autres utilisateurs (dans
    le classement, les headers de leçon...), comme n'importe quelle URL de
    CDN classique — c'est le même niveau d'accès qu'avait Firebase Storage
    avec un token de téléchargement dans l'URL."""
    return send_from_directory(_avatars_folder(), filename)


@account_bp.route("/api/badges", methods=["GET"])
@require_auth
def get_badges():
    """Catalogue complet des badges, avec l'état débloqué/verrouillé
    pour l'utilisateur courant."""
    try:
        badges = current_app.db.get_user_badges(g.uid)
        return jsonify({"badges": badges})
    except Exception as e:
        logger.exception("Erreur badges")
        return jsonify({"error": str(e)}), 500


@account_bp.route("/api/activity", methods=["GET"])
@require_auth
def get_activity():
    """Journal d'activité récente de l'utilisateur (leçons complétées,
    badges débloqués...)."""
    try:
        limit = request.args.get("limit", default=20, type=int)
        limit = max(1, min(limit, 100))
        activity = current_app.db.get_recent_activity(g.uid, limit=limit)
        return jsonify({"activity": activity})
    except Exception as e:
        logger.exception("Erreur activity")
        return jsonify({"error": str(e)}), 500