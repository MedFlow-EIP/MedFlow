import logging
import random

from flask import Blueprint, current_app, g, jsonify, request

from middleware.auth import require_auth

logger = logging.getLogger(__name__)

sessions_bp = Blueprint("sessions", __name__)


@sessions_bp.route("/api/revision", methods=["POST"])
@require_auth
def start_revision():
    """Start a revision session (all courses or a single course)."""
    try:
        data = request.get_json(silent=True) or {}
        db = current_app.db
        uid = g.uid

        mode = data.get("mode", "all")
        course_id = data.get("course_id")

        if mode == "course" and course_id:
            course = db.fetch_course(uid, course_id)
            if not course:
                return jsonify({"error": "Cours introuvable"}), 404
            cours = [course]
        else:
            cours = db.fetch_courses(uid)

        if not cours:
            return jsonify({"error": "Aucun cours disponible pour révision"}), 400

        flashcards = []
        quiz = []
        for c in cours:
            flashcards.extend(c.flashcards or [])
            quiz.extend(c.quiz or [])

        random.shuffle(flashcards)
        random.shuffle(quiz)

        session = {
            "flashcards": flashcards[:10],
            "quiz": quiz[:10] if mode == "course" else quiz,
            "mode": mode,
        }
        if mode == "course":
            session["course_id"] = course_id

        return jsonify(session)

    except Exception as e:
        logger.exception("Erreur révision")
        return jsonify({"error": f"Erreur révision: {str(e)}"}), 500


@sessions_bp.route("/api/session-done", methods=["POST"])
@require_auth
def session_done():
    """Record completion of a study session."""
    try:
        data = request.get_json(silent=True) or {}
        db = current_app.db
        uid = g.uid

        mode = data.get("mode", "all")
        course_id = data.get("course_id")
        session_type = data.get("session_type", "revision")
        score = data.get("score")
        total_questions = data.get("total_questions")

        try:
            score_value = int(score) if score is not None else None
        except (TypeError, ValueError):
            score_value = None

        try:
            total_questions_value = int(total_questions) if total_questions is not None else None
        except (TypeError, ValueError):
            total_questions_value = None

        if mode == "course":
            if not course_id:
                return jsonify({"error": "Identifiant du cours requis pour ce mode"}), 400
            if not db.fetch_course(uid, course_id):
                return jsonify({"error": "Cours introuvable"}), 404
            db.increment_sessions(uid, course_id=course_id)
            db.create_session_record(uid, course_id, session_type, score_value, total_questions_value)
        else:
            db.create_session_record(uid, None, session_type, score_value, total_questions_value)

        return jsonify({"status": "ok"})

    except Exception as e:
        logger.exception("Erreur session")
        return jsonify({"error": f"Erreur session: {str(e)}"}), 500
