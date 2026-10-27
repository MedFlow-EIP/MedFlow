"""Défis entre amis (F57)."""
import pytest


def _h(uid):
    return {"X-User-UID": uid, "X-User-Name": uid.capitalize()}


@pytest.fixture
def friends(db):
    db.upsert_user_profile("alice", "Alice")
    db.upsert_user_profile("bob", "Bob")
    db.upsert_user_profile("carol", "Carol")
    db.send_friend_request("alice", "bob")
    db.respond_to_friend_request("bob", "alice", True)
    quiz = [{"question": f"Q{i}", "options": {"A": "a", "B": "b"}, "correct": "A", "explanation": "A."} for i in range(8)]
    db.save_course("alice", "cardio", {"nom": "Cardio", "flashcards": [], "quiz": quiz})


def _create(client, **body):
    payload = {"friend_uid": "bob", "course_id": "cardio", "count": 5, **body}
    return client.post("/api/challenges", json=payload, headers=_h("alice"))


def _play(client, uid, challenge_id, correct):
    answers = {f"defi:{i}": ("A" if i < correct else "B") for i in range(5)}
    return client.post(f"/api/challenges/{challenge_id}/submit", json={"answers": answers}, headers=_h(uid))


def _xp(db, uid):
    with db.connection() as conn:
        row = conn.execute("SELECT xp FROM user_stats WHERE uid=?", (uid,)).fetchone()
    return row["xp"] if row else 0


class TestCreate:
    def test_create(self, client, friends):
        assert _create(client).status_code == 201

    def test_only_friends(self, client, friends):
        assert _create(client, friend_uid="carol").status_code == 403

    def test_own_course_only(self, client, friends):
        assert _create(client, course_id="inconnu").status_code == 404

    def test_invalid_count(self, client, friends):
        assert _create(client, count=3).status_code == 400

    def test_course_needs_questions(self, client, friends, db):
        db.save_course("alice", "vide", {"nom": "Vide", "flashcards": [], "quiz": []})
        assert _create(client, course_id="vide").status_code == 400

    def test_pending_limit(self, client, friends):
        for _ in range(10):
            assert _create(client).status_code == 201
        assert _create(client).status_code == 429


class TestPlay:
    def test_questions_hide_answers(self, client, friends):
        cid = _create(client).get_json()["id"]
        data = client.get(f"/api/challenges/{cid}", headers=_h("bob")).get_json()
        assert len(data["questions"]) == 5
        assert all("correct" not in q for q in data["questions"])
        assert data["challenge"]["friend_name"] == "Alice"

    def test_outsider_cannot_see(self, client, friends):
        cid = _create(client).get_json()["id"]
        assert client.get(f"/api/challenges/{cid}", headers=_h("carol")).status_code == 404

    def test_full_game_winner_gets_xp(self, client, friends, db):
        cid = _create(client).get_json()["id"]
        first = _play(client, "alice", cid, 4).get_json()
        assert first["score"] == 4 and first["challenge"]["status"] == "pending"
        assert first["challenge"]["their_score"] is None

        # Bob ne voit pas le score d'Alice avant d'avoir joué.
        bob_view = {c["id"]: c for c in client.get("/api/challenges", headers=_h("bob")).get_json()["challenges"]}
        assert bob_view[cid]["their_score"] is None and bob_view[cid]["can_play"]

        second = _play(client, "bob", cid, 2).get_json()
        assert second["challenge"]["status"] == "done"
        assert second["challenge"]["outcome"] == "loss"
        assert second["xp_gained"] == 5
        assert (_xp(db, "alice"), _xp(db, "bob")) == (20, 5)

        alice_view = {c["id"]: c for c in client.get("/api/challenges", headers=_h("alice")).get_json()["challenges"]}
        assert alice_view[cid]["outcome"] == "win"
        assert (alice_view[cid]["my_score"], alice_view[cid]["their_score"]) == (4, 2)

    def test_tie(self, client, friends, db):
        cid = _create(client).get_json()["id"]
        _play(client, "alice", cid, 3)
        assert _play(client, "bob", cid, 3).get_json()["challenge"]["outcome"] == "tie"
        assert (_xp(db, "alice"), _xp(db, "bob")) == (10, 10)

    def test_cannot_play_twice(self, client, friends):
        cid = _create(client).get_json()["id"]
        _play(client, "alice", cid, 3)
        assert _play(client, "alice", cid, 5).status_code == 409

    def test_decline(self, client, friends):
        cid = _create(client).get_json()["id"]
        assert client.post(f"/api/challenges/{cid}/decline", headers=_h("alice")).status_code == 404
        assert client.post(f"/api/challenges/{cid}/decline", headers=_h("bob")).status_code == 200
        assert _play(client, "bob", cid, 5).status_code == 409

    def test_expired(self, client, friends, db):
        cid = _create(client).get_json()["id"]
        with db.transaction() as conn:
            conn.execute("UPDATE challenges SET expires_at='2000-01-01T00:00:00+00:00' WHERE id=?", (cid,))
        assert _play(client, "bob", cid, 5).status_code == 409
        listed = client.get("/api/challenges", headers=_h("bob")).get_json()["challenges"]
        assert listed[0]["status"] == "expired" and not listed[0]["can_play"]


def test_account_deletion_removes_challenges(client, friends, db):
    _create(client)
    db.delete_user_data("bob")
    with db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM challenges").fetchone()[0] == 0
