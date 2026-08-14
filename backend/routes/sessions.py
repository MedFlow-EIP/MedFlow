import logging
import random

from flask import Blueprint, current_app, g, jsonify, request

from middleware.auth import require_auth

logger = logging.getLogger(__name__)

sessions_bp = Blueprint("sessions", __name__)


@sessions_bp.route("/api/revision/practice", methods=["GET"])
@require_auth
def get_practice_revision():
    """Toutes les questions de quiz d'un cours (ou de tous les cours),
    sans filtrage par date de révision — mode entraînement libre, pour
    réviser autant de fois qu'on veut sans attendre le planning SM-2.
    N'affecte jamais revision_schedule."""
    try:
        db = current_app.db
        uid = g.uid
        course_id = request.args.get("course_id")

        items = db.get_all_quiz_items(uid, course_id=course_id)
        return jsonify({"items": items, "count": len(items)})

    except Exception as e:
        logger.exception("Erreur revision/practice")
        return jsonify({"error": f"Erreur revision/practice: {str(e)}"}), 500


@sessions_bp.route("/api/revision/check", methods=["POST"])
@require_auth
def check_revision_answer():
    """Vérifie une réponse en mode entraînement libre, sans toucher au
    planning de répétition espacée (contrairement à /api/revision/answer)."""
    try:
        data = request.get_json(silent=True) or {}
        db = current_app.db
        uid = g.uid

        course_id = data.get("course_id")
        item_index = data.get("item_index")
        selected_option = data.get("selected_option")

        if not course_id or item_index is None or not selected_option:
            return jsonify({"error": "course_id, item_index et selected_option requis"}), 400

        try:
            item_index = int(item_index)
        except (TypeError, ValueError):
            return jsonify({"error": "item_index doit être un entier"}), 400

        result = db.check_quiz_answer(uid, course_id, item_index, selected_option)
        return jsonify(result)

    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.exception("Erreur revision/check")
        return jsonify({"error": f"Erreur revision/check: {str(e)}"}), 500


@sessions_bp.route("/api/revision/forecast", methods=["GET"])
@require_auth
def get_revision_forecast_route():
    """Prévision du nombre de cartes dues par jour sur les 7 prochains
    jours (paramétrable via ``?days=``), et streak de révision actuel."""
    try:
        db = current_app.db
        uid = g.uid
        days = request.args.get("days", default=7, type=int)
        days = max(1, min(days, 30))

        forecast = db.get_revision_forecast(uid, days=days)
        streak = db.get_revision_streak(uid)
        return jsonify({"forecast": forecast, "streak": streak})

    except Exception as e:
        logger.exception("Erreur revision/forecast")
        return jsonify({"error": f"Erreur revision/forecast: {str(e)}"}), 500


@sessions_bp.route("/api/revision/leeches", methods=["GET"])
@require_auth
def get_leech_items_route():
    """Questions signalées carte difficile (échouées plusieurs fois
    d'affilée), pour les retravailler spécifiquement sur demande."""
    try:
        db = current_app.db
        uid = g.uid
        course_id = request.args.get("course_id")

        items = db.get_leech_items(uid, course_id=course_id)
        return jsonify({"items": items, "count": len(items)})

    except Exception as e:
        logger.exception("Erreur revision/leeches")
        return jsonify({"error": f"Erreur revision/leeches: {str(e)}"}), 500


@sessions_bp.route("/api/revision/due", methods=["GET"])
@require_auth
def get_due_revision():
    """Questions de quiz à réviser aujourd'hui, calculées par l'algorithme
    SM-2 de répétition espacée (voir spaced_repetition.py). ``?course_id=``
    limite à un seul cours, sinon toutes les questions dues sont renvoyées.
    La bonne réponse n'est jamais incluse dans la réponse."""
    try:
        db = current_app.db
        uid = g.uid
        course_id = request.args.get("course_id")

        items = db.get_due_quiz_items(uid, course_id=course_id)
        return jsonify({"items": items, "count": len(items)})

    except Exception as e:
        logger.exception("Erreur revision/due")
        return jsonify({"error": f"Erreur revision/due: {str(e)}"}), 500


@sessions_bp.route("/api/revision/answer", methods=["POST"])
@require_auth
def answer_revision_card():
    """Enregistre la réponse à une question de quiz pendant une session de
    révision espacée. La qualité SM-2 est déduite automatiquement de la
    bonne/mauvaise réponse — jamais déclarée par le client — pour retirer
    tout biais d'auto-évaluation. Renvoie si la réponse était correcte, la
    bonne réponse, et la nouvelle planification (SM-2)."""
    try:
        data = request.get_json(silent=True) or {}
        db = current_app.db
        uid = g.uid

        course_id = data.get("course_id")
        item_index = data.get("item_index")
        selected_option = data.get("selected_option")

        if not course_id or item_index is None or not selected_option:
            return jsonify({"error": "course_id, item_index et selected_option requis"}), 400

        try:
            item_index = int(item_index)
        except (TypeError, ValueError):
            return jsonify({"error": "item_index doit être un entier"}), 400

        result = db.record_quiz_answer(uid, course_id, item_index, selected_option)
        return jsonify(result)

    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.exception("Erreur revision/answer")
        return jsonify({"error": f"Erreur revision/answer: {str(e)}"}), 500


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