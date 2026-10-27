"""Défis entre amis (F57) : le même quiz pour deux amis, le meilleur score gagne.

Les questions sont copiées dans le défi à sa création : l'ami n'a pas besoin
d'avoir le cours, et une modification du cours ne change pas un défi en cours.
La bonne réponse n'est jamais envoyée avant que le joueur ait rendu sa copie.
"""
import json
import logging
import random
from datetime import datetime, timedelta, timezone

from flask import Blueprint, current_app, g, jsonify, request

from middleware.auth import require_auth
from routes.errors import internal_error
from services.push import notify_user

logger = logging.getLogger(__name__)

challenges_bp = Blueprint("challenges", __name__)

ALLOWED_COUNTS = (5, 10)
MIN_QUESTIONS = 3
CHALLENGE_DAYS = 7
MAX_PENDING_SENT = 10
XP_WIN = 20
XP_TIE = 10
XP_PLAYED = 5


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _fetch(conn, challenge_id: int):
    return conn.execute("SELECT * FROM challenges WHERE id=?", (challenge_id,)).fetchone()


def _is_expired(row) -> bool:
    return row["status"] == "pending" and row["expires_at"] < _now().isoformat()


def _role(row, uid: str):
    if row["challenger_uid"] == uid:
        return "challenger"
    if row["opponent_uid"] == uid:
        return "opponent"
    return None


def _names(db, uids) -> dict:
    with db.connection() as conn:
        rows = conn.execute(
            f"SELECT uid, display_name FROM user_stats WHERE uid IN ({','.join('?' * len(uids))})",
            tuple(uids),
        ).fetchall()
    return {r["uid"]: r["display_name"] or "Utilisateur" for r in rows}


def challengeStatusText(summary: dict) -> str:
    """« Gagné 4–2 », « Perdu 1–3 », « Égalité 2–2 » (défi terminé)."""
    score = f"{summary['my_score']}–{summary['their_score']}"
    return {"win": "Gagné", "loss": "Perdu"}.get(summary["outcome"], "Égalité") + f" {score}"


def _summary(row, uid: str, names: dict) -> dict:
    role = _role(row, uid)
    mine, theirs = ("challenger", "opponent") if role == "challenger" else ("opponent", "challenger")
    my_score = row[f"{mine}_score"]
    their_score = row[f"{theirs}_score"]
    status = "expired" if _is_expired(row) else row["status"]
    done = status == "done"
    if done:
        outcome = "win" if my_score > their_score else "loss" if my_score < their_score else "tie"
    else:
        outcome = None
    other_uid = row[f"{theirs}_uid"]
    return {
        "id": row["id"],
        "role": role,
        "friend_uid": other_uid,
        "friend_name": names.get(other_uid, "Utilisateur"),
        "course_nom": row["course_nom"],
        "total": row["total"],
        "status": status,
        "my_score": my_score,
        # Score de l'ami caché tant qu'on n'a pas joué (pas d'avantage).
        "their_score": their_score if my_score is not None else None,
        "outcome": outcome,
        "can_play": status == "pending" and my_score is None,
        "created_at": row["created_at"],
        "expires_at": row["expires_at"],
    }


@challenges_bp.route("/api/challenges", methods=["POST"])
@require_auth
def create_challenge():
    """Défie un ami sur ``count`` questions d'un de ses cours."""
    try:
        body = request.get_json(silent=True) or {}
        friend_uid = str(body.get("friend_uid") or "")
        course_id = str(body.get("course_id") or "")
        count = body.get("count", 5)
        if count not in ALLOWED_COUNTS:
            return jsonify({"error": "Nombre de questions invalide : 5 ou 10"}), 400

        db = current_app.db
        if not friend_uid or db.get_friendship_status(g.uid, friend_uid) != "friends":
            return jsonify({"error": "Tu ne peux défier que tes amis"}), 403

        course = db.fetch_course(g.uid, course_id) if course_id else None
        if not course:
            return jsonify({"error": "Cours introuvable"}), 404
        pool = [q for q in course.quiz or [] if isinstance(q, dict) and isinstance(q.get("options"), dict)]
        if len(pool) < MIN_QUESTIONS:
            return jsonify({"error": f"Ce cours n'a pas assez de questions ({MIN_QUESTIONS} minimum)"}), 400

        now = _now()
        with db.transaction() as conn:
            pending = conn.execute(
                "SELECT COUNT(*) FROM challenges WHERE challenger_uid=? AND status='pending' AND expires_at>?",
                (g.uid, now.isoformat()),
            ).fetchone()[0]
            if pending >= MAX_PENDING_SENT:
                return jsonify({"error": f"{MAX_PENDING_SENT} défis en attente maximum"}), 429

            questions = random.sample(pool, min(count, len(pool)))
            cur = conn.execute(
                """
                INSERT INTO challenges
                    (challenger_uid, opponent_uid, course_nom, questions, total, status, created_at, expires_at)
                VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
                """,
                (
                    g.uid,
                    friend_uid,
                    course.nom,
                    json.dumps(questions, ensure_ascii=False),
                    len(questions),
                    now.isoformat(),
                    (now + timedelta(days=CHALLENGE_DAYS)).isoformat(),
                ),
            )
        notify_user(
            current_app._get_current_object(),
            friend_uid,
            "⚡ Nouveau défi",
            f"{g.display_name} te défie sur « {course.nom} ».",
            {"screen": "Challenge", "challengeId": cur.lastrowid},
        )
        return jsonify({"id": cur.lastrowid}), 201
    except Exception:
        logger.exception("Erreur création défi")
        return internal_error("Erreur défis")


@challenges_bp.route("/api/challenges", methods=["GET"])
@require_auth
def list_challenges():
    """Défis envoyés et reçus (30 derniers)."""
    try:
        db = current_app.db
        with db.connection() as conn:
            rows = conn.execute(
                "SELECT * FROM challenges WHERE challenger_uid=? OR opponent_uid=? ORDER BY created_at DESC LIMIT 30",
                (g.uid, g.uid),
            ).fetchall()
        others = {r["opponent_uid"] if r["challenger_uid"] == g.uid else r["challenger_uid"] for r in rows}
        names = _names(db, others) if others else {}
        return jsonify({"challenges": [_summary(r, g.uid, names) for r in rows]})
    except Exception:
        logger.exception("Erreur liste défis")
        return internal_error("Erreur défis")


@challenges_bp.route("/api/challenges/<int:challenge_id>", methods=["GET"])
@require_auth
def get_challenge(challenge_id):
    """Questions du défi (sans les réponses), pour un participant qui n'a pas encore joué."""
    try:
        db = current_app.db
        with db.connection() as conn:
            row = _fetch(conn, challenge_id)
        if not row or not _role(row, g.uid):
            return jsonify({"error": "Défi introuvable"}), 404
        summary = _summary(row, g.uid, _names(db, [row["challenger_uid"], row["opponent_uid"]]))
        if not summary["can_play"]:
            return jsonify({"error": "Ce défi n'est plus jouable", "challenge": summary}), 409
        questions = [
            {"course_id": "defi", "item_index": i, "question": q.get("question"), "options": q.get("options")}
            for i, q in enumerate(json.loads(row["questions"]))
        ]
        return jsonify({"challenge": summary, "questions": questions})
    except Exception:
        logger.exception("Erreur lecture défi")
        return internal_error("Erreur défis")


@challenges_bp.route("/api/challenges/<int:challenge_id>/submit", methods=["POST"])
@require_auth
def submit_challenge(challenge_id):
    """Corrige la copie (``answers`` = {"defi:<index>": "A"}) ; le défi se termine
    quand les deux amis ont joué, et le gagnant reçoit de l'XP."""
    try:
        body = request.get_json(silent=True) or {}
        answers = body.get("answers") or {}
        if not isinstance(answers, dict):
            return jsonify({"error": "Réponses invalides"}), 400

        db = current_app.db
        with db.transaction() as conn:
            row = _fetch(conn, challenge_id)
            role = _role(row, g.uid) if row else None
            if not role:
                return jsonify({"error": "Défi introuvable"}), 404
            if _is_expired(row) or row["status"] != "pending" or row[f"{role}_score"] is not None:
                return jsonify({"error": "Ce défi n'est plus jouable"}), 409

            questions = json.loads(row["questions"])
            corrections = []
            for i, q in enumerate(questions):
                selected = answers.get(f"defi:{i}")
                corrections.append({
                    "course_id": "defi",
                    "item_index": i,
                    "question": q.get("question"),
                    "options": q.get("options"),
                    "selected": selected,
                    "correct_answer": q.get("correct"),
                    "explanation": q.get("explanation"),
                    "is_correct": selected is not None and selected == q.get("correct"),
                })
            score = sum(1 for c in corrections if c["is_correct"])
            conn.execute(f"UPDATE challenges SET {role}_score=? WHERE id=?", (score, challenge_id))
            row = _fetch(conn, challenge_id)

            finished = row["challenger_score"] is not None and row["opponent_score"] is not None
            rewards = {}
            if finished:
                conn.execute("UPDATE challenges SET status='done' WHERE id=?", (challenge_id,))
                c_uid, o_uid = row["challenger_uid"], row["opponent_uid"]
                c_score, o_score = row["challenger_score"], row["opponent_score"]
                if c_score == o_score:
                    rewards = {c_uid: XP_TIE, o_uid: XP_TIE}
                else:
                    winner, loser = (c_uid, o_uid) if c_score > o_score else (o_uid, c_uid)
                    rewards = {winner: XP_WIN, loser: XP_PLAYED}
                for uid, xp in rewards.items():
                    conn.execute("INSERT OR IGNORE INTO user_stats (uid, xp, streak) VALUES (?, 0, 0)", (uid,))
                    conn.execute("UPDATE user_stats SET xp = xp + ? WHERE uid=?", (xp, uid))
            row = _fetch(conn, challenge_id)

        names = _names(db, [row["challenger_uid"], row["opponent_uid"]])
        summary = _summary(row, g.uid, names)
        for uid, xp in rewards.items():
            other = row["opponent_uid"] if uid == row["challenger_uid"] else row["challenger_uid"]
            db.log_activity(uid, "challenge", f"Défi contre {names.get(other, 'un ami')}", f"+{xp} XP", xp_gained=xp)
        if rewards:
            # Le premier joueur découvre le résultat sans rouvrir l'app.
            other_uid = row["opponent_uid"] if g.uid == row["challenger_uid"] else row["challenger_uid"]
            other_summary = _summary(row, other_uid, names)
            notify_user(
                current_app._get_current_object(),
                other_uid,
                "🏁 Défi terminé",
                f"Contre {names.get(g.uid, 'ton ami')} : {challengeStatusText(other_summary)}",
                {"screen": "Friends"},
            )

        return jsonify({
            "challenge": summary,
            "score": score,
            "total": len(corrections),
            "xp_gained": rewards.get(g.uid, 0),
            "corrections": corrections,
        })
    except Exception:
        logger.exception("Erreur correction défi")
        return internal_error("Erreur défis")


@challenges_bp.route("/api/challenges/<int:challenge_id>/decline", methods=["POST"])
@require_auth
def decline_challenge(challenge_id):
    try:
        db = current_app.db
        with db.transaction() as conn:
            result = conn.execute(
                "UPDATE challenges SET status='declined' WHERE id=? AND opponent_uid=? AND status='pending' "
                "AND opponent_score IS NULL",
                (challenge_id, g.uid),
            )
        if result.rowcount == 0:
            return jsonify({"error": "Défi introuvable"}), 404
        return jsonify({"success": True})
    except Exception:
        logger.exception("Erreur refus défi")
        return internal_error("Erreur défis")


@challenges_bp.route("/api/notifications/summary", methods=["GET"])
@require_auth
def notifications_summary():
    """Ce qui attend l'utilisateur côté social : demandes d'ami reçues et défis
    à jouer. Sert à la pastille de l'onglet Compte et aux notifications."""
    try:
        db = current_app.db
        requests = db.get_pending_requests(g.uid)["received"]
        with db.connection() as conn:
            rows = conn.execute(
                "SELECT * FROM challenges WHERE opponent_uid=? AND status='pending' AND opponent_score IS NULL "
                "AND expires_at>? ORDER BY created_at DESC",
                (g.uid, _now().isoformat()),
            ).fetchall()
        names = _names(db, {r["challenger_uid"] for r in rows}) if rows else {}
        return jsonify({
            "friend_requests": [{"uid": r["uid"], "displayName": r["displayName"]} for r in requests],
            "challenges": [
                {"id": r["id"], "friend_name": names.get(r["challenger_uid"], "Un ami"), "course_nom": r["course_nom"]}
                for r in rows
            ],
        })
    except Exception:
        logger.exception("Erreur résumé notifications")
        return internal_error("Erreur notifications")
