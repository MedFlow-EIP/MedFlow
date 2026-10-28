"""Calendrier d'activité (une case par jour)."""
from datetime import datetime, timezone


def _h(uid="u1"):
    return {"X-User-UID": uid, "X-User-Name": "Testeur"}


def test_empty(client):
    data = client.get("/api/activity/calendar", headers=_h()).get_json()
    assert len(data["days"]) == 126
    assert data["days"][-1]["date"] == datetime.now(timezone.utc).date().isoformat()
    assert (data["active_days"], data["total"], data["best_run"]) == (0, 0, 0)


def test_counts_answers_and_lessons_of_today(client, db):
    quiz = [{"question": "Q", "options": {"A": "a", "B": "b"}, "correct": "A"}]
    db.save_course("u1", "c", {"nom": "C", "flashcards": [], "quiz": quiz})
    db.record_quiz_answer("u1", "c", 0, "A")
    db.record_quiz_answer("u1", "c", 0, "B")
    db.log_activity("u1", "lesson_completed", "Leçon", "+10 XP", xp_gained=10)
    db.log_activity("u1", "badge_unlocked", "Badge")  # pas une activité d'étude

    data = client.get("/api/activity/calendar?days=7", headers=_h()).get_json()
    assert len(data["days"]) == 7
    assert data["days"][-1]["count"] == 3
    assert (data["active_days"], data["best_run"]) == (1, 1)


def test_only_own_activity(client, db):
    db.log_activity("u2", "lesson_completed", "Leçon")
    assert client.get("/api/activity/calendar", headers=_h()).get_json()["total"] == 0


def test_days_are_bounded(client):
    assert len(client.get("/api/activity/calendar?days=5000", headers=_h()).get_json()["days"]) == 366
