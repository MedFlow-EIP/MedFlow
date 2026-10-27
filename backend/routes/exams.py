import logging
from datetime import date, timedelta

from flask import Blueprint, current_app, g, jsonify, request

from middleware.auth import require_auth
from routes.errors import internal_error
from user_clock import user_today

logger = logging.getLogger(__name__)

exams_bp = Blueprint("exams", __name__)

MAX_TITLE_CHARS = 80
MAX_COURSES_PER_EXAM = 30
# Au-delà, c'est presque sûrement une erreur de saisie.
MAX_DAYS_AHEAD = 2 * 365


@exams_bp.route("/api/exams", methods=["GET"])
@require_auth
def list_exams():
    """Examens de l'utilisateur, du plus proche au plus lointain (passés compris)."""
    try:
        return jsonify({"exams": current_app.db.fetch_exams(g.uid)})
    except Exception:
        logger.exception("Erreur liste examens")
        return internal_error("Erreur examens")


@exams_bp.route("/api/exams", methods=["POST"])
@require_auth
def create_exam():
    """Ajoute un examen : titre, date (AAAA-MM-JJ) et cours à réviser en priorité."""
    try:
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify({"error": "Body JSON invalide"}), 400

        title = str(body.get("title") or "").strip()
        if not title:
            return jsonify({"error": "Donne un nom à l'examen"}), 400
        if len(title) > MAX_TITLE_CHARS:
            return jsonify({"error": f"Nom trop long ({MAX_TITLE_CHARS} caractères maximum)"}), 400

        try:
            exam_date = date.fromisoformat(str(body.get("exam_date") or ""))
        except ValueError:
            return jsonify({"error": "Date invalide"}), 400
        today = user_today()
        if exam_date < today:
            return jsonify({"error": "La date de l'examen est déjà passée"}), 400
        if exam_date > today + timedelta(days=MAX_DAYS_AHEAD):
            return jsonify({"error": "Date trop lointaine"}), 400

        course_ids = body.get("course_ids") or []
        if not isinstance(course_ids, list) or len(course_ids) > MAX_COURSES_PER_EXAM:
            return jsonify({"error": "Liste de cours invalide"}), 400
        db = current_app.db
        owned = {c.id for c in db.fetch_courses(g.uid)}
        course_ids = list(dict.fromkeys(str(cid) for cid in course_ids))
        if any(cid not in owned for cid in course_ids):
            return jsonify({"error": "Cours introuvable"}), 404

        if db.count_exams(g.uid) >= db.MAX_EXAMS:
            return jsonify({"error": f"{db.MAX_EXAMS} examens maximum"}), 400

        exam_id = db.create_exam(g.uid, title, exam_date.isoformat(), course_ids)
        exam = next(e for e in db.fetch_exams(g.uid) if e["id"] == exam_id)
        return jsonify(exam), 201
    except Exception:
        logger.exception("Erreur création examen")
        return internal_error("Erreur examens")


@exams_bp.route("/api/exams/<int:exam_id>", methods=["DELETE"])
@require_auth
def delete_exam(exam_id):
    try:
        if not current_app.db.delete_exam(g.uid, exam_id):
            return jsonify({"error": "Examen introuvable"}), 404
        return jsonify({"success": True})
    except Exception:
        logger.exception("Erreur suppression examen")
        return internal_error("Erreur examens")
