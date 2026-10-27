import logging
import os
import shutil
import time

from flask import Blueprint, current_app, g, jsonify, request, send_from_directory

from middleware.auth import build_user_response, require_auth
from routes.errors import internal_error

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
                "SELECT xp, streak, last_activity, streak_freezes FROM user_stats WHERE uid=?", (uid,)
            ).fetchone()

        xp = row["xp"] if row else 0
        last_activity = row["last_activity"] if row else None
        streak_freezes = row["streak_freezes"] if row else 0
        # Série perdue (trop de jours manqués) : affichée à 0 sans attendre la prochaine leçon.
        streak = db.displayed_streak(row["streak"] if row else 0, last_activity, streak_freezes)
        rank = db.get_user_rank(uid)
        league = db.get_league_for_xp(xp)
        weekly = db.get_weekly_progress(uid)

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
                "streakFreezes": streak_freezes,
                "maxStreakFreezes": db.MAX_STREAK_FREEZES,
                "lastActivity": last_activity,
                "rank": rank,
                "league": league,
                "weeklyGoal": weekly["weeklyGoal"],
                "weeklyProgress": weekly["weeklyProgress"],
            },
        })

    except Exception as e:
        logger.exception("Erreur account")
        return internal_error("Erreur interne")


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
        return internal_error("Erreur interne")


def _looks_like_image(head: bytes) -> bool:
    """Signature JPEG, PNG ou WebP."""
    return (
        head.startswith(b"\xff\xd8\xff")
        or head.startswith(b"\x89PNG\r\n\x1a\n")
        or (head[:4] == b"RIFF" and head[8:12] == b"WEBP")
    )


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

        # Le contenu doit être une vraie image (pas seulement l'extension) :
        # sinon n'importe quel fichier pourrait être hébergé sous /avatars.
        head = file.stream.read(16)
        file.stream.seek(0)
        if not _looks_like_image(head):
            return jsonify({"error": "Ce fichier n'est pas une image valide"}), 400

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
        current_app.db.set_avatar_url(g.uid, avatar_url)
        return jsonify({"avatarUrl": avatar_url})

    except Exception as e:
        logger.exception("Erreur upload avatar")
        return internal_error("Erreur interne")


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
        return internal_error("Erreur interne")


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
        return internal_error("Erreur interne")


@account_bp.route("/api/account/reset-progress", methods=["POST"])
@require_auth
def reset_progress():
    """Outil de debug/test : remet à zéro XP, streak, leçons, badges et
    activité de l'utilisateur courant. N'affecte que son propre compte."""
    try:
        current_app.db.reset_user_progress(g.uid)
        return jsonify({"success": True})
    except Exception as e:
        logger.exception("Erreur reset progress")
        return internal_error("Erreur interne")


# Délai maximal depuis la dernière connexion pour supprimer son compte :
# un token volé ou un téléphone déverrouillé ne suffit pas.
RECENT_LOGIN_SECONDS = 5 * 60


def _delete_firebase_user(uid: str) -> None:
    """Supprime le compte Firebase (sans effet si Firebase Admin n'est pas
    initialisé, c.-à-d. en dev/test)."""
    import firebase_admin
    if not firebase_admin._apps:
        return
    from firebase_admin import auth as fb_auth
    try:
        fb_auth.delete_user(uid)
    except fb_auth.UserNotFoundError:
        pass


def _delete_user_files(uid: str) -> None:
    upload_folder = current_app.config.get("UPLOAD_FOLDER", "uploads")
    for ext in ALLOWED_AVATAR_EXTENSIONS:
        path = os.path.join(upload_folder, "avatars", f"{uid}.{ext}")
        if os.path.exists(path):
            os.remove(path)
    user_folder = os.path.join(upload_folder, uid)
    if os.path.isdir(user_folder):
        shutil.rmtree(user_folder, ignore_errors=True)


@account_bp.route("/api/account", methods=["DELETE"])
@require_auth
def delete_account():
    """Supprime définitivement le compte : Firebase, données en base et fichiers.
    Exige une connexion récente (le mobile redemande le mot de passe ou Google)."""
    if current_app.config.get("FIREBASE_VERIFY", True):
        auth_time = getattr(g, "auth_time", None)
        if not auth_time or time.time() - auth_time > RECENT_LOGIN_SECONDS:
            return jsonify({
                "error": "Reconnecte-toi avant de supprimer ton compte.",
                "code": "requires_recent_login",
            }), 401

    try:
        # Firebase d'abord : si ça échoue, les données restent intactes et
        # l'utilisateur peut réessayer.
        _delete_firebase_user(g.uid)
        current_app.db.delete_user_data(g.uid)
        _delete_user_files(g.uid)
        current_app.extensions.get("registered_profiles", {}).pop(g.uid, None)
        logger.info("Compte supprimé uid=%s", g.uid)
        return jsonify({"success": True})
    except Exception:
        logger.exception("Erreur suppression compte")
        return internal_error("Erreur interne")


@account_bp.route("/api/push-token", methods=["POST", "DELETE"])
@require_auth
def push_token():
    """Enregistre (POST) ou oublie (DELETE, à la déconnexion) le jeton push de l'appareil."""
    from services.push import is_valid_token

    token = (request.get_json(silent=True) or {}).get("token")
    if not is_valid_token(token):
        return jsonify({"error": "Jeton invalide"}), 400
    if request.method == "POST":
        current_app.db.save_push_token(g.uid, token)
    else:
        current_app.db.delete_push_token(token, uid=g.uid)
    return jsonify({"success": True})


@account_bp.route("/api/account/export", methods=["GET"])
@require_auth
def export_account():
    """Export RGPD : toutes les données du compte, en JSON."""
    try:
        return jsonify({
            "exported_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "account": {"uid": g.uid, "email": getattr(g, "token_email", None), "display_name": g.display_name},
            "data": current_app.db.export_user_data(g.uid),
        })
    except Exception:
        logger.exception("Erreur export des données")
        return internal_error("Erreur export")


@account_bp.route("/api/analytics/screen-view", methods=["POST"])
@require_auth
def log_screen_view():
    """Journalise qu'un écran a été vu — signal purement analytique pour
    repérer les écrans où les utilisateurs arrivent sans jamais agir
    derrière (ex: UploadCourseScreen sans upload, AIChatScreen sans
    message envoyé). Body: {"screen": "UploadCourseScreen"}."""
    try:
        data = request.get_json(silent=True) or {}
        screen = data.get("screen")
        if not screen:
            return jsonify({"error": "screen requis"}), 400

        current_app.db.log_analytics_event(g.uid, "screen_view", screen=screen)
        return jsonify({"success": True})
    except Exception as e:
        logger.exception("Erreur screen-view")
        return internal_error("Erreur interne")