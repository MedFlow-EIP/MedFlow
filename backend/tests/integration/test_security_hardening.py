"""Durcissement : docs privées, CORS, nom affiché, avatars, recherche, débit."""
import io

import pytest


def _h(uid="u1", name="Testeur"):
    return {"X-User-UID": uid, "X-User-Name": name}


def test_api_docs_disabled_by_default(app):
    from app import create_app
    from config import ProductionConfig

    class Prod(ProductionConfig):
        DATABASE_PATH = app.config["DATABASE_PATH"]
        UPLOAD_FOLDER = app.config["UPLOAD_FOLDER"]
        ENABLE_API_DOCS = False

    prod = create_app(Prod)
    assert prod.test_client().get("/api/docs/").status_code == 404


def test_no_cors_header_without_configured_origin(app):
    from app import create_app
    from config import ProductionConfig

    class Prod(ProductionConfig):
        DATABASE_PATH = app.config["DATABASE_PATH"]
        UPLOAD_FOLDER = app.config["UPLOAD_FOLDER"]

    resp = create_app(Prod).test_client().get("/health", headers={"Origin": "https://evil.example"})
    assert "Access-Control-Allow-Origin" not in resp.headers


def test_display_name_is_cleaned(client, db):
    client.get("/api/account", headers=_h(name="Bob\x00\x07" + "x" * 100))
    with db.connection() as conn:
        name = conn.execute("SELECT display_name FROM user_stats WHERE uid='u1'").fetchone()[0]
    assert "\x00" not in name and len(name) == 60


class TestAvatar:
    def _upload(self, client, data, name="a.png"):
        return client.post(
            "/api/account/avatar",
            data={"file": (io.BytesIO(data), name)},
            headers=_h(),
            content_type="multipart/form-data",
        )

    def test_real_png_accepted(self, client):
        assert self._upload(client, b"\x89PNG\r\n\x1a\n" + b"\x00" * 32).status_code == 200

    def test_html_renamed_png_refused(self, client):
        assert self._upload(client, b"<html><script>alert(1)</script></html>").status_code == 400


class TestSearch:
    @pytest.fixture(autouse=True)
    def users(self, db):
        db.upsert_user_profile("alice", "Alice")
        db.upsert_user_profile("bob", "Bob_Martin")

    def _search(self, client, q):
        return client.get("/api/users/search", query_string={"q": q}, headers=_h())

    def test_wildcards_do_not_list_everyone(self, client):
        assert self._search(client, "%%").get_json()["results"] == []
        assert self._search(client, "__").get_json()["results"] == []

    def test_underscore_in_name_still_matches(self, client):
        assert [r["displayName"] for r in self._search(client, "b_M").get_json()["results"]] == ["Bob_Martin"]

    def test_too_short(self, client):
        assert self._search(client, "a").get_json()["results"] == []

    def test_rate_limited(self, client, app):
        app.config["SEARCH_PER_MINUTE"] = 2
        assert self._search(client, "Al").status_code == 200
        assert self._search(client, "Al").status_code == 200
        assert self._search(client, "Al").status_code == 429


def test_friend_requests_rate_limited(client, app, db):
    app.config["FRIEND_REQUESTS_PER_DAY"] = 1
    for uid in ("bob", "carol"):
        db.upsert_user_profile(uid, uid)
    assert client.post("/api/friends/request", json={"uid": "bob"}, headers=_h()).status_code == 200
    assert client.post("/api/friends/request", json={"uid": "carol"}, headers=_h()).status_code == 429
