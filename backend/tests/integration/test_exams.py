"""Calendrier d'examens (F64) : CRUD et priorité des cours liés en révision."""
from datetime import date, timedelta

import pytest


def _h(uid="u1"):
    return {"X-User-UID": uid, "X-User-Name": "Testeur"}


def _quiz(n):
    return [
        {"question": f"Q{i}", "options": {"A": "a", "B": "b"}, "correct": "A"}
        for i in range(n)
    ]


def _in(days):
    return (date.today() + timedelta(days=days)).isoformat()


@pytest.fixture
def courses(db):
    db.save_course("u1", "cardio", {"nom": "Cardio", "flashcards": [], "quiz": _quiz(2)})
    db.save_course("u1", "neuro", {"nom": "Neuro", "flashcards": [], "quiz": _quiz(2)})
    return ["cardio", "neuro"]


def _create(client, uid="u1", **body):
    payload = {"title": "Partiel cardio", "exam_date": _in(10), "course_ids": ["cardio"], **body}
    return client.post("/api/exams", json=payload, headers=_h(uid))


class TestExamCrud:
    def test_create_and_list(self, client, courses):
        resp = _create(client)
        assert resp.status_code == 201
        exam = resp.get_json()
        assert exam["days_left"] == 10
        assert exam["courses"] == [{"id": "cardio", "nom": "Cardio"}]

        listed = client.get("/api/exams", headers=_h()).get_json()["exams"]
        assert [e["title"] for e in listed] == ["Partiel cardio"]

    def test_sorted_by_date(self, client, courses):
        _create(client, title="Loin", exam_date=_in(40))
        _create(client, title="Proche", exam_date=_in(2))
        titles = [e["title"] for e in client.get("/api/exams", headers=_h()).get_json()["exams"]]
        assert titles == ["Proche", "Loin"]

    @pytest.mark.parametrize("body", [
        {"title": ""},
        {"title": "x" * 81},
        {"exam_date": "pas une date"},
        {"exam_date": _in(-1)},
        {"exam_date": _in(3 * 365)},
        {"course_ids": "cardio"},
    ])
    def test_invalid(self, client, courses, body):
        assert _create(client, **body).status_code == 400

    def test_cannot_link_someone_elses_course(self, client, courses):
        assert _create(client, uid="u2").status_code == 404

    def test_delete(self, client, courses):
        exam_id = _create(client).get_json()["id"]
        assert client.delete(f"/api/exams/{exam_id}", headers=_h("u2")).status_code == 404
        assert client.delete(f"/api/exams/{exam_id}", headers=_h()).status_code == 200
        assert client.get("/api/exams", headers=_h()).get_json()["exams"] == []

    def test_deleted_course_disappears_from_exam(self, client, courses, db):
        _create(client, course_ids=["cardio", "neuro"])
        db.delete_course("u1", "neuro")
        exam = client.get("/api/exams", headers=_h()).get_json()["exams"][0]
        assert [c["id"] for c in exam["courses"]] == ["cardio"]


class TestRevisionPriority:
    def _due(self, client):
        return client.get("/api/revision/due", headers=_h()).get_json()["items"]

    def test_exam_courses_come_first(self, client, courses):
        _create(client, course_ids=["neuro"], exam_date=_in(5))
        items = self._due(client)
        assert [it["course_id"] for it in items[:2]] == ["neuro", "neuro"]
        assert items[0]["exam"] == {"title": "Partiel cardio", "days_left": 5}
        assert "exam" not in items[-1]

    def test_far_exam_does_not_change_order(self, client, courses):
        _create(client, course_ids=["neuro"], exam_date=_in(60))
        assert all("exam" not in it for it in self._due(client))

    def test_cards_planned_after_exam_are_pulled_forward(self, client, courses, db):
        # Carte réussie : prochaine révision dans plusieurs jours, donc pas due.
        db.record_quiz_answer("u1", "cardio", 0, "A")
        with db.transaction() as conn:
            conn.execute(
                "UPDATE revision_schedule SET next_review_date=? WHERE uid='u1' AND course_id='cardio'",
                (_in(20),),
            )
        keys = lambda: {(it["course_id"], it["item_index"]) for it in self._due(client)}
        assert ("cardio", 0) not in keys()

        _create(client, course_ids=["cardio"], exam_date=_in(7))
        assert ("cardio", 0) in keys()
