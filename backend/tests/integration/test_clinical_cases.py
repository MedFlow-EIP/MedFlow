"""Cas cliniques interactifs (F43)."""
import pytest


def _h(uid="u1"):
    return {"X-User-UID": uid, "X-User-Name": "Testeur"}


@pytest.fixture
def course(db):
    db.save_course("u1", "cardio", {
        "nom": "Cardiologie",
        "summary": "<h2>Infarctus</h2><p>Douleur thoracique, ECG, troponine.</p>",
        "flashcards": [{"question": "Premier examen ?", "answer": "ECG"}],
        "quiz": [],
    })


def _create(client, uid="u1", **body):
    return client.post("/api/cases", json=body or {"course_id": "cardio"}, headers=_h(uid))


def _answer(client, case_id, step, option, uid="u1"):
    return client.post(f"/api/cases/{case_id}/answer", json={"step": step, "option": option}, headers=_h(uid))


class TestCreate:
    def test_from_course(self, client, app, course):
        resp = _create(client)
        assert resp.status_code == 201
        case = resp.get_json()
        assert case["source_label"] == "Cardiologie"
        assert case["total_steps"] == 4 and case["played"] == [] and not case["finished"]
        assert "correct" not in case["current"] and "feedback" not in case["current"]
        assert "Infarctus" in app.ai.last_case_material and "<h2>" not in app.ai.last_case_material

    def test_from_topic(self, client):
        resp = _create(client, topic="Insuffisance cardiaque aiguë")
        assert resp.status_code == 201
        assert resp.get_json()["source_label"] == "Insuffisance cardiaque aiguë"

    @pytest.mark.parametrize("body,status", [
        ({}, 400),
        ({"topic": "ab"}, 400),
        ({"topic": "x" * 151}, 400),
        ({"course_id": "inconnu"}, 404),
        ({"topic": "Asthme", "difficulty": "extrême"}, 400),
    ])
    def test_invalid(self, client, body, status):
        assert client.post("/api/cases", json=body, headers=_h()).status_code == status

    def test_generation_failure(self, client, app, course):
        app.ai.case_fails = True
        assert _create(client).status_code == 502

    def test_own_quota(self, client, app, course):
        app.config["AI_CASE_PER_HOUR"] = 1
        assert _create(client).status_code == 201
        assert _create(client).status_code == 429
        # Les imports et le chat ont leurs propres quotas.
        assert client.post("/chat", json={"message": "Bonjour"}, headers=_h()).status_code == 200


class TestPlay:
    def test_full_case(self, client, db, course):
        case = _create(client).get_json()
        cid = case["id"]

        wrong = _answer(client, cid, 0, "A").get_json()
        assert wrong["is_correct"] is False and wrong["correct"] == "B"
        assert wrong["feedback"] == "Retour A0"
        assert wrong["case"]["current"]["index"] == 1

        for step in (1, 2, 3):
            result = _answer(client, cid, step, "B").get_json()
            assert result["is_correct"]
        final = result["case"]
        assert final["finished"] and final["current"] is None
        assert final["score"] == 3
        assert final["debrief"] == ["Point clé 1", "Point clé 2", "Point clé 3"]
        assert [p["is_correct"] for p in final["played"]] == [False, True, True, True]

        with db.connection() as conn:
            assert conn.execute("SELECT xp FROM user_stats WHERE uid='u1'").fetchone()[0] == 3 * 5 + 10
        assert any(a["type"] == "clinical_case" for a in db.get_recent_activity("u1"))

    def test_step_must_match(self, client, course):
        cid = _create(client).get_json()["id"]
        _answer(client, cid, 0, "B")
        assert _answer(client, cid, 0, "B").status_code == 409  # double envoi
        assert _answer(client, cid, 1, "Z").status_code == 400

    def test_finished_case_is_locked(self, client, course):
        cid = _create(client).get_json()["id"]
        for step in range(4):
            _answer(client, cid, step, "B")
        assert _answer(client, cid, 4, "B").status_code == 409

    def test_resume_shows_played_steps(self, client, course):
        cid = _create(client).get_json()["id"]
        _answer(client, cid, 0, "C")
        state = client.get(f"/api/cases/{cid}", headers=_h()).get_json()
        assert state["played"][0]["choice"] == "C" and state["current"]["index"] == 1

    def test_other_user(self, client, course):
        cid = _create(client).get_json()["id"]
        assert client.get(f"/api/cases/{cid}", headers=_h("u2")).status_code == 404
        assert _answer(client, cid, 0, "B", uid="u2").status_code == 404
        assert client.delete(f"/api/cases/{cid}", headers=_h("u2")).status_code == 404


def test_list_and_delete(client, course):
    cid = _create(client).get_json()["id"]
    cases = client.get("/api/cases", headers=_h()).get_json()["cases"]
    assert [(c["id"], c["answered"], c["finished"]) for c in cases] == [(cid, 0, False)]
    assert client.delete(f"/api/cases/{cid}", headers=_h()).status_code == 200
    assert client.get("/api/cases", headers=_h()).get_json()["cases"] == []


def test_invalid_ai_output_is_rejected():
    from routes.cases import _clean_case

    assert _clean_case({"title": "T", "context": "C", "steps": []}) is None
    bad_step = {"question": "Q", "options": {"A": "a"}, "correct": "B"}
    assert _clean_case({"title": "T", "context": "C", "steps": [bad_step] * 4}) is None
