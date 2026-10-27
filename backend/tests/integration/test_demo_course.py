"""Cours d'exemple : révisable tout de suite, sans import ni IA."""
from services.demo_course import DEMO_COURSE


def _h(uid="u1"):
    return {"X-User-UID": uid, "X-User-Name": "Testeur"}


def test_demo_course_is_ready_to_revise(client, app):
    resp = client.post("/api/courses/demo", headers=_h())
    assert resp.status_code == 201
    course_id = resp.get_json()["course_id"]

    course = client.get(f"/api/course/{course_id}", headers=_h()).get_json()
    assert course["nom"] == "Exemple : le cycle cardiaque"
    assert len(course["flashcards"]) == 8 and len(course["quiz"]) == 6
    assert course["tags"] == ["Cardiologie"]

    due = client.get("/api/revision/due", headers=_h()).get_json()
    assert due["count"] == 6


def test_adding_it_twice_keeps_one_course(client):
    client.post("/api/courses/demo", headers=_h())
    client.post("/api/courses/demo", headers=_h())
    courses = client.get("/api/dashboard", headers=_h()).get_json()["cours"]
    assert [c["nom"] for c in courses] == ["Exemple : le cycle cardiaque"]


def test_quiz_answers_are_valid_letters():
    for q in DEMO_COURSE["quiz"]:
        assert q["correct"] in q["options"]
