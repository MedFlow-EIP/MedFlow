"""Quêtes quotidiennes et hebdomadaires (F58).

La progression est calculée à partir de l'activité déjà enregistrée
(journal des réponses, leçons terminées, cours importés) : rien à suivre en
plus. La récompense en XP se récupère une seule fois par période.
"""
import logging
import sqlite3
from datetime import date, datetime, timedelta, timezone

from flask import Blueprint, current_app, g, jsonify

from middleware.auth import require_auth
from routes.errors import internal_error

logger = logging.getLogger(__name__)

quests_bp = Blueprint("quests", __name__)

# metric : clé calculée par _metrics ; period : "daily" ou "weekly".
QUESTS = [
    {"id": "daily_answers", "period": "daily", "title": "Réponds à 15 questions", "icon": "help-circle",
     "metric": "answers_today", "target": 15, "xp": 15},
    {"id": "daily_correct", "period": "daily", "title": "Réussis 10 réponses", "icon": "checkmark-circle",
     "metric": "correct_today", "target": 10, "xp": 15},
    {"id": "daily_lesson", "period": "daily", "title": "Termine une leçon", "icon": "school",
     "metric": "lessons_today", "target": 1, "xp": 20},
    {"id": "weekly_days", "period": "weekly", "title": "Révise 5 jours différents", "icon": "calendar",
     "metric": "revision_days_week", "target": 5, "xp": 50},
    {"id": "weekly_lessons", "period": "weekly", "title": "Termine 5 leçons", "icon": "trophy",
     "metric": "lessons_week", "target": 5, "xp": 50},
    {"id": "weekly_import", "period": "weekly", "title": "Importe un nouveau cours", "icon": "cloud-upload",
     "metric": "imports_week", "target": 1, "xp": 30},
]
QUESTS_BY_ID = {q["id"]: q for q in QUESTS}


def _periods(today: date) -> dict:
    monday = today - timedelta(days=today.weekday())
    return {
        "daily": {"key": today.isoformat(), "start": today, "ends": today + timedelta(days=1)},
        "weekly": {"key": monday.isoformat(), "start": monday, "ends": monday + timedelta(days=7)},
    }


def _metrics(db, uid: str, periods: dict) -> dict:
    day = periods["daily"]["start"].isoformat()
    week = periods["weekly"]["start"].isoformat()
    with db.connection() as conn:
        one = lambda sql, *args: conn.execute(sql, (uid, *args)).fetchone()[0] or 0
        return {
            "answers_today": one("SELECT COUNT(*) FROM answer_log WHERE uid=? AND answered_at>=?", day),
            "correct_today": one("SELECT SUM(correct) FROM answer_log WHERE uid=? AND answered_at>=?", day),
            "lessons_today": one(
                "SELECT COUNT(*) FROM activity_log WHERE uid=? AND type='lesson_completed' AND created_at>=?", day
            ),
            "revision_days_week": one(
                "SELECT COUNT(DISTINCT substr(answered_at, 1, 10)) FROM answer_log WHERE uid=? AND answered_at>=?",
                week,
            ),
            "lessons_week": one(
                "SELECT COUNT(*) FROM activity_log WHERE uid=? AND type='lesson_completed' AND created_at>=?", week
            ),
            "imports_week": one("SELECT COUNT(*) FROM courses WHERE uid=? AND created_at>=?", week),
        }


def _claimed(db, uid: str, periods: dict) -> set:
    with db.connection() as conn:
        rows = conn.execute(
            "SELECT quest_id, period_key FROM quest_claims WHERE uid=? AND period_key IN (?, ?)",
            (uid, periods["daily"]["key"], periods["weekly"]["key"]),
        ).fetchall()
    return {(r["quest_id"], r["period_key"]) for r in rows}


def build_quests(db, uid: str, today: date | None = None) -> list:
    periods = _periods(today or datetime.now(timezone.utc).date())
    metrics = _metrics(db, uid, periods)
    claimed = _claimed(db, uid, periods)
    result = []
    for q in QUESTS:
        period = periods[q["period"]]
        progress = min(metrics[q["metric"]], q["target"])
        result.append({
            "id": q["id"],
            "period": q["period"],
            "title": q["title"],
            "icon": q["icon"],
            "progress": progress,
            "target": q["target"],
            "xp": q["xp"],
            "completed": progress >= q["target"],
            "claimed": (q["id"], period["key"]) in claimed,
            "ends_at": period["ends"].isoformat(),
        })
    return result


@quests_bp.route("/api/quests", methods=["GET"])
@require_auth
def list_quests():
    try:
        return jsonify({"quests": build_quests(current_app.db, g.uid)})
    except Exception:
        logger.exception("Erreur quêtes")
        return internal_error("Erreur quêtes")


@quests_bp.route("/api/quests/<quest_id>/claim", methods=["POST"])
@require_auth
def claim_quest(quest_id):
    """Récupère l'XP d'une quête terminée (une seule fois par jour/semaine)."""
    try:
        db = current_app.db
        if quest_id not in QUESTS_BY_ID:
            return jsonify({"error": "Quête introuvable"}), 404

        quest = next(q for q in build_quests(db, g.uid) if q["id"] == quest_id)
        if quest["claimed"]:
            return jsonify({"error": "Récompense déjà récupérée"}), 409
        if not quest["completed"]:
            return jsonify({"error": "Quête pas encore terminée"}), 400

        period_key = _periods(datetime.now(timezone.utc).date())[quest["period"]]["key"]
        try:
            with db.transaction() as conn:
                conn.execute(
                    "INSERT INTO quest_claims (uid, quest_id, period_key, claimed_at) VALUES (?, ?, ?, ?)",
                    (g.uid, quest_id, period_key, datetime.now(timezone.utc).isoformat()),
                )
                conn.execute("INSERT OR IGNORE INTO user_stats (uid, xp, streak) VALUES (?, 0, 0)", (g.uid,))
                conn.execute("UPDATE user_stats SET xp = xp + ? WHERE uid=?", (quest["xp"], g.uid))
        except sqlite3.IntegrityError:
            # Deux appuis simultanés : la clé primaire garantit une seule récompense.
            return jsonify({"error": "Récompense déjà récupérée"}), 409

        db.log_activity(g.uid, "quest_completed", quest["title"], f"+{quest['xp']} XP", xp_gained=quest["xp"])
        badges = db.check_and_unlock_badges(g.uid)
        return jsonify({"xp_gained": quest["xp"], "new_badges": badges})
    except Exception:
        logger.exception("Erreur récompense quête")
        return internal_error("Erreur quêtes")
