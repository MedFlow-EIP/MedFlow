"""Examen blanc : tirage, correction côté serveur, note sur 20."""
import pytest


def _h(uid="u1"):
    return {"X-User-UID": uid, "X-User-Name": "Testeur"}


def _quiz(n, prefix):
    return [
        {"question": f"{prefix}{i}", "options": {"A": "a", "B": "b"}, "correct": "A", "explanation": "Car A."}
        for i in range(n)
    ]


@pytest.fixture
def courses(db):
    db.save_course("u1", "cardio", {"nom": "Cardio", "flashcards": [], "quiz": _quiz(15, "C")})
    db.save_course("u1", "neuro", {"nom": "Neuro", "flashcards": [], "quiz": _quiz(15, "N")})


def _start(client, **body):
    return client.post("/api/mock-exam/start", json={"count": 10, **body}, headers=_h())


class TestStart:
    def test_draws_questions_without_answers(self, client, courses):
        resp = _start(client)
        assert resp.status_code == 201
        data = resp.get_json()
        assert len(data["questions"]) == 10
        assert data["duration_seconds"] == 600
        assert all("correct" not in q for q in data["questions"])

    def test_limited_to_selected_courses(self, client, courses):
        data = _start(client, course_ids=["neuro"]).get_json()
        assert {q["course_id"] for q in data["questions"]} == {"neuro"}

    def test_fewer_questions_than_requested(self, client, courses):
        data = _start(client, count=40).get_json()
        assert len(data["questions"]) == 30
        assert data["duration_seconds"] == 30 * 60

    @pytest.mark.parametrize("body,status", [({"count": 7}, 400), ({"course_ids": ["inconnu"]}, 404)])
    def test_invalid(self, client, courses, body, status):
        assert _start(client, **body).status_code == status

    def test_no_courses(self, client):
        assert _start(client).status_code == 400


class TestSubmit:
    def test_grading(self, client, courses, db):
        data = _start(client).get_json()
        qs = data["questions"]
        # 7 bonnes réponses, 2 fausses, 1 sans réponse.
        answers = {f"{q['course_id']}:{q['item_index']}": "A" for q in qs[:7]}
        answers.update({f"{q['course_id']}:{q['item_index']}": "B" for q in qs[7:9]})

        resp = client.post(f"/api/mock-exam/{data['exam_id']}/submit", json={"answers": answers}, headers=_h())
        assert resp.status_code == 200
        result = resp.get_json()
        assert (result["score"], result["total"], result["grade"], result["xp_gained"]) == (7, 10, 14.0, 14)
        unanswered = [c for c in result["corrections"] if c["selected"] is None]
        assert len(unanswered) == 1 and not unanswered[0]["is_correct"]
        assert result["corrections"][0]["explanation"] == "Car A."

        with db.connection() as conn:
            assert conn.execute("SELECT xp FROM user_stats WHERE uid='u1'").fetchone()[0] == 14
            assert conn.execute("SELECT COUNT(*) FROM answer_log WHERE source='mock_exam'").fetchone()[0] == 9

    def test_cannot_submit_twice(self, client, courses):
        exam_id = _start(client).get_json()["exam_id"]
        assert client.post(f"/api/mock-exam/{exam_id}/submit", json={"answers": {}}, headers=_h()).status_code == 200
        assert client.post(f"/api/mock-exam/{exam_id}/submit", json={"answers": {}}, headers=_h()).status_code == 409

    def test_cannot_submit_someone_elses_exam(self, client, courses):
        exam_id = _start(client).get_json()["exam_id"]
        assert client.post(f"/api/mock-exam/{exam_id}/submit", json={"answers": {}}, headers=_h("u2")).status_code == 404

    def test_history(self, client, courses):
        exam_id = _start(client).get_json()["exam_id"]
        client.post(f"/api/mock-exam/{exam_id}/submit", json={"answers": {}}, headers=_h())
        history = client.get("/api/mock-exam/history", headers=_h()).get_json()["history"]
        assert [(h["score"], h["grade"]) for h in history] == [(0, 0.0)]


@pytest.mark.parametrize("correct,total,grade", [(10, 10, 20.0), (7, 10, 14.0), (13, 40, 6.5), (1, 3, 6.5)])
def test_grade_rounding(correct, total, grade):
    from routes.mock_exam import _grade_on_20

    assert _grade_on_20(correct, total) == grade
