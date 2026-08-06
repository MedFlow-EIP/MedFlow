import logging
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict

from flask import Blueprint, current_app, g, jsonify, request
from werkzeug.utils import secure_filename

from middleware.auth import build_user_response, require_auth
from services.pdf import extract_text_from_pdf

logger = logging.getLogger(__name__)

courses_bp = Blueprint("courses", __name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _course_to_response(course) -> dict:
    data = asdict(course)
    data["flashcards"] = course.flashcards
    data["quiz"] = course.quiz
    data["summary"] = course.summary
    return data


def _ensure_user_folder(upload_folder: str, uid: str) -> str:
    user_folder = os.path.join(upload_folder, uid)
    os.makedirs(user_folder, exist_ok=True)
    return user_folder


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@courses_bp.route("/api/dashboard", methods=["GET"])
@require_auth
def get_dashboard():
    """Return user courses and statistics.

    Supports optional pagination via ``?page=1&per_page=20``.
    """
    try:
        db = current_app.db
        uid = g.uid

        # Pagination parameters
        try:
            page = max(1, int(request.args.get("page", 1)))
            per_page = max(1, min(100, int(request.args.get("per_page", 20))))
        except (TypeError, ValueError):
            page, per_page = 1, 20

        all_courses = db.fetch_courses(uid)
        total = len(all_courses)

        # Slice for the requested page
        start = (page - 1) * per_page
        paginated = all_courses[start: start + per_page]

        cours = [
            {"nom": c.nom or "Sans nom", "id": c.id, "sessions": c.sessions or 0}
            for c in paginated
        ]

        total_flashcards = sum(len(c.flashcards or []) for c in all_courses)
        session_stats = db.get_user_session_stats(uid)

        stats = {
            "cours": total,
            "flashcards": total_flashcards,
            "sessions": session_stats.get("total_sessions", 0),
            "detailed_sessions": session_stats,
        }

        return jsonify({
            "user": build_user_response(),
            "cours": cours,
            "stats": stats,
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "pages": max(1, -(-total // per_page)),  # ceiling division
            },
        })

    except Exception as e:
        logger.exception("Erreur dashboard")
        return jsonify({"error": f"Erreur dashboard: {str(e)}"}), 500


@courses_bp.route("/api/course/<course_id>", methods=["GET"])
@require_auth
def get_course(course_id):
    """Return the full content of a single course."""
    try:
        course = current_app.db.fetch_course(g.uid, course_id)
        if not course:
            return jsonify({"error": "Cours introuvable"}), 404
        return jsonify(_course_to_response(course))
    except Exception as e:
        logger.exception("Erreur lecture cours")
        return jsonify({"error": f"Erreur lecture cours: {str(e)}"}), 500


@courses_bp.route("/api/course/<course_id>", methods=["DELETE"])
@require_auth
def delete_course(course_id):
    """Delete a course belonging to the authenticated user."""
    try:
        db = current_app.db
        course = db.fetch_course(g.uid, course_id)
        if not course:
            return jsonify({"error": "Cours introuvable"}), 404
        db.delete_course(g.uid, course_id)
        return jsonify({"success": True})
    except Exception as e:
        logger.exception("Erreur suppression cours")
        return jsonify({"error": f"Erreur suppression: {str(e)}"}), 500


@courses_bp.route("/api/process", methods=["POST"])
@require_auth
def process_document():
    """Upload a PDF and generate flashcards, summary, quiz and title in parallel."""
    logger.info("Starting document processing for uid=%s", g.uid)

    if "file" not in request.files:
        return jsonify({"error": "Aucun fichier fourni"}), 400

    file = request.files["file"]
    if not file or file.filename == "":
        return jsonify({"error": "Nom de fichier vide"}), 400

    filename = secure_filename(file.filename)
    if not filename.lower().endswith(".pdf"):
        return jsonify({"error": "Format non supporté, PDF uniquement"}), 400

    try:
        upload_folder = current_app.config.get("UPLOAD_FOLDER", "uploads")
        user_folder = _ensure_user_folder(upload_folder, g.uid)
        filepath = os.path.join(user_folder, filename)
        file.save(filepath)
        logger.info("File saved to: %s", filepath)

        with open(filepath, "rb") as f:
            pdf_content = f.read()

        text = extract_text_from_pdf(pdf_content)

        if not text or len(text.strip()) < 10:
            return jsonify({"error": "PDF vide ou illisible"}), 400

        logger.info("Extracted text length: %d", len(text))

        # Run all 4 AI generation tasks concurrently
        ai = current_app.ai
        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = {
                executor.submit(ai.generate_title, text, filename): "nom",
                executor.submit(ai.generate_flashcards, text): "flashcards",
                executor.submit(ai.generate_summary, text): "summary",
                executor.submit(ai.generate_quiz, text): "quiz",
            }
            results = {}
            for future in as_completed(futures):
                key = futures[future]
                results[key] = future.result()

        course_id = os.path.splitext(filename)[0]
        output = {
            "id": course_id,
            "nom": results["nom"],
            "flashcards": results["flashcards"],
            "summary": results["summary"],
            "quiz": results["quiz"],
            "sessions": 0,
        }

        logger.info("Saving course %s for user %s", course_id, g.uid)
        current_app.db.save_course(g.uid, course_id, output)

        course = current_app.db.fetch_course(g.uid, course_id)
        return jsonify(_course_to_response(course) if course else output)

    except Exception as e:
        logger.exception("Erreur traitement document")
        return jsonify({"error": f"Erreur traitement: {str(e)}"}), 500
