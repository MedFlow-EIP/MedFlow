"""Cas cliniques interactifs (F43).

L'IA rédige un cas (dossier du patient + 3 à 6 étapes de décision) à partir
d'un cours de l'utilisateur ou d'un sujet libre. Le cas complet reste sur le
serveur : l'app ne reçoit une étape qu'au moment de la jouer, et la bonne
réponse seulement après le choix. Chaque choix a son propre retour.
"""
import json
import logging
import re
import threading
from datetime import datetime, timedelta, timezone

from flask import Blueprint, current_app, g, jsonify, request

from middleware.ai_quota import consume_ai_quota
from middleware.auth import require_auth
from routes.errors import internal_error
from services.ai.base import QUIZ_DIFFICULTY
from services.push import notify_user

logger = logging.getLogger(__name__)

cases_bp = Blueprint("cases", __name__)

MAX_CASES = 50
MAX_TOPIC_CHARS = 150
MATERIAL_MAX_CHARS = 12000
XP_PER_GOOD_DECISION = 5
XP_COMPLETION = 10
# Au-delà, un cas encore « en préparation » est considéré comme interrompu
# (serveur redémarré pendant la génération).
GENERATION_TIMEOUT = timedelta(minutes=10)
GENERATION_FAILED = "Le cas n'a pas pu être créé. Réessaie dans un instant."
_EMPTY_CASE = json.dumps({"title": "", "context": "", "steps": [], "debrief": []})


def _clean_case(raw) -> dict | None:
    """Garde un cas exploitable : 3 à 6 étapes complètes, un retour par choix."""
    if not isinstance(raw, dict):
        return None
    steps = []
    for step in raw.get("steps") or []:
        if not isinstance(step, dict):
            continue
        options = step.get("options")
        correct = step.get("correct")
        if not isinstance(options, dict) or len(options) < 2 or correct not in options:
            continue
        feedback = step.get("feedback") if isinstance(step.get("feedback"), dict) else {}
        steps.append({
            "situation": str(step.get("situation") or "").strip(),
            "question": str(step.get("question") or "").strip(),
            "options": {str(k): str(v) for k, v in options.items()},
            "correct": correct,
            "feedback": {k: str(feedback.get(k) or "") for k in options},
            "explanation": str(step.get("explanation") or "").strip(),
        })
    steps = [s for s in steps if s["question"]][:6]
    title = str(raw.get("title") or "").strip()
    context = str(raw.get("context") or "").strip()
    if len(steps) < 3 or not title or not context:
        return None
    debrief = [str(p).strip() for p in raw.get("debrief") or [] if str(p).strip()][:6]
    return {"title": title[:150], "context": context, "steps": steps, "debrief": debrief}


def _course_material(course) -> str:
    """Résumé (sans HTML) et flashcards d'un cours : la base du cas."""
    summary = re.sub(r"<[^>]+>", " ", course.summary or "")
    cards = "\n".join(f"- {c.get('question')} : {c.get('answer')}" for c in course.flashcards or [])
    return f"Cours : {course.nom}\n\nRésumé :\n{summary}\n\nPoints clés :\n{cards}"[:MATERIAL_MAX_CHARS]


def _public_step(step: dict, index: int) -> dict:
    """Étape telle qu'envoyée avant le choix : sans la bonne réponse ni les retours."""
    return {"index": index, "situation": step["situation"], "question": step["question"], "options": step["options"]}


def _status(row):
    """(statut, erreur), un cas bloqué en préparation étant signalé comme interrompu."""
    status = row["status"] if "status" in row.keys() else "ready"
    error = row["error"] if "error" in row.keys() else None
    if status == "generating" and datetime.now(timezone.utc) - datetime.fromisoformat(row["created_at"]) > GENERATION_TIMEOUT:
        return "error", "La préparation a été interrompue. Relance un cas."
    return status, error


def _state(row) -> dict:
    """État d'un cas pour l'app : étapes jouées (avec retours), étape en cours ou débriefing."""
    status, error = _status(row)
    if status != "ready":
        return {
            "id": row["id"],
            "status": status,
            "error": error,
            "title": row["title"],
            "source_label": row["source_label"],
            "course_id": row["course_id"],
            "context": "",
            "total_steps": 0,
            "played": [],
            "current": None,
            "finished": False,
            "score": 0,
            "debrief": [],
            "created_at": row["created_at"],
        }
    data = json.loads(row["data"])
    answers = json.loads(row["answers"] or "[]")
    steps = data["steps"]
    played = []
    for i, choice in enumerate(answers):
        step = steps[i]
        played.append({
            **_public_step(step, i),
            "choice": choice,
            "correct": step["correct"],
            "is_correct": choice == step["correct"],
            "feedback": step["feedback"].get(choice, ""),
            "explanation": step["explanation"],
        })
    finished = len(answers) >= len(steps)
    return {
        "id": row["id"],
        "status": "ready",
        "error": None,
        "title": row["title"],
        "source_label": row["source_label"],
        "course_id": row["course_id"],
        "context": data["context"],
        "total_steps": len(steps),
        "played": played,
        "current": None if finished else _public_step(steps[len(answers)], len(answers)),
        "finished": finished,
        "score": row["score"],
        "debrief": data["debrief"] if finished else [],
        "created_at": row["created_at"],
    }


def _fetch(uid: str, case_id: int):
    with current_app.db.connection() as conn:
        return conn.execute("SELECT * FROM clinical_cases WHERE id=? AND uid=?", (case_id, uid)).fetchone()


def _generate_in_background(app, uid: str, case_id: int, material: str, difficulty: str) -> None:
    with app.app_context():
        try:
            case = _clean_case(app.ai.generate_clinical_case(material, difficulty))
        except Exception:
            logger.exception("Erreur génération cas clinique en arrière-plan")
            case = None
        with app.db.transaction() as conn:
            if case:
                conn.execute(
                    "UPDATE clinical_cases SET title=?, data=?, status='ready', error=NULL WHERE id=? AND uid=?",
                    (case["title"], json.dumps(case, ensure_ascii=False), case_id, uid),
                )
            else:
                conn.execute(
                    "UPDATE clinical_cases SET status='error', error=? WHERE id=? AND uid=?",
                    (GENERATION_FAILED, case_id, uid),
                )
        if case:
            notify_user(app, uid, "🩺 Cas clinique prêt", case["title"], {"screen": "ClinicalCase", "caseId": case_id})
        else:
            notify_user(app, uid, "Cas clinique non créé", GENERATION_FAILED)


@cases_bp.route("/api/cases", methods=["POST"])
@require_auth
def create_case():
    """Génère un cas à partir d'un cours (``course_id``) ou d'un sujet (``topic``)."""
    try:
        body = request.get_json(silent=True) or {}
        db = current_app.db
        difficulty = str(body.get("difficulty") or "normal").lower()
        if difficulty not in QUIZ_DIFFICULTY:
            return jsonify({"error": "Difficulté invalide : facile, normal ou difficile"}), 400

        course_id = str(body.get("course_id") or "").strip() or None
        topic = " ".join(str(body.get("topic") or "").split())
        if course_id:
            course = db.fetch_course(g.uid, course_id)
            if not course:
                return jsonify({"error": "Cours introuvable"}), 404
            material, label = _course_material(course), course.nom
        elif len(topic) >= 3:
            if len(topic) > MAX_TOPIC_CHARS:
                return jsonify({"error": f"Sujet trop long ({MAX_TOPIC_CHARS} caractères maximum)"}), 400
            material, label = f"Sujet demandé par l'étudiant : {topic}", topic
        else:
            return jsonify({"error": "Choisis un cours ou écris un sujet"}), 400

        with db.connection() as conn:
            count = conn.execute("SELECT COUNT(*) FROM clinical_cases WHERE uid=?", (g.uid,)).fetchone()[0]
        if count >= MAX_CASES:
            return jsonify({"error": f"{MAX_CASES} cas maximum : supprime d'anciens cas"}), 400

        if current_app.ai is None:
            return jsonify({"error": "IA indisponible"}), 503
        quota_error = consume_ai_quota("case")
        if quota_error:
            return quota_error

        now = datetime.now(timezone.utc).isoformat()
        if body.get("background"):
            # Réponse immédiate : l'utilisateur continue dans l'app, une
            # notification le prévient quand le cas est prêt.
            with db.transaction() as conn:
                cur = conn.execute(
                    "INSERT INTO clinical_cases (uid, course_id, source_label, title, data, status, created_at) "
                    "VALUES (?, ?, ?, ?, ?, 'generating', ?)",
                    (g.uid, course_id, label[:150], "Cas clinique en préparation", _EMPTY_CASE, now),
                )
            app = current_app._get_current_object()
            threading.Thread(
                target=_generate_in_background, args=(app, g.uid, cur.lastrowid, material, difficulty), daemon=True
            ).start()
            return jsonify({"id": cur.lastrowid, "status": "generating"}), 202

        case = _clean_case(current_app.ai.generate_clinical_case(material, difficulty))
        if not case:
            return jsonify({"error": GENERATION_FAILED}), 502

        with db.transaction() as conn:
            cur = conn.execute(
                "INSERT INTO clinical_cases (uid, course_id, source_label, title, data, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (g.uid, course_id, label[:150], case["title"], json.dumps(case, ensure_ascii=False), now),
            )
        return jsonify(_state(_fetch(g.uid, cur.lastrowid))), 201
    except Exception:
        logger.exception("Erreur création cas clinique")
        return internal_error("Erreur cas clinique")


@cases_bp.route("/api/cases", methods=["GET"])
@require_auth
def list_cases():
    try:
        with current_app.db.connection() as conn:
            rows = conn.execute(
                "SELECT * FROM clinical_cases "
                "WHERE uid=? ORDER BY created_at DESC",
                (g.uid,),
            ).fetchall()
        return jsonify({
            "cases": [
                {
                    "id": r["id"],
                    "status": _status(r)[0],
                    "error": _status(r)[1],
                    "title": r["title"],
                    "source_label": r["source_label"],
                    "total_steps": len(json.loads(r["data"])["steps"]),
                    "answered": len(json.loads(r["answers"] or "[]")),
                    "score": r["score"],
                    "finished": r["finished_at"] is not None,
                    "created_at": r["created_at"],
                }
                for r in rows
            ]
        })
    except Exception:
        logger.exception("Erreur liste cas cliniques")
        return internal_error("Erreur cas clinique")


@cases_bp.route("/api/cases/<int:case_id>", methods=["GET"])
@require_auth
def get_case(case_id):
    row = _fetch(g.uid, case_id)
    if not row:
        return jsonify({"error": "Cas introuvable"}), 404
    return jsonify(_state(row))


@cases_bp.route("/api/cases/<int:case_id>/answer", methods=["POST"])
@require_auth
def answer_case(case_id):
    """Choix pour l'étape en cours : renvoie le retour sur ce choix, la bonne
    réponse, puis l'étape suivante (ou le débriefing à la fin)."""
    try:
        body = request.get_json(silent=True) or {}
        db = current_app.db
        with db.transaction() as conn:
            row = conn.execute("SELECT * FROM clinical_cases WHERE id=? AND uid=?", (case_id, g.uid)).fetchone()
            if not row:
                return jsonify({"error": "Cas introuvable"}), 404
            if _status(row)[0] != "ready":
                return jsonify({"error": "Ce cas n'est pas encore prêt"}), 409
            data = json.loads(row["data"])
            answers = json.loads(row["answers"] or "[]")
            if len(answers) >= len(data["steps"]):
                return jsonify({"error": "Cas déjà terminé"}), 409
            # L'app envoie l'étape qu'elle affiche : refuse un double envoi décalé.
            if body.get("step") != len(answers):
                return jsonify({"error": "Étape déjà jouée"}), 409
            step = data["steps"][len(answers)]
            choice = body.get("option")
            if choice not in step["options"]:
                return jsonify({"error": "Choix invalide"}), 400

            is_correct = choice == step["correct"]
            answers.append(choice)
            score = row["score"] + (1 if is_correct else 0)
            finished = len(answers) == len(data["steps"])
            xp = (XP_PER_GOOD_DECISION if is_correct else 0) + (XP_COMPLETION if finished else 0)
            conn.execute(
                "UPDATE clinical_cases SET answers=?, score=?, finished_at=? WHERE id=?",
                (json.dumps(answers), score, datetime.now(timezone.utc).isoformat() if finished else None, case_id),
            )
            db._log_answer(conn, g.uid, row["course_id"] or "cas", -1, is_correct, "case")
            if xp:
                conn.execute("INSERT OR IGNORE INTO user_stats (uid, xp, streak) VALUES (?, 0, 0)", (g.uid,))
                conn.execute("UPDATE user_stats SET xp = xp + ? WHERE uid=?", (xp, g.uid))

        if finished:
            db.log_activity(g.uid, "clinical_case", f"Cas clinique : {row['title']}",
                            f"{score}/{len(data['steps'])} · +{score * XP_PER_GOOD_DECISION + XP_COMPLETION} XP",
                            xp_gained=score * XP_PER_GOOD_DECISION + XP_COMPLETION)
            db.check_and_unlock_badges(g.uid)

        return jsonify({
            "is_correct": is_correct,
            "correct": step["correct"],
            "feedback": step["feedback"].get(choice, ""),
            "explanation": step["explanation"],
            "xp_gained": xp,
            "case": _state(_fetch(g.uid, case_id)),
        })
    except Exception:
        logger.exception("Erreur réponse cas clinique")
        return internal_error("Erreur cas clinique")


@cases_bp.route("/api/cases/<int:case_id>", methods=["DELETE"])
@require_auth
def delete_case(case_id):
    with current_app.db.transaction() as conn:
        result = conn.execute("DELETE FROM clinical_cases WHERE id=? AND uid=?", (case_id, g.uid))
    if result.rowcount == 0:
        return jsonify({"error": "Cas introuvable"}), 404
    return jsonify({"success": True})
