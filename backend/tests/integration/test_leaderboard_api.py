"""Integration tests for the leaderboard API endpoint."""
import pytest


def _seed_user(db, uid, xp, streak=0, display_name=None):
    with db.transaction() as conn:
        conn.execute(
            """
            INSERT INTO user_stats (uid, xp, streak, display_name)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(uid) DO UPDATE SET xp=excluded.xp, streak=excluded.streak
            """,
            (uid, xp, streak, display_name),
        )


class TestLeaderboard:
    def test_requires_auth(self, client):
        resp = client.get("/api/leaderboard")
        assert resp.status_code == 400

    def test_orders_by_xp_descending(self, client, auth_headers, db):
        _seed_user(db, "user-low", 50, display_name="Low XP")
        _seed_user(db, "user-high", 500, display_name="High XP")
        _seed_user(db, "user-mid", 200, display_name="Mid XP")

        resp = client.get("/api/leaderboard", headers=auth_headers)
        assert resp.status_code == 200

        entries = resp.get_json()["entries"]
        xps = [e["xp"] for e in entries]
        assert xps == sorted(xps, reverse=True)

    def test_includes_display_name_from_header(self, client, db):
        headers = {
            "X-User-UID": "user-named",
            "X-User-Name": "Camille Dupont",
            "X-User-Avatar": "",
        }
        # Toucher un endpoint authentifié suffit à faire persister le nom
        # (upsert_user_profile est appelé automatiquement dans la route).
        client.get("/api/leaderboard", headers=headers)

        resp = client.get("/api/leaderboard", headers=headers)
        entries = resp.get_json()["entries"]
        named = next(e for e in entries if e["uid"] == "user-named")
        assert named["displayName"] == "Camille Dupont"

    def test_response_includes_your_rank(self, client, auth_headers, uid, db):
        _seed_user(db, "user-a", 1000)
        _seed_user(db, "user-b", 900)
        _seed_user(db, uid, 500)

        resp = client.get("/api/leaderboard", headers=auth_headers)
        data = resp.get_json()

        assert data["yourUid"] == uid
        # Deux utilisateurs ont plus d'XP que nous : on est 3e.
        assert data["yourRank"] == 3

    def test_respects_limit_param(self, client, auth_headers, db):
        for i in range(5):
            _seed_user(db, f"user-{i}", xp=i * 10)

        resp = client.get("/api/leaderboard?limit=2", headers=auth_headers)
        assert len(resp.get_json()["entries"]) == 2

    def test_limit_is_capped(self, client, auth_headers, db):
        resp = client.get("/api/leaderboard?limit=9999", headers=auth_headers)
        assert resp.status_code == 200  # ne plante pas, juste plafonné


class TestAccountIncludesRank:
    def test_account_response_has_rank_field(self, client, auth_headers):
        resp = client.get("/api/account", headers=auth_headers)
        assert resp.status_code == 200
        assert "rank" in resp.get_json()["stats"]

    def test_rank_is_one_when_alone(self, client, auth_headers):
        resp = client.get("/api/account", headers=auth_headers)
        assert resp.get_json()["stats"]["rank"] == 1

    def test_rank_reflects_other_higher_xp_users(self, client, auth_headers, uid, db):
        _seed_user(db, "someone-better", xp=10_000)

        resp = client.get("/api/account", headers=auth_headers)
        assert resp.get_json()["stats"]["rank"] == 2