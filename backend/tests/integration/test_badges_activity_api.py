"""Integration tests for badges and recent activity."""
import pytest


def _complete_first_lesson(client, auth_headers, db, uid):
    client.get("/api/paths", headers=auth_headers)
    lessons = db.fetch_path_lessons(uid, "anatomy")
    return client.post(
        f"/api/lessons/anatomy/{lessons[0]['id']}/complete", headers=auth_headers
    )


class TestBadgesEndpoint:
    def test_requires_auth(self, client):
        resp = client.get("/api/badges")
        assert resp.status_code == 400

    def test_returns_full_catalog_all_locked_for_new_user(self, client, auth_headers):
        resp = client.get("/api/badges", headers=auth_headers)
        assert resp.status_code == 200

        badges = resp.get_json()["badges"]
        assert len(badges) > 0
        assert all(b["unlocked"] is False for b in badges)
        assert all(b["unlockedAt"] is None for b in badges)

    def test_first_lesson_badge_unlocks_after_completion(
        self, client, auth_headers, db, uid
    ):
        _complete_first_lesson(client, auth_headers, db, uid)

        badges = client.get("/api/badges", headers=auth_headers).get_json()["badges"]
        first_lesson_badge = next(b for b in badges if b["id"] == "first_lesson")
        assert first_lesson_badge["unlocked"] is True
        assert first_lesson_badge["unlockedAt"] is not None

    def test_xp_badge_stays_locked_below_threshold(self, client, auth_headers, db, uid):
        _complete_first_lesson(client, auth_headers, db, uid)

        badges = client.get("/api/badges", headers=auth_headers).get_json()["badges"]
        xp_1000_badge = next(b for b in badges if b["id"] == "xp_1000")
        assert xp_1000_badge["unlocked"] is False

    def test_badge_has_expected_shape(self, client, auth_headers):
        badges = client.get("/api/badges", headers=auth_headers).get_json()["badges"]
        badge = badges[0]
        for field in (
            "id", "title", "description", "icon", "color", "unlocked", "unlockedAt",
            "currentValue", "threshold", "progress",
        ):
            assert field in badge
        # "condition"/"metric" sont internes, ne doivent jamais fuiter dans la réponse.
        assert "condition" not in badge
        assert "metric" not in badge

    def test_progress_is_zero_for_new_user(self, client, auth_headers):
        badges = client.get("/api/badges", headers=auth_headers).get_json()["badges"]
        xp_100 = next(b for b in badges if b["id"] == "xp_100")
        assert xp_100["progress"] == 0.0
        assert xp_100["currentValue"] == 0
        assert xp_100["threshold"] == 100

    def test_progress_reflects_partial_advancement(self, client, auth_headers, db, uid):
        with db.transaction() as conn:
            conn.execute(
                "INSERT INTO user_stats (uid, xp, streak) VALUES (?, 50, 0) "
                "ON CONFLICT(uid) DO UPDATE SET xp=excluded.xp",
                (uid,),
            )

        badges = client.get("/api/badges", headers=auth_headers).get_json()["badges"]
        xp_100 = next(b for b in badges if b["id"] == "xp_100")
        assert xp_100["progress"] == 0.5
        assert xp_100["currentValue"] == 50

    def test_progress_capped_at_one_when_unlocked(self, client, auth_headers, db, uid):
        with db.transaction() as conn:
            conn.execute(
                "INSERT INTO user_stats (uid, xp, streak) VALUES (?, 9999, 0) "
                "ON CONFLICT(uid) DO UPDATE SET xp=excluded.xp",
                (uid,),
            )

        badges = client.get("/api/badges", headers=auth_headers).get_json()["badges"]
        xp_100 = next(b for b in badges if b["id"] == "xp_100")
        assert xp_100["progress"] == 1.0
        assert xp_100["currentValue"] == 100  # plafonné au seuil, pas 9999


class TestCompleteLessonReturnsNewBadges:
    def test_response_includes_new_badges_list(self, client, auth_headers, db, uid):
        resp = _complete_first_lesson(client, auth_headers, db, uid)
        body = resp.get_json()

        assert "newBadges" in body
        badge_ids = [b["id"] for b in body["newBadges"]]
        assert "first_lesson" in badge_ids

    def test_already_unlocked_badge_not_returned_again(
        self, client, auth_headers, db, uid
    ):
        client.get("/api/paths", headers=auth_headers)
        lessons = db.fetch_path_lessons(uid, "anatomy")

        first_resp = client.post(
            f"/api/lessons/anatomy/{lessons[0]['id']}/complete", headers=auth_headers
        )
        assert "first_lesson" in [b["id"] for b in first_resp.get_json()["newBadges"]]

        second_resp = client.post(
            f"/api/lessons/anatomy/{lessons[1]['id']}/complete", headers=auth_headers
        )
        assert "first_lesson" not in [
            b["id"] for b in second_resp.get_json()["newBadges"]
        ]


class TestActivityEndpoint:
    def test_requires_auth(self, client):
        resp = client.get("/api/activity")
        assert resp.status_code == 400

    def test_empty_for_new_user(self, client, auth_headers):
        resp = client.get("/api/activity", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.get_json()["activity"] == []

    def test_logs_lesson_completed_event(self, client, auth_headers, db, uid):
        _complete_first_lesson(client, auth_headers, db, uid)

        activity = client.get("/api/activity", headers=auth_headers).get_json()["activity"]
        types = [a["type"] for a in activity]
        assert "lesson_completed" in types

    def test_logs_badge_unlocked_event(self, client, auth_headers, db, uid):
        _complete_first_lesson(client, auth_headers, db, uid)

        activity = client.get("/api/activity", headers=auth_headers).get_json()["activity"]
        types = [a["type"] for a in activity]
        assert "badge_unlocked" in types

    def test_most_recent_event_first(self, client, auth_headers, db, uid):
        client.get("/api/paths", headers=auth_headers)
        lessons = db.fetch_path_lessons(uid, "anatomy")

        client.post(f"/api/lessons/anatomy/{lessons[0]['id']}/complete", headers=auth_headers)
        client.post(f"/api/lessons/anatomy/{lessons[1]['id']}/complete", headers=auth_headers)

        activity = client.get("/api/activity", headers=auth_headers).get_json()["activity"]
        # Le tout dernier événement journalisé doit être en tête de liste.
        assert activity[0]["title"] == lessons[1]["title"]

    def test_respects_limit_param(self, client, auth_headers, db, uid):
        client.get("/api/paths", headers=auth_headers)
        lessons = db.fetch_path_lessons(uid, "anatomy")
        for lesson in lessons[:3]:
            client.post(f"/api/lessons/anatomy/{lesson['id']}/complete", headers=auth_headers)

        resp = client.get("/api/activity?limit=2", headers=auth_headers)
        assert len(resp.get_json()["activity"]) == 2