"""Integration tests for the analytics instrumentation (friction diagnosis)."""
import pytest


class TestLessonStarted:
    def test_requires_auth(self, client):
        resp = client.post("/api/lessons/anatomy/1/start")
        assert resp.status_code == 400

    def test_logs_a_lesson_started_event(self, client, auth_headers, db, uid):
        client.post("/api/lessons/anatomy/1/start", headers=auth_headers)

        with db.connection() as conn:
            row = conn.execute(
                "SELECT * FROM analytics_events WHERE uid=? AND event_type='lesson_started'",
                (uid,),
            ).fetchone()

        assert row is not None
        assert row["path_id"] == "anatomy"
        assert row["lesson_id"] == "1"

    def test_does_not_mark_the_lesson_as_completed(self, client, auth_headers, db, uid):
        client.get("/api/paths", headers=auth_headers)
        lessons_before = db.fetch_path_lessons(uid, "anatomy")

        client.post(f"/api/lessons/anatomy/{lessons_before[0]['id']}/start", headers=auth_headers)

        lessons_after = db.fetch_path_lessons(uid, "anatomy")
        assert lessons_after[0]["status"] != "completed"

    def test_does_not_appear_in_recent_activity_feed(self, client, auth_headers, uid):
        # lesson_started est un signal interne — ne doit jamais polluer le
        # feed "Actions récentes" visible par l'utilisateur.
        client.post("/api/lessons/anatomy/1/start", headers=auth_headers)

        activity = client.get("/api/activity", headers=auth_headers).get_json()["activity"]
        assert all(a["type"] != "lesson_started" for a in activity)


class TestLessonFunnel:
    def test_completing_a_lesson_also_logs_an_analytics_event(self, client, auth_headers, db, uid):
        client.get("/api/paths", headers=auth_headers)
        lessons = db.fetch_path_lessons(uid, "anatomy")

        client.post(f"/api/lessons/anatomy/{lessons[0]['id']}/start", headers=auth_headers)
        client.post(f"/api/lessons/anatomy/{lessons[0]['id']}/complete", headers=auth_headers)

        with db.connection() as conn:
            started = conn.execute(
                "SELECT COUNT(*) AS c FROM analytics_events WHERE uid=? AND event_type='lesson_started'",
                (uid,),
            ).fetchone()["c"]
            completed = conn.execute(
                "SELECT COUNT(*) AS c FROM analytics_events WHERE uid=? AND event_type='lesson_completed'",
                (uid,),
            ).fetchone()["c"]

        assert started == 1
        assert completed == 1

    def test_abandoned_lesson_shows_up_as_started_without_completed(
        self, client, auth_headers, db, uid
    ):
        client.get("/api/paths", headers=auth_headers)
        lessons = db.fetch_path_lessons(uid, "anatomy")

        # Commence 2 leçons, n'en termine qu'une — simule un abandon.
        client.post(f"/api/lessons/anatomy/{lessons[0]['id']}/start", headers=auth_headers)
        client.post(f"/api/lessons/anatomy/{lessons[0]['id']}/complete", headers=auth_headers)
        client.post(f"/api/lessons/anatomy/{lessons[1]['id']}/start", headers=auth_headers)
        # (pas de /complete pour la 2e)

        with db.connection() as conn:
            started = conn.execute(
                "SELECT COUNT(*) AS c FROM analytics_events WHERE uid=? AND event_type='lesson_started'",
                (uid,),
            ).fetchone()["c"]
            completed = conn.execute(
                "SELECT COUNT(*) AS c FROM analytics_events WHERE uid=? AND event_type='lesson_completed'",
                (uid,),
            ).fetchone()["c"]

        assert started == 2
        assert completed == 1  # le taux d'abandon calculable : 1/2 = 50%


class TestScreenView:
    def test_requires_auth(self, client):
        resp = client.post("/api/analytics/screen-view", json={"screen": "UploadCourseScreen"})
        assert resp.status_code == 400

    def test_requires_screen_field(self, client, auth_headers):
        resp = client.post("/api/analytics/screen-view", headers=auth_headers, json={})
        assert resp.status_code == 400

    def test_logs_the_screen_name(self, client, auth_headers, db, uid):
        client.post(
            "/api/analytics/screen-view",
            headers=auth_headers,
            json={"screen": "UploadCourseScreen"},
        )

        with db.connection() as conn:
            row = conn.execute(
                "SELECT * FROM analytics_events WHERE uid=? AND event_type='screen_view'",
                (uid,),
            ).fetchone()

        assert row["screen"] == "UploadCourseScreen"

    def test_does_not_appear_in_recent_activity_feed(self, client, auth_headers, uid):
        client.post(
            "/api/analytics/screen-view",
            headers=auth_headers,
            json={"screen": "AIChatScreen"},
        )

        activity = client.get("/api/activity", headers=auth_headers).get_json()["activity"]
        assert all(a["type"] != "screen_view" for a in activity)


class TestResetProgressClearsAnalytics:
    def test_reset_progress_wipes_analytics_events(self, client, auth_headers, db, uid):
        client.post("/api/lessons/anatomy/1/start", headers=auth_headers)
        client.post(
            "/api/analytics/screen-view", headers=auth_headers, json={"screen": "AIChatScreen"}
        )

        client.post("/api/account/reset-progress", headers=auth_headers)

        with db.connection() as conn:
            count = conn.execute(
                "SELECT COUNT(*) AS c FROM analytics_events WHERE uid=?", (uid,)
            ).fetchone()["c"]

        assert count == 0