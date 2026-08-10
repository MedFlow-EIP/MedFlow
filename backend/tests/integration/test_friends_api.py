"""Integration tests for the friends system."""
import pytest


def _headers(uid, name):
    return {"X-User-UID": uid, "X-User-Name": name}


def _seed_xp(db, uid, xp):
    with db.transaction() as conn:
        conn.execute(
            "INSERT INTO user_stats (uid, xp, streak) VALUES (?, ?, 0) "
            "ON CONFLICT(uid) DO UPDATE SET xp=excluded.xp",
            (uid, xp),
        )


class TestSearchUsers:
    def test_requires_auth(self, client):
        resp = client.get("/api/users/search?q=test")
        assert resp.status_code == 400

    def test_finds_user_by_partial_name(self, client, db):
        client.get("/api/users/search?q=x", headers=_headers("alice-1", "Alice Dupont"))
        client.get("/api/users/search?q=x", headers=_headers("bob-1", "Bob Martin"))

        resp = client.get("/api/users/search?q=Alice", headers=_headers("searcher", "Searcher"))
        results = resp.get_json()["results"]
        assert any(r["uid"] == "alice-1" for r in results)
        assert not any(r["uid"] == "bob-1" for r in results)

    def test_excludes_self_from_results(self, client, db):
        headers = _headers("self-1", "MoiMeme")
        client.get("/api/users/search?q=x", headers=headers)

        resp = client.get("/api/users/search?q=MoiMeme", headers=headers)
        results = resp.get_json()["results"]
        assert not any(r["uid"] == "self-1" for r in results)

    def test_empty_query_returns_empty(self, client, auth_headers):
        resp = client.get("/api/users/search?q=", headers=auth_headers)
        assert resp.get_json()["results"] == []


class TestFriendRequests:
    def test_send_request_creates_pending(self, client, db):
        client.get("/api/users/search?q=x", headers=_headers("u-a", "A"))
        client.get("/api/users/search?q=x", headers=_headers("u-b", "B"))

        resp = client.post(
            "/api/friends/request", headers=_headers("u-a", "A"), json={"uid": "u-b"}
        )
        assert resp.status_code == 200
        assert resp.get_json()["status"] == "pending"

    def test_mutual_request_auto_accepts(self, client, db):
        client.get("/api/users/search?q=x", headers=_headers("u-a", "A"))
        client.get("/api/users/search?q=x", headers=_headers("u-b", "B"))

        client.post("/api/friends/request", headers=_headers("u-a", "A"), json={"uid": "u-b"})
        resp = client.post(
            "/api/friends/request", headers=_headers("u-b", "B"), json={"uid": "u-a"}
        )
        assert resp.get_json()["status"] == "accepted"

        friends_a = client.get("/api/friends", headers=_headers("u-a", "A")).get_json()["friends"]
        assert any(f["uid"] == "u-b" for f in friends_a)

    def test_cannot_add_self(self, client, auth_headers, uid):
        resp = client.post("/api/friends/request", headers=auth_headers, json={"uid": uid})
        assert resp.status_code == 400

    def test_accept_request_makes_them_friends(self, client, db):
        client.get("/api/users/search?q=x", headers=_headers("u-a", "A"))
        client.get("/api/users/search?q=x", headers=_headers("u-b", "B"))

        client.post("/api/friends/request", headers=_headers("u-a", "A"), json={"uid": "u-b"})
        client.post(
            "/api/friends/respond",
            headers=_headers("u-b", "B"),
            json={"uid": "u-a", "accept": True},
        )

        friends_b = client.get("/api/friends", headers=_headers("u-b", "B")).get_json()["friends"]
        assert any(f["uid"] == "u-a" for f in friends_b)

    def test_decline_request_removes_it(self, client, db):
        client.get("/api/users/search?q=x", headers=_headers("u-a", "A"))
        client.get("/api/users/search?q=x", headers=_headers("u-b", "B"))

        client.post("/api/friends/request", headers=_headers("u-a", "A"), json={"uid": "u-b"})
        client.post(
            "/api/friends/respond",
            headers=_headers("u-b", "B"),
            json={"uid": "u-a", "accept": False},
        )

        friends_b = client.get("/api/friends", headers=_headers("u-b", "B")).get_json()["friends"]
        assert not any(f["uid"] == "u-a" for f in friends_b)

    def test_pending_requests_appear_in_received_and_sent(self, client, db):
        client.get("/api/users/search?q=x", headers=_headers("u-a", "A"))
        client.get("/api/users/search?q=x", headers=_headers("u-b", "B"))

        client.post("/api/friends/request", headers=_headers("u-a", "A"), json={"uid": "u-b"})

        received_b = client.get(
            "/api/friends/requests", headers=_headers("u-b", "B")
        ).get_json()["received"]
        assert any(r["uid"] == "u-a" for r in received_b)

        sent_a = client.get(
            "/api/friends/requests", headers=_headers("u-a", "A")
        ).get_json()["sent"]
        assert any(r["uid"] == "u-b" for r in sent_a)

    def test_search_reflects_friendship_status(self, client, db):
        client.get("/api/users/search?q=x", headers=_headers("u-a", "A"))
        client.get("/api/users/search?q=x", headers=_headers("u-b", "B"))

        client.post("/api/friends/request", headers=_headers("u-a", "A"), json={"uid": "u-b"})

        results = client.get(
            "/api/users/search?q=B", headers=_headers("u-a", "A")
        ).get_json()["results"]
        b_result = next(r for r in results if r["uid"] == "u-b")
        assert b_result["friendshipStatus"] == "request_sent"

        results_from_b = client.get(
            "/api/users/search?q=A", headers=_headers("u-b", "B")
        ).get_json()["results"]
        a_result = next(r for r in results_from_b if r["uid"] == "u-a")
        assert a_result["friendshipStatus"] == "request_received"


class TestRemoveFriend:
    def test_removes_confirmed_friendship(self, client, db):
        client.get("/api/users/search?q=x", headers=_headers("u-a", "A"))
        client.get("/api/users/search?q=x", headers=_headers("u-b", "B"))
        client.post("/api/friends/request", headers=_headers("u-a", "A"), json={"uid": "u-b"})
        client.post(
            "/api/friends/respond",
            headers=_headers("u-b", "B"),
            json={"uid": "u-a", "accept": True},
        )

        client.delete("/api/friends/u-b", headers=_headers("u-a", "A"))

        friends_a = client.get("/api/friends", headers=_headers("u-a", "A")).get_json()["friends"]
        assert not any(f["uid"] == "u-b" for f in friends_a)


class TestFriendsLeaderboard:
    def test_requires_auth(self, client):
        resp = client.get("/api/friends/leaderboard")
        assert resp.status_code == 400

    def test_includes_self_even_with_no_friends(self, client, auth_headers, uid):
        resp = client.get("/api/friends/leaderboard", headers=auth_headers)
        entries = resp.get_json()["entries"]
        assert any(e["uid"] == uid for e in entries)

    def test_only_includes_friends_not_everyone(self, client, db):
        client.get("/api/users/search?q=x", headers=_headers("u-a", "A"))
        client.get("/api/users/search?q=x", headers=_headers("u-b", "B"))
        client.get("/api/users/search?q=x", headers=_headers("u-stranger", "Stranger"))
        _seed_xp(db, "u-stranger", 99999)

        client.post("/api/friends/request", headers=_headers("u-a", "A"), json={"uid": "u-b"})
        client.post(
            "/api/friends/respond",
            headers=_headers("u-b", "B"),
            json={"uid": "u-a", "accept": True},
        )

        entries = client.get(
            "/api/friends/leaderboard", headers=_headers("u-a", "A")
        ).get_json()["entries"]

        uids = [e["uid"] for e in entries]
        assert "u-a" in uids
        assert "u-b" in uids
        assert "u-stranger" not in uids

    def test_ordered_by_xp_descending(self, client, db):
        client.get("/api/users/search?q=x", headers=_headers("u-a", "A"))
        client.get("/api/users/search?q=x", headers=_headers("u-b", "B"))
        client.post("/api/friends/request", headers=_headers("u-a", "A"), json={"uid": "u-b"})
        client.post(
            "/api/friends/respond",
            headers=_headers("u-b", "B"),
            json={"uid": "u-a", "accept": True},
        )
        _seed_xp(db, "u-a", 10)
        _seed_xp(db, "u-b", 500)

        entries = client.get(
            "/api/friends/leaderboard", headers=_headers("u-a", "A")
        ).get_json()["entries"]

        xps = [e["xp"] for e in entries]
        assert xps == sorted(xps, reverse=True)