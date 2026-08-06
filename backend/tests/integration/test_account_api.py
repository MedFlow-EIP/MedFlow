"""Integration tests for the account API endpoint."""
import pytest


class TestGetAccount:
    def test_returns_user_and_stats(self, client, auth_headers, uid):
        resp = client.get("/api/account", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert "user" in data
        assert "stats" in data
        assert data["user"]["uid"] == uid

    def test_stats_for_new_user_are_zero(self, client, auth_headers):
        resp = client.get("/api/account", headers=auth_headers)
        stats = resp.get_json()["stats"]
        assert stats["courses"] == 0
        assert stats["flashcards"] == 0
        assert stats["sessions"] == 0
        assert stats["xp"] == 0

    def test_stats_reflect_seeded_data(self, client, auth_headers, seeded_course, sample_course_payload):
        resp = client.get("/api/account", headers=auth_headers)
        stats = resp.get_json()["stats"]
        assert stats["courses"] == 1
        assert stats["flashcards"] == len(sample_course_payload["flashcards"])

    def test_stats_reflect_completed_sessions(self, client, auth_headers, seeded_course, db, uid):
        db.create_session_record(uid, seeded_course, "quiz", 9, 10)
        resp = client.get("/api/account", headers=auth_headers)
        stats = resp.get_json()["stats"]
        assert stats["sessions"] == 1
        assert stats["quiz_sessions"] == 1
        assert stats["avg_score"] == 9.0

    def test_xp_reflects_completed_lessons(self, client, auth_headers, db, uid):
        # Initialise and complete a lesson to earn XP
        client.get("/api/paths", headers=auth_headers)
        lessons = db.fetch_path_lessons(uid, "anatomy")
        db.complete_lesson(uid, lessons[0]["id"])
        resp = client.get("/api/account", headers=auth_headers)
        stats = resp.get_json()["stats"]
        assert stats["xp"] > 0

    def test_display_name_from_header(self, client, uid):
        headers = {"X-User-UID": uid, "X-User-Name": "Dr. House"}
        resp = client.get("/api/account", headers=headers)
        assert resp.get_json()["user"]["displayName"] == "Dr. House"

    def test_requires_auth(self, client):
        resp = client.get("/api/account")
        assert resp.status_code == 400
