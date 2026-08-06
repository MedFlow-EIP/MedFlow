"""Unit tests for the auth middleware."""
import pytest
from unittest.mock import patch


# ---------------------------------------------------------------------------
# Dev mode (FIREBASE_VERIFY=False) — X-User-UID header trusted
# ---------------------------------------------------------------------------

class TestDevModeAuth:
    def test_missing_uid_returns_400(self, client):
        resp = client.get("/api/dashboard")
        assert resp.status_code == 400
        assert "error" in resp.get_json()

    def test_uid_from_header(self, client):
        resp = client.get("/api/dashboard", headers={"X-User-UID": "user-abc"})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["user"]["uid"] == "user-abc"

    def test_uid_from_query_param(self, client):
        resp = client.get("/api/dashboard?uid=user-qp")
        assert resp.status_code == 200
        assert resp.get_json()["user"]["uid"] == "user-qp"

    def test_uid_from_json_body(self, client):
        resp = client.post(
            "/api/revision",
            json={"uid": "user-body", "mode": "all"},
        )
        # No courses exist yet — that's ok, we just need 400 for "no courses"
        # not 400 for "no UID"
        data = resp.get_json()
        assert "UID Firebase requis" not in data.get("error", "")

    def test_display_name_stored_in_g(self, client):
        resp = client.get(
            "/api/dashboard",
            headers={"X-User-UID": "u1", "X-User-Name": "Alice"},
        )
        data = resp.get_json()
        assert data["user"]["displayName"] == "Alice"

    def test_default_display_name_when_missing(self, client):
        resp = client.get("/api/dashboard", headers={"X-User-UID": "u1"})
        data = resp.get_json()
        assert data["user"]["displayName"] == "Utilisateur"


# ---------------------------------------------------------------------------
# Production mode (FIREBASE_VERIFY=True)
# ---------------------------------------------------------------------------

class TestProdModeAuth:
    @pytest.fixture
    def prod_client(self, tmp_path):
        """Flask test client with FIREBASE_VERIFY=True."""
        from app import create_app
        from config import TestingConfig
        from tests.mocks.mock_ai import MockAIProvider

        class ProdTestConfig(TestingConfig):
            FIREBASE_VERIFY = True
            DATABASE_PATH = str(tmp_path / "prod_test.db")
            UPLOAD_FOLDER = str(tmp_path / "uploads")

        application = create_app(ProdTestConfig)
        application.ai = MockAIProvider()
        return application.test_client()

    def test_missing_bearer_returns_400(self, prod_client):
        resp = prod_client.get("/api/dashboard")
        assert resp.status_code == 400

    def test_x_user_uid_header_not_accepted_in_prod_mode(self, prod_client):
        """In production mode, raw X-User-UID should NOT grant access."""
        resp = prod_client.get("/api/dashboard", headers={"X-User-UID": "hacker"})
        assert resp.status_code == 400

    def test_valid_bearer_token_accepted(self, prod_client):
        with patch("middleware.auth._verify_firebase_token", return_value="verified-uid"):
            resp = prod_client.get(
                "/api/dashboard",
                headers={"Authorization": "Bearer valid-token"},
            )
        assert resp.status_code == 200
        assert resp.get_json()["user"]["uid"] == "verified-uid"

    def test_invalid_bearer_token_returns_400(self, prod_client):
        with patch("middleware.auth._verify_firebase_token", return_value=None):
            resp = prod_client.get(
                "/api/dashboard",
                headers={"Authorization": "Bearer bad-token"},
            )
        assert resp.status_code == 400
