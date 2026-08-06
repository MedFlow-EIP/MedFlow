"""Integration tests for session-related API endpoints."""
import pytest


class TestRevision:
    def test_revision_all_mode_with_courses(self, client, auth_headers, seeded_course):
        resp = client.post(
            "/api/revision",
            json={"mode": "all"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert "flashcards" in data
        assert "quiz" in data
        assert data["mode"] == "all"

    def test_revision_course_mode(self, client, auth_headers, seeded_course):
        resp = client.post(
            "/api/revision",
            json={"mode": "course", "course_id": seeded_course},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["mode"] == "course"
        assert data["course_id"] == seeded_course

    def test_revision_course_mode_nonexistent_course(self, client, auth_headers):
        resp = client.post(
            "/api/revision",
            json={"mode": "course", "course_id": "ghost"},
            headers=auth_headers,
        )
        assert resp.status_code == 404

    def test_revision_no_courses_returns_400(self, client, auth_headers):
        resp = client.post(
            "/api/revision",
            json={"mode": "all"},
            headers=auth_headers,
        )
        assert resp.status_code == 400
        assert "Aucun cours" in resp.get_json()["error"]

    def test_revision_requires_auth(self, client):
        resp = client.post("/api/revision", json={"mode": "all"})
        assert resp.status_code == 400

    def test_revision_defaults_to_all_mode(self, client, auth_headers, seeded_course):
        resp = client.post("/api/revision", json={}, headers=auth_headers)
        # mode defaults to "all" — if courses exist this returns 200
        assert resp.status_code == 200
        assert resp.get_json()["mode"] == "all"


class TestSessionDone:
    def test_session_done_all_mode(self, client, auth_headers):
        resp = client.post(
            "/api/session-done",
            json={"mode": "all", "session_type": "flashcards", "score": 4, "total_questions": 5},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.get_json()["status"] == "ok"

    def test_session_done_course_mode(self, client, auth_headers, seeded_course, db, uid):
        resp = client.post(
            "/api/session-done",
            json={
                "mode": "course",
                "course_id": seeded_course,
                "session_type": "quiz",
                "score": 8,
                "total_questions": 10,
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200
        stats = db.get_user_session_stats(uid, seeded_course)
        assert stats["total_sessions"] == 1
        assert stats["quiz_sessions"] == 1
        assert stats["avg_score"] == 8.0

    def test_session_done_course_mode_increments_course_sessions(
        self, client, auth_headers, seeded_course, db, uid
    ):
        client.post(
            "/api/session-done",
            json={"mode": "course", "course_id": seeded_course, "session_type": "revision"},
            headers=auth_headers,
        )
        course = db.fetch_course(uid, seeded_course)
        assert course.sessions == 1

    def test_session_done_course_mode_missing_course_id(self, client, auth_headers):
        resp = client.post(
            "/api/session-done",
            json={"mode": "course"},
            headers=auth_headers,
        )
        assert resp.status_code == 400

    def test_session_done_nonexistent_course(self, client, auth_headers):
        resp = client.post(
            "/api/session-done",
            json={"mode": "course", "course_id": "ghost"},
            headers=auth_headers,
        )
        assert resp.status_code == 404

    def test_session_done_requires_auth(self, client):
        resp = client.post("/api/session-done", json={"mode": "all"})
        assert resp.status_code == 400

    def test_invalid_score_stored_as_null(self, client, auth_headers, seeded_course, db, uid):
        client.post(
            "/api/session-done",
            json={
                "mode": "course",
                "course_id": seeded_course,
                "session_type": "quiz",
                "score": "not-a-number",
            },
            headers=auth_headers,
        )
        # Should not raise — score silently becomes NULL
        stats = db.get_user_session_stats(uid)
        assert stats["total_sessions"] == 1
