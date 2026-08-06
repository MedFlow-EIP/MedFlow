"""Mock Firebase token verifier for testing auth middleware."""
import pytest

VALID_TOKEN = "valid-test-token"
TEST_UID = "test-user-firebase-uid"


def mock_verify_id_token(token: str) -> dict:
    """Simulates firebase_admin.auth.verify_id_token.

    Only the token value ``VALID_TOKEN`` is accepted; anything else raises
    a generic Exception to simulate an invalid / expired token.
    """
    if token == VALID_TOKEN:
        return {"uid": TEST_UID, "email": "test@example.com"}
    raise Exception(f"Invalid token: {token!r}")


@pytest.fixture
def patch_firebase_verify(monkeypatch):
    """Monkeypatch firebase_admin.auth.verify_id_token with mock_verify_id_token."""
    import unittest.mock as mock
    with mock.patch("middleware.auth._verify_firebase_token", return_value=TEST_UID):
        yield
