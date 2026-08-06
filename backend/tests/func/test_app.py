"""Functional tests — kept for backward compatibility.

These tests preserve the original test intent but have been updated to use the
new ``create_app()`` factory instead of importing the module-level ``app``
object directly.
"""
import os
import sys

import pytest

# Ensure backend root is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))


@pytest.fixture
def test_app(tmp_path):
    """Create a test Flask app with a temporary SQLite database."""
    from app import create_app
    from config import TestingConfig
    from tests.mocks.mock_ai import MockAIProvider

    class _Cfg(TestingConfig):
        DATABASE_PATH = str(tmp_path / "api_test.db")
        UPLOAD_FOLDER = str(tmp_path / "uploads")

    application = create_app(_Cfg)
    application.ai = MockAIProvider()
    application.config["TESTING"] = True
    return application, application.db


def test_dashboard_requires_uid_header(test_app):
    app, _ = test_app
    client = app.test_client()

    resp = client.get("/api/dashboard")
    assert resp.status_code == 400
    data = resp.get_json()
    assert "error" in data


def test_dashboard_empty_user_returns_zero_stats(test_app):
    app, _ = test_app
    client = app.test_client()

    resp = client.get("/api/dashboard", headers={"X-User-UID": "user-1"})
    assert resp.status_code == 200

    data = resp.get_json()
    assert data["user"]["uid"] == "user-1"
    assert data["stats"]["cours"] == 0
    assert data["stats"]["sessions"] == 0
    assert data["stats"]["flashcards"] == 0


def test_session_done_course_mode_creates_session_and_updates_course(test_app):
    app, db = test_app
    client = app.test_client()

    db.save_course(
        "user-1",
        "course-1",
        {
            "nom": "Cours test",
            "summary": "",
            "flashcards": [],
            "quiz": [],
            "sessions": 0,
        },
    )

    payload = {
        "uid": "user-1",
        "mode": "course",
        "course_id": "course-1",
        "session_type": "quiz",
        "score": 8,
        "total_questions": 10,
    }

    resp = client.post("/api/session-done", json=payload)
    assert resp.status_code == 200
    assert resp.get_json()["status"] == "ok"

    stats = db.get_user_session_stats("user-1", "course-1")
    assert stats["total_sessions"] == 1
    assert stats["quiz_sessions"] == 1
    assert stats["avg_score"] == 8.0

    course = db.fetch_course("user-1", "course-1")
    assert course.sessions == 1
