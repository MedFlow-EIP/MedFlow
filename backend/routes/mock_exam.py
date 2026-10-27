"""Examen blanc : quiz chronométré qui mélange plusieurs cours, noté sur 20.

Les questions tirées sont enregistrées au démarrage : la correction se fait
côté serveur, la bonne réponse n'est jamais envoyée avant la remise de la copie.
"""
import json
import logging
import random
from datetime import datetime, timezone

from flask import Blueprint, current_app, g, jsonify, request

from middleware.auth import require_auth
from routes.errors import internal_error

logger = logging.getLogger(__name__)

mock_exam_bp = Blueprint("mock_exam", __name__)

ALLOWED_COUNTS = (10, 20, 40)
SECONDS_PER_QUESTION = 60
XP_PER_CORRECT = 2


def _grade_on_20(correct: int, total: int) -> float:
    """Note sur 20 arrondie au demi-point."""
    return round(20 * correct / total * 2) / 2 if total else 0.0


@mock_exam_bp.route("/api/mock-exam/start", methods=["POST"])
@require_auth
def start_mock_exam():
    """Tire ``count`` questions au hasard dans les cours choisis (tous si vide)."""
    try:
        body = request.get_json(silent=True) or {}
        count = body.get("count", 20)
        if count not in ALLOWED_COUNTS:
            return jsonify({"error": "Nombre de questions invalide : 10, 20 ou 40"}), 400

        db = current_app.db
        courses = db.fetch_courses(g.uid)
        course_ids = body.get("course_ids") or []
        if not isinstance(course_ids, list):
            return jsonify({"error": "Liste de cours invalide"}), 400
        if course_ids:
            wanted = set(map(str, course_ids))
            if not wanted <= {c.id for c in courses}:
                return jsonify({"error": "Cours introuvable"}), 404
            courses = [c for c in courses if c.id in wanted]

        pool = [
            (c, idx, q)
            for c in courses
            for idx, q in enumerate(c.quiz or [])
            if isinstance(q, dict) and q.get("question") and isinstance(q.get("options"), dict)
        ]
        if not pool:
            return jsonify({"error": "Aucune question disponible dans ces cours"}), 400

        picked = random.sample(pool, min(count, len(pool)))
        duration = len(picked) * SECONDS_PER_QUESTION
        refs = [{"course_id": c.id, "item_index": idx} for c, idx, _ in picked]

        with db.transaction() as conn:
            cur = conn.execute(
                "INSERT INTO mock_exams (uid, questions, duration_seconds, started_at) VALUES (?, ?, ?, ?)",
                (g.uid, json.dumps(refs), duration, datetime.now(timezone.utc).isoformat()),
            )

        return jsonify({
            "exam_id": cur.lastrowid,
            "duration_seconds": duration,
            "questions": [
                {
                    "course_id": c.id,
                    "course_nom": c.nom,
                    "item_index": idx,
                    "question": q["question"],
                    "options": q["options"],
                }
                for c, idx, q in picked
            ],
        }), 201
    except Exception:
        logger.exception("Erreur démarrage examen blanc")
        return internal_error("Erreur examen blanc")


@mock_exam_bp.route("/api/mock-exam/<int:exam_id>/submit", methods=["POST"])
@require_auth
def submit_mock_exam(exam_id):
    """Corrige la copie : ``answers`` = {"<course_id>:<item_index>": "A", ...}.
    Une question sans réponse compte comme fausse."""
    try:
        body = request.get_json(silent=True) or {}
        answers = body.get("answers") or {}
        if not isinstance(answers, dict):
            return jsonify({"error": "Réponses invalides"}), 400

        db = current_app.db
        with db.connection() as conn:
            row = conn.execute(
                "SELECT questions, duration_seconds, finished_at FROM mock_exams WHERE id=? AND uid=?",
                (exam_id, g.uid),
            ).fetchone()
        if not row:
            return jsonify({"error": "Examen introuvable"}), 404
        if row["finished_at"]:
            return jsonify({"error": "Copie déjà rendue"}), 409

        courses = {c.id: c for c in db.fetch_courses(g.uid)}
        corrections = []
        for ref in json.loads(row["questions"]):
            course = courses.get(ref["course_id"])
            quiz = course.quiz if course else []
            if ref["item_index"] >= len(quiz or []):
                continue  # cours supprimé ou modifié pendant l'examen
            q = quiz[ref["item_index"]]
            selected = answers.get(f"{ref['course_id']}:{ref['item_index']}")
            corrections.append({
                "course_id": ref["course_id"],
                "course_nom": course.nom,
                "item_index": ref["item_index"],
                "question": q.get("question"),
                "options": q.get("options"),
                "selected": selected,
                "correct_answer": q.get("correct"),
                "explanation": q.get("explanation"),
                "is_correct": selected is not None and selected == q.get("correct"),
            })

        total = len(corrections)
        correct = sum(1 for c in corrections if c["is_correct"])
        grade = _grade_on_20(correct, total)
        xp = correct * XP_PER_CORRECT
        now = datetime.now(timezone.utc).isoformat()

        with db.transaction() as conn:
            updated = conn.execute(
                "UPDATE mock_exams SET finished_at=?, score=?, total=? WHERE id=? AND uid=? AND finished_at IS NULL",
                (now, correct, total, exam_id, g.uid),
            )
            if updated.rowcount == 0:
                return jsonify({"error": "Copie déjà rendue"}), 409
            for c in corrections:
                if c["selected"] is not None:
                    db._log_answer(conn, g.uid, c["course_id"], c["item_index"], c["is_correct"], "mock_exam")
            if xp:
                conn.execute("INSERT OR IGNORE INTO user_stats (uid, xp, streak) VALUES (?, 0, 0)", (g.uid,))
                conn.execute("UPDATE user_stats SET xp = xp + ? WHERE uid=?", (xp, g.uid))

        db.log_activity(g.uid, "mock_exam", "Examen blanc", f"{grade:g}/20", xp_gained=xp)
        badges = db.check_and_unlock_badges(g.uid)

        return jsonify({
            "score": correct,
            "total": total,
            "grade": grade,
            "xp_gained": xp,
            "corrections": corrections,
            "new_badges": badges,
        })
    except Exception:
        logger.exception("Erreur correction examen blanc")
        return internal_error("Erreur examen blanc")


@mock_exam_bp.route("/api/mock-exam/history", methods=["GET"])
@require_auth
def mock_exam_history():
    """10 derniers examens blancs terminés."""
    try:
        with current_app.db.connection() as conn:
            rows = conn.execute(
                "SELECT id, score, total, finished_at FROM mock_exams "
                "WHERE uid=? AND finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 10",
                (g.uid,),
            ).fetchall()
        return jsonify({
            "history": [
                {
                    "id": r["id"],
                    "score": r["score"],
                    "total": r["total"],
                    "grade": _grade_on_20(r["score"], r["total"]),
                    "finished_at": r["finished_at"],
                }
                for r in rows
            ]
        })
    except Exception:
        logger.exception("Erreur historique examens blancs")
        return internal_error("Erreur examen blanc")
