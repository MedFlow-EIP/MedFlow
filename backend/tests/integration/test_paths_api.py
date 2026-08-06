"""Integration tests for learning paths and lessons API endpoints."""
import pytest


class TestGetPaths:
    def test_returns_paths_list(self, client, auth_headers):
        resp = client.get("/api/paths", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert "paths" in data
        assert len(data["paths"]) == 4  # anatomy, cardiology, neurology, pharmacology

    def test_paths_have_required_fields(self, client, auth_headers):
        resp = client.get("/api/paths", headers=auth_headers)
        paths = resp.get_json()["paths"]
        for path in paths:
            assert "id" in path
            assert "title" in path
            assert "description" in path
            assert "progress" in path
            assert "totalLessons" in path
            assert "completedLessons" in path
            assert "isLocked" in path
            assert "color" in path
            assert "emoji" in path

    def test_first_path_not_locked(self, client, auth_headers):
        resp = client.get("/api/paths", headers=auth_headers)
        first_path = resp.get_json()["paths"][0]
        assert first_path["isLocked"] is False

    def test_requires_auth(self, client):
        resp = client.get("/api/paths")
        assert resp.status_code == 400


class TestGetLessons:
    def test_returns_lessons_for_path(self, client, auth_headers):
        # Seed user lessons first
        client.get("/api/paths", headers=auth_headers)
        resp = client.get("/api/lessons/anatomy", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert "lessons" in data
        assert len(data["lessons"]) == 10

    def test_lessons_have_required_fields(self, client, auth_headers):
        client.get("/api/paths", headers=auth_headers)
        resp = client.get("/api/lessons/anatomy", headers=auth_headers)
        for lesson in resp.get_json()["lessons"]:
            assert "id" in lesson
            assert "title" in lesson
            assert "type" in lesson
            assert "status" in lesson
            assert "stars" in lesson
            assert "position" in lesson
            assert "xp" in lesson

    def test_first_lesson_available(self, client, auth_headers):
        client.get("/api/paths", headers=auth_headers)
        resp = client.get("/api/lessons/anatomy", headers=auth_headers)
        lessons = resp.get_json()["lessons"]
        assert lessons[0]["status"] == "available"

    def test_requires_auth(self, client):
        resp = client.get("/api/lessons/anatomy")
        assert resp.status_code == 400


class TestCompleteLesson:
    def test_complete_lesson_returns_success(self, client, auth_headers):
        # Ensure user lessons are initialised
        client.get("/api/paths", headers=auth_headers)
        resp = client.get("/api/lessons/anatomy", headers=auth_headers)
        first_lesson_id = resp.get_json()["lessons"][0]["id"]

        complete_resp = client.post(
            f"/api/lessons/anatomy/{first_lesson_id}/complete",
            headers=auth_headers,
        )
        assert complete_resp.status_code == 200
        assert complete_resp.get_json()["success"] is True

    def test_complete_lesson_unlocks_next(self, client, auth_headers, db, uid):
        client.get("/api/paths", headers=auth_headers)
        lessons_before = db.fetch_path_lessons(uid, "anatomy")
        first_id = lessons_before[0]["id"]
        second_id = lessons_before[1]["id"]

        client.post(f"/api/lessons/anatomy/{first_id}/complete", headers=auth_headers)

        lessons_after = db.fetch_path_lessons(uid, "anatomy")
        second = next(l for l in lessons_after if l["id"] == second_id)
        assert second["status"] == "available"

    def test_requires_auth(self, client):
        resp = client.post("/api/lessons/anatomy/1/complete")
        assert resp.status_code == 400
