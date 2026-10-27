"""Chat : contexte des cours de l'étudiant et titre de conversation résumé."""


def _h(uid="u1"):
    return {"X-User-UID": uid, "X-User-Name": "Testeur"}


def test_courses_are_given_to_the_assistant(client, app, db):
    db.save_course("u1", "neuro", {"nom": "Neurologie", "summary": "<p>Ancien</p>", "flashcards": [], "quiz": []})
    db.save_course("u1", "cardio", {"nom": "Cardiologie", "summary": "<h2>Cycle</h2><p>Systole puis diastole.</p>",
                                     "flashcards": [], "quiz": []})
    with db.transaction() as conn:
        conn.execute("UPDATE courses SET created_at='2026-01-01 00:00:00' WHERE course_id='neuro'")

    client.post("/chat", json={"message": "Résume mon dernier cours"}, headers=_h())
    context = app.ai.last_chat_call["context"]
    assert "Dernier cours : « Cardiologie »" in context
    assert "Systole puis diastole." in context and "<h2>" not in context
    assert "- Neurologie" in context


def test_no_courses_no_context(client, app):
    client.post("/chat", json={"message": "Bonjour"}, headers=_h())
    assert app.ai.last_chat_call["context"] == ""


def test_other_users_courses_are_not_shared(client, app, db):
    db.save_course("u2", "secret", {"nom": "Cours privé", "summary": "", "flashcards": [], "quiz": []})
    client.post("/chat", json={"message": "Bonjour"}, headers=_h())
    assert "Cours privé" not in app.ai.last_chat_call["context"]


def test_first_answer_gets_a_summary_title(client, db):
    resp = client.post("/chat", json={"message": "Peux-tu m'expliquer la systole et la diastole ?"}, headers=_h())
    data = resp.get_json()
    assert data["title"] == "Cycle cardiaque"
    convs = client.get("/chat/conversations", headers=_h()).get_json()["conversations"]
    assert convs[0]["title"] == "Cycle cardiaque"

    # Message suivant dans la même conversation : le titre ne change plus.
    follow = client.post("/chat", json={"message": "Et la pression ?", "conversation_id": data["conversation_id"]},
                         headers=_h()).get_json()
    assert follow["title"] is None
