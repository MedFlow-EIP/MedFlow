"""Integration tests for weekly goal and league tier features."""
import pytest


def _complete_lesson(client, auth_headers, db, uid, index=0):
    client.get("/api/paths", headers=auth_headers)
    lessons = db.fetch_path_lessons(uid, "anatomy")
    return client.post(
        f"/api/lessons/anatomy/{lessons[index]['id']}/complete", headers=auth_headers
    )


class TestWeeklyGoal:
    def test_account_response_includes_weekly_fields(self, client, auth_headers):
        resp = client.get("/api/account", headers=auth_headers)
        stats = resp.get_json()["stats"]
        assert "weeklyGoal" in stats
        assert "weeklyProgress" in stats

    def test_progress_zero_for_new_user(self, client, auth_headers):
        resp = client.get("/api/account", headers=auth_headers)
        assert resp.get_json()["stats"]["weeklyProgress"] == 0

    def test_progress_increments_with_lesson_completion(
        self, client, auth_headers, db, uid
    ):
        _complete_lesson(client, auth_headers, db, uid, index=0)

        resp = client.get("/api/account", headers=auth_headers)
        assert resp.get_json()["stats"]["weeklyProgress"] == 1

    def test_progress_counts_multiple_lessons_this_week(
        self, client, auth_headers, db, uid
    ):
        _complete_lesson(client, auth_headers, db, uid, index=0)
        _complete_lesson(client, auth_headers, db, uid, index=1)

        resp = client.get("/api/account", headers=auth_headers)
        assert resp.get_json()["stats"]["weeklyProgress"] == 2

    def test_old_activity_outside_this_week_not_counted(self, client, auth_headers, db, uid):
        from datetime import date, timedelta

        with db.transaction() as conn:
            eight_days_ago = (date.today() - timedelta(days=8)).isoformat()
            conn.execute(
                """
                INSERT INTO activity_log (uid, type, title, detail, xp_gained, created_at)
                VALUES (?, 'lesson_completed', 'Vieille leçon', '', 10, ?)
                """,
                (uid, eight_days_ago),
            )

        resp = client.get("/api/account", headers=auth_headers)
        assert resp.get_json()["stats"]["weeklyProgress"] == 0


class TestLeagueTiers:
    def test_account_response_includes_league(self, client, auth_headers):
        resp = client.get("/api/account", headers=auth_headers)
        stats = resp.get_json()["stats"]
        assert "league" in stats
        assert "name" in stats["league"]
        assert "color" in stats["league"]

    def test_new_user_is_bronze(self, client, auth_headers):
        resp = client.get("/api/account", headers=auth_headers)
        assert resp.get_json()["stats"]["league"]["id"] == "bronze"

    def test_league_upgrades_with_xp(self, client, auth_headers, db, uid):
        with db.transaction() as conn:
            conn.execute(
                "INSERT INTO user_stats (uid, xp, streak) VALUES (?, 600, 0) "
                "ON CONFLICT(uid) DO UPDATE SET xp=excluded.xp",
                (uid,),
            )

        resp = client.get("/api/account", headers=auth_headers)
        assert resp.get_json()["stats"]["league"]["id"] == "gold"

    def test_league_shows_next_tier_progress(self, client, auth_headers, db, uid):
        with db.transaction() as conn:
            conn.execute(
                "INSERT INTO user_stats (uid, xp, streak) VALUES (?, 50, 0) "
                "ON CONFLICT(uid) DO UPDATE SET xp=excluded.xp",
                (uid,),
            )

        resp = client.get("/api/account", headers=auth_headers)
        league = resp.get_json()["stats"]["league"]
        assert league["nextLeagueName"] == "Argent"
        assert league["xpToNextLeague"] == 50

    def test_top_league_has_no_next_tier(self, client, auth_headers, db, uid):
        with db.transaction() as conn:
            conn.execute(
                "INSERT INTO user_stats (uid, xp, streak) VALUES (?, 5000, 0) "
                "ON CONFLICT(uid) DO UPDATE SET xp=excluded.xp",
                (uid,),
            )

        resp = client.get("/api/account", headers=auth_headers)
        league = resp.get_json()["stats"]["league"]
        assert league["id"] == "diamond"
        assert league["nextLeagueName"] is None


class TestLastActivityField:
    def test_null_for_new_user(self, client, auth_headers):
        resp = client.get("/api/account", headers=auth_headers)
        assert resp.get_json()["stats"]["lastActivity"] is None

    def test_set_after_completing_a_lesson(self, client, auth_headers, db, uid):
        from datetime import date

        _complete_lesson(client, auth_headers, db, uid, index=0)

        resp = client.get("/api/account", headers=auth_headers)
        assert resp.get_json()["stats"]["lastActivity"] == date.today().isoformat()