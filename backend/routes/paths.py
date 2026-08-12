import logging

from flask import Blueprint, current_app, g, jsonify

from middleware.auth import require_auth

logger = logging.getLogger(__name__)

paths_bp = Blueprint("paths", __name__)


@paths_bp.route("/api/paths", methods=["GET"])
@require_auth
def get_paths():
    """Return learning paths with progress for the authenticated user."""
    db = current_app.db
    uid = g.uid
    db.ensure_user_lessons(uid)
    paths = db.fetch_user_paths(uid)

    paths_response = [
        {
            "id": p["id"],
            "title": p["title"],
            "description": p["description"],
            "progress": p.get("progress", 0),
            "totalLessons": p["totalLessons"],
            "completedLessons": p["completedLessons"],
            "isLocked": p["isLocked"],
            "color": p["color"],
            "emoji": p["emoji"],
        }
        for p in paths
    ]
    return jsonify({"paths": paths_response})


@paths_bp.route("/api/lessons/<path_id>", methods=["GET"])
@require_auth
def get_lessons(path_id):
    """Return all lessons for a given path for the authenticated user."""
    db = current_app.db
    uid = g.uid
    lessons = db.fetch_path_lessons(uid, path_id)

    lessons_response = [
        {
            "id": l["id"],
            "title": l["title"],
            "type": l["type"],
            "status": l["status"],
            "stars": l["stars"],
            "position": l["position"],
            "xp": l["xp"],
        }
        for l in lessons
    ]
    return jsonify({"lessons": lessons_response})


@paths_bp.route("/api/lessons/<path_id>/<lesson_id>/start", methods=["POST"])
@require_auth
def start_lesson(path_id, lesson_id):
    """Journalise le début d'une leçon — signal purement analytique, pour
    calculer le taux d'abandon (commencées vs terminées) dans le cadre du
    diagnostic de frictions (objectif 2 du track EIP)."""
    current_app.db.log_analytics_event(
        g.uid, "lesson_started", path_id=path_id, lesson_id=lesson_id
    )
    return jsonify({"success": True})


@paths_bp.route("/api/lessons/<path_id>/<lesson_id>/complete", methods=["POST"])
@require_auth
def complete_lesson(path_id, lesson_id):
    """Mark a lesson as completed and unlock the next one."""
    current_app.db.upsert_user_profile(g.uid, g.display_name)
    new_badges = current_app.db.complete_lesson(g.uid, lesson_id)
    return jsonify({"success": True, "newBadges": new_badges})