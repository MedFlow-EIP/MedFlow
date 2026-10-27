"""Révision des flashcards en répétition espacée (SM-2).

À la différence du quiz (corrigé automatiquement), l'utilisateur voit la
question, retourne la carte puis note lui-même : à revoir, difficile, bien,
facile. La note fixe la date de la prochaine révision.
"""
import logging

from flask import Blueprint, current_app, g, jsonify, request

from middleware.auth import require_auth
from routes.errors import internal_error

logger = logging.getLogger(__name__)

flashcards_bp = Blueprint("flashcards", __name__)


@flashcards_bp.route("/api/flashcards/due", methods=["GET"])
@require_auth
def due_flashcards():
    """Flashcards à revoir aujourd'hui (20 au maximum), d'un cours ou de tous."""
    try:
        course_id = request.args.get("course_id") or None
        db = current_app.db
        items = db.get_due_flashcards(g.uid, course_id=course_id)
        return jsonify({"items": items, "count": len(items), "total_due": db.count_due_flashcards(g.uid)})
    except Exception:
        logger.exception("Erreur flashcards dues")
        return internal_error("Erreur flashcards")


@flashcards_bp.route("/api/flashcards/review", methods=["POST"])
@require_auth
def review_flashcard():
    """Note d'une carte : ``grade`` = again | hard | good | easy."""
    try:
        body = request.get_json(silent=True) or {}
        course_id = str(body.get("course_id") or "")
        card_key = str(body.get("card_key") or "")
        grade = str(body.get("grade") or "")
        if not course_id or not card_key:
            return jsonify({"error": "course_id et card_key requis"}), 400
        try:
            result = current_app.db.record_flashcard_review(g.uid, course_id, card_key, grade)
        except ValueError:
            return jsonify({"error": "Note invalide : again, hard, good ou easy"}), 400
        except LookupError:
            return jsonify({"error": "Flashcard introuvable"}), 404
        return jsonify(result)
    except Exception:
        logger.exception("Erreur note flashcard")
        return internal_error("Erreur flashcards")
