"""Integration tests for the avatar upload/serving endpoints."""
import io

import pytest


class TestUploadAvatar:
    def test_requires_auth(self, client):
        data = {"file": (io.BytesIO(b"fake image bytes"), "avatar.jpg")}
        resp = client.post(
            "/api/account/avatar", data=data, content_type="multipart/form-data"
        )
        assert resp.status_code == 400

    def test_rejects_missing_file(self, client, auth_headers):
        resp = client.post("/api/account/avatar", headers=auth_headers, data={})
        assert resp.status_code == 400
        assert "error" in resp.get_json()

    def test_rejects_disallowed_extension(self, client, auth_headers):
        data = {"file": (io.BytesIO(b"not an image"), "avatar.exe")}
        resp = client.post(
            "/api/account/avatar",
            headers=auth_headers,
            data=data,
            content_type="multipart/form-data",
        )
        assert resp.status_code == 400

    def test_accepts_valid_image_and_returns_url(self, client, auth_headers):
        data = {"file": (io.BytesIO(b"\xff\xd8\xff fake jpeg bytes"), "avatar.jpg")}
        resp = client.post(
            "/api/account/avatar",
            headers=auth_headers,
            data=data,
            content_type="multipart/form-data",
        )
        assert resp.status_code == 200

        body = resp.get_json()
        assert "avatarUrl" in body
        assert body["avatarUrl"].endswith("/avatars/test-user-123.jpg")

    def test_avatar_url_persisted_and_shown_in_leaderboard(self, client, auth_headers, uid):
        data = {"file": (io.BytesIO(b"\xff\xd8\xff fake jpeg"), "avatar.jpg")}
        upload_resp = client.post(
            "/api/account/avatar",
            headers=auth_headers,
            data=data,
            content_type="multipart/form-data",
        )
        avatar_url = upload_resp.get_json()["avatarUrl"]

        entries = client.get("/api/leaderboard", headers=auth_headers).get_json()["entries"]
        me = next(e for e in entries if e["uid"] == uid)
        assert me["avatarUrl"] == avatar_url

    def test_uploaded_avatar_is_servable(self, client, auth_headers):
        content = b"\xff\xd8\xff real-ish jpeg content"
        data = {"file": (io.BytesIO(content), "avatar.jpg")}
        client.post(
            "/api/account/avatar",
            headers=auth_headers,
            data=data,
            content_type="multipart/form-data",
        )

        resp = client.get("/avatars/test-user-123.jpg")
        assert resp.status_code == 200
        assert resp.data == content

    def test_reuploading_different_extension_removes_old_file(
        self, client, auth_headers, app
    ):
        import os

        png_data = {"file": (io.BytesIO(b"fake png"), "avatar.png")}
        client.post(
            "/api/account/avatar",
            headers=auth_headers,
            data=png_data,
            content_type="multipart/form-data",
        )

        jpg_data = {"file": (io.BytesIO(b"fake jpg"), "avatar.jpg")}
        client.post(
            "/api/account/avatar",
            headers=auth_headers,
            data=jpg_data,
            content_type="multipart/form-data",
        )

        avatars_folder = os.path.join(app.config["UPLOAD_FOLDER"], "avatars")
        assert not os.path.exists(os.path.join(avatars_folder, "test-user-123.png"))
        assert os.path.exists(os.path.join(avatars_folder, "test-user-123.jpg"))


class TestServeAvatar:
    def test_returns_404_for_nonexistent_avatar(self, client):
        resp = client.get("/avatars/nobody-uploaded-this.jpg")
        assert resp.status_code == 404

    def test_does_not_require_auth(self, client, auth_headers):
        data = {"file": (io.BytesIO(b"\xff\xd8\xff"), "avatar.jpg")}
        client.post(
            "/api/account/avatar",
            headers=auth_headers,
            data=data,
            content_type="multipart/form-data",
        )

        # Pas de headers d'auth ici : doit quand même répondre, comme
        # n'importe quelle URL de CDN public.
        resp = client.get("/avatars/test-user-123.jpg")
        assert resp.status_code == 200