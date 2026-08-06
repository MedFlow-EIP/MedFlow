import logging

from flask import Blueprint, current_app, jsonify, request

from middleware.auth import _extract_uid_legacy

logger = logging.getLogger(__name__)

health_bp = Blueprint("health", __name__)


@health_bp.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint — no authentication required."""
    db_status = "ok"
    try:
        current_app.db.total_courses()
    except Exception as e:
        db_status = f"error: {e}"

    return jsonify({
        "status": "ok",
        "db": db_status,
        "version": current_app.config.get("VERSION", "2.0.0"),
    })


@health_bp.route("/api/debug/headers", methods=["GET", "POST"])
def debug_headers():
    uid = _extract_uid_legacy()
    return jsonify({
        "uid": uid,
        "headers": {
            "X-User-UID": request.headers.get("X-User-UID"),
            "X-User-Name": request.headers.get("X-User-Name"),
            "X-User-Avatar": request.headers.get("X-User-Avatar"),
        },
        "form_data": dict(request.form) if request.form else None,
        "json_data": request.get_json(silent=True) if request.is_json else None,
        "args": dict(request.args) if request.args else None,
    })


@health_bp.route("/api/debug/db-status", methods=["GET"])
def debug_db_status():
    try:
        return jsonify({
            "total_courses": current_app.db.total_courses(),
            "total_sessions": current_app.db.total_sessions(),
            "recent_courses": current_app.db.recent_courses(),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@health_bp.route("/api/debug/test-with-sample", methods=["GET"])
def test_with_sample():
    sample_uid = "sample-user-12345"
    try:
        cours_data = current_app.db.fetch_courses(sample_uid)
        stats = {
            "cours": len(cours_data),
            "flashcards": sum(len(c.flashcards or []) for c in cours_data),
            "sessions": sum(c.sessions or 0 for c in cours_data),
        }
        return jsonify({
            "message": "Test with sample data",
            "sample_uid": sample_uid,
            "courses": [{"nom": c.nom, "id": c.id} for c in cours_data],
            "stats": stats,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
