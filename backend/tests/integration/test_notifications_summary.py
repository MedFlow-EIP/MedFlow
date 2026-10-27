"""Résumé social : demandes d'ami reçues et défis à jouer."""


def _h(uid):
    return {"X-User-UID": uid, "X-User-Name": uid.capitalize()}


def test_summary(client, db):
    for uid, name in [("alice", "Alice"), ("bob", "Bob"), ("carol", "Carol")]:
        db.upsert_user_profile(uid, name)
    db.send_friend_request("carol", "bob")
    db.send_friend_request("alice", "bob")
    db.respond_to_friend_request("bob", "alice", True)
    quiz = [{"question": f"Q{i}", "options": {"A": "a", "B": "b"}, "correct": "A"} for i in range(5)]
    db.save_course("alice", "c", {"nom": "Cardio", "flashcards": [], "quiz": quiz})
    client.post("/api/challenges", json={"friend_uid": "bob", "course_id": "c", "count": 5}, headers=_h("alice"))

    data = client.get("/api/notifications/summary", headers=_h("bob")).get_json()
    assert data["friend_requests"] == [{"uid": "carol", "displayName": "Carol"}]
    assert [(c["friend_name"], c["course_nom"]) for c in data["challenges"]] == [("Alice", "Cardio")]

    # Le créateur du défi n'a rien à jouer « en attente de lui » dans ce résumé.
    assert client.get("/api/notifications/summary", headers=_h("alice")).get_json() == {
        "friend_requests": [],
        "challenges": [],
    }
