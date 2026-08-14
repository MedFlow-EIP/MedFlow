"""Integration tests for /api/search."""
import pytest


class TestSearchCourses:
    def test_requires_auth(self, client):
        resp = client.get("/api/search?q=coeur")
        assert resp.status_code == 400

    def test_empty_query_returns_empty_results(self, client, auth_headers, seeded_course):
        resp = client.get("/api/search?q=", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.get_json() == {"results": [], "count": 0}

    def test_missing_query_param_returns_empty_results(self, client, auth_headers, seeded_course):
        resp = client.get("/api/search", headers=auth_headers)
        assert resp.get_json() == {"results": [], "count": 0}

    def test_no_courses_returns_empty_results(self, client, auth_headers):
        resp = client.get("/api/search?q=coeur", headers=auth_headers)
        assert resp.get_json() == {"results": [], "count": 0}

    def test_matches_course_name(self, client, auth_headers, seeded_course):
        # seeded_course utilise sample_course_payload -> nom "Cardiologie - Test"
        resp = client.get("/api/search?q=cardiologie", headers=auth_headers)
        data = resp.get_json()
        assert data["count"] >= 1
        assert any(r["match_type"] == "course_name" for r in data["results"])

    def test_course_name_match_is_case_insensitive(self, client, auth_headers, seeded_course):
        resp = client.get("/api/search?q=CARDIOLOGIE", headers=auth_headers)
        assert resp.get_json()["count"] >= 1

    def test_matches_flashcard_question(self, client, auth_headers, db, uid, sample_course_payload):
        payload = dict(sample_course_payload)
        payload["flashcards"] = [{"question": "Qu'est-ce que la tachycardie ?", "answer": "Rythme cardiaque rapide"}]
        db.save_course(uid, "course-fc", payload)

        resp = client.get("/api/search?q=tachycardie", headers=auth_headers)
        data = resp.get_json()
        assert data["count"] == 1
        assert data["results"][0]["match_type"] == "flashcard"
        assert data["results"][0]["item_index"] == 0

    def test_matches_flashcard_answer_too(self, client, auth_headers, db, uid, sample_course_payload):
        payload = dict(sample_course_payload)
        payload["flashcards"] = [{"question": "Q sans rapport", "answer": "Contient bradycardie ici"}]
        db.save_course(uid, "course-fc2", payload)

        resp = client.get("/api/search?q=bradycardie", headers=auth_headers)
        assert resp.get_json()["count"] == 1

    def test_matches_quiz_question(self, client, auth_headers, db, uid, sample_course_payload):
        payload = dict(sample_course_payload)
        payload["quiz"] = [{
            "question": "Quelle est la valvule mitrale ?",
            "options": {"A": "1", "B": "2", "C": "3", "D": "4"},
            "correct": "A",
        }]
        db.save_course(uid, "course-quiz", payload)

        resp = client.get("/api/search?q=mitrale", headers=auth_headers)
        data = resp.get_json()
        assert data["count"] == 1
        assert data["results"][0]["match_type"] == "quiz"

    def test_never_exposes_quiz_options_or_correct_answer(
        self, client, auth_headers, db, uid, sample_course_payload
    ):
        payload = dict(sample_course_payload)
        payload["quiz"] = [{
            "question": "Question recherchable",
            "options": {"A": "1", "B": "2", "C": "3", "D": "4"},
            "correct": "A",
        }]
        db.save_course(uid, "course-quiz2", payload)

        resp = client.get("/api/search?q=recherchable", headers=auth_headers)
        result = resp.get_json()["results"][0]
        assert "options" not in result
        assert "correct" not in result

    def test_no_match_returns_empty(self, client, auth_headers, seeded_course):
        resp = client.get("/api/search?q=xyzabc123introuvable", headers=auth_headers)
        assert resp.get_json() == {"results": [], "count": 0}

    def test_searches_across_multiple_courses(self, client, auth_headers, db, uid, sample_course_payload):
        payload_a = dict(sample_course_payload)
        payload_a["nom"] = "Pneumologie"
        payload_b = dict(sample_course_payload)
        payload_b["nom"] = "Cardiologie avancée"
        db.save_course(uid, "course-a", payload_a)
        db.save_course(uid, "course-b", payload_b)

        resp = client.get("/api/search?q=cardio", headers=auth_headers)
        data = resp.get_json()
        assert any(r["course_id"] == "course-b" for r in data["results"])
        assert not any(r["course_id"] == "course-a" and r["match_type"] == "course_name" for r in data["results"])

    def test_results_only_contain_current_users_courses(
        self, client, auth_headers, db, sample_course_payload
    ):
        payload = dict(sample_course_payload)
        payload["nom"] = "Cours d'un autre utilisateur"
        db.save_course("someone-else-uid", "other-course", payload)

        resp = client.get("/api/search?q=autre", headers=auth_headers)
        assert resp.get_json() == {"results": [], "count": 0}