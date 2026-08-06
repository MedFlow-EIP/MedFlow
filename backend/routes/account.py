import logging

from flask import Blueprint, current_app, g, jsonify

from middleware.auth import build_user_response, require_auth

logger = logging.getLogger(__name__)

account_bp = Blueprint("account", __name__)


@account_bp.route("/api/account", methods=["GET"])
@require_auth
def get_account():
    """Return complete user profile and statistics."""
    try:
        db = current_app.db
        uid = g.uid

        courses = db.fetch_courses(uid)
        session_stats = db.get_user_session_stats(uid)
        total_flashcards = sum(len(c.flashcards or []) for c in courses)

        with db.connection() as conn:
            row = conn.execute(
                "SELECT xp FROM user_stats WHERE uid=?", (uid,)
            ).fetchone()

        xp = row["xp"] if row else 0

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
            },
        })

    except Exception as e:
        logger.exception("Erreur account")
        return jsonify({"error": str(e)}), 500
