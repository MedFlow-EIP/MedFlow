"""Integration tests for the debug reset-progress endpoint."""
import pytest


def _build_up_progress(client, auth_headers, db, uid):
    client.get("/api/paths", headers=auth_headers)
    lessons = db.fetch_path_lessons(uid, "anatomy")
    client.post(f"/api/lessons/anatomy/{lessons[0]['id']}/complete", headers=auth_headers)
    client.post(f"/api/lessons/anatomy/{lessons[1]['id']}/complete", headers=auth_headers)


class TestResetProgress:
    def test_requires_auth(self, client):
        resp = client.post("/api/account/reset-progress")
        assert resp.status_code == 400

    def test_resets_xp_and_streak_to_zero(self, client, auth_headers, db, uid):
        _build_up_progress(client, auth_headers, db, uid)
        before = client.get("/api/account", headers=auth_headers).get_json()["stats"]
        assert before["xp"] > 0

        client.post("/api/account/reset-progress", headers=auth_headers)

        after = client.get("/api/account", headers=auth_headers).get_json()["stats"]
        assert after["xp"] == 0
        assert after["streak"] == 0

    def test_resets_lessons_to_initial_state(self, client, auth_headers, db, uid):
        _build_up_progress(client, auth_headers, db, uid)

        client.post("/api/account/reset-progress", headers=auth_headers)

        lessons = db.fetch_path_lessons(uid, "anatomy")
        assert lessons[0]["status"] == "available"
        assert lessons[1]["status"] == "locked"
        assert all(l["status"] != "completed" for l in lessons)

    def test_removes_unlocked_badges(self, client, auth_headers, db, uid):
        _build_up_progress(client, auth_headers, db, uid)
        badges_before = client.get("/api/badges", headers=auth_headers).get_json()["badges"]
        assert any(b["unlocked"] for b in badges_before)

        client.post("/api/account/reset-progress", headers=auth_headers)

        badges_after = client.get("/api/badges", headers=auth_headers).get_json()["badges"]
        assert all(not b["unlocked"] for b in badges_after)

    def test_clears_activity_log(self, client, auth_headers, db, uid):
        _build_up_progress(client, auth_headers, db, uid)
        activity_before = client.get("/api/activity", headers=auth_headers).get_json()["activity"]
        assert len(activity_before) > 0

        client.post("/api/account/reset-progress", headers=auth_headers)

        activity_after = client.get("/api/activity", headers=auth_headers).get_json()["activity"]
        assert activity_after == []

    def test_does_not_affect_other_users(self, client, db):
        headers_a = {"X-User-UID": "user-a", "X-User-Name": "A"}
        headers_b = {"X-User-UID": "user-b", "X-User-Name": "B"}

        client.get("/api/paths", headers=headers_a)
        lessons_a = db.fetch_path_lessons("user-a", "anatomy")
        client.post(f"/api/lessons/anatomy/{lessons_a[0]['id']}/complete", headers=headers_a)

        client.get("/api/paths", headers=headers_b)
        lessons_b = db.fetch_path_lessons("user-b", "anatomy")
        client.post(f"/api/lessons/anatomy/{lessons_b[0]['id']}/complete", headers=headers_b)

        client.post("/api/account/reset-progress", headers=headers_a)

        stats_b = client.get("/api/account", headers=headers_b).get_json()["stats"]
        assert stats_b["xp"] > 0  # user-b n'a pas été touché