"""Quêtes quotidiennes et hebdomadaires (F58)."""
import pytest


def _h(uid="u1"):
    return {"X-User-UID": uid, "X-User-Name": "Testeur"}


def _quests(client, uid="u1"):
    return {q["id"]: q for q in client.get("/api/quests", headers=_h(uid)).get_json()["quests"]}


@pytest.fixture
def course(db):
    quiz = [{"question": f"Q{i}", "options": {"A": "a", "B": "b"}, "correct": "A"} for i in range(20)]
    db.save_course("u1", "c", {"nom": "C", "flashcards": [], "quiz": quiz})
    return "c"


def _answer(db, n, correct=True):
    for i in range(n):
        db.record_quiz_answer("u1", "c", i, "A" if correct else "B")


class TestProgress:
    def test_fresh_user(self, client):
        quests = _quests(client)
        assert len(quests) == 6
        assert all(q["progress"] == 0 and not q["completed"] and not q["claimed"] for q in quests.values())

    def test_answers_count(self, client, db, course):
        _answer(db, 12, correct=True)
        _answer(db, 3, correct=False)
        quests = _quests(client)
        assert quests["daily_answers"]["progress"] == 15
        assert quests["daily_answers"]["completed"]
        assert quests["daily_correct"]["progress"] == 10  # plafonné à l'objectif
        assert quests["weekly_days"]["progress"] == 1

    def test_import_counts_for_weekly_quest(self, client, course):
        assert _quests(client)["weekly_import"]["completed"]

    def test_other_users_activity_ignored(self, client, db, course):
        _answer(db, 15)
        assert _quests(client, "u2")["daily_answers"]["progress"] == 0


class TestClaim:
    def test_claim_gives_xp_once(self, client, db, course):
        resp = client.post("/api/quests/weekly_import/claim", headers=_h())
        assert resp.status_code == 200
        assert resp.get_json()["xp_gained"] == 30
        with db.connection() as conn:
            assert conn.execute("SELECT xp FROM user_stats WHERE uid='u1'").fetchone()[0] == 30

        assert client.post("/api/quests/weekly_import/claim", headers=_h()).status_code == 409
        assert _quests(client)["weekly_import"]["claimed"]

    def test_cannot_claim_unfinished(self, client):
        assert client.post("/api/quests/daily_lesson/claim", headers=_h()).status_code == 400

    def test_unknown_quest(self, client):
        assert client.post("/api/quests/inconnue/claim", headers=_h()).status_code == 404

    def test_claim_is_logged(self, client, course):
        client.post("/api/quests/weekly_import/claim", headers=_h())
        activity = client.get("/api/activity", headers=_h()).get_json()
        items = activity.get("activity", activity) if isinstance(activity, dict) else activity
        assert any(a["type"] == "quest_completed" for a in items)
