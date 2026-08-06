"""Shared pytest fixtures for the MEDFLOW test suite.

All tests use an in-memory SQLite database and a MockAIProvider so that
no real network calls are ever made during testing.
"""
import io
import os
import sys

import pytest

# Ensure the backend root is on sys.path so all imports resolve correctly.
BACKEND_ROOT = os.path.join(os.path.dirname(__file__), "..")
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)


# ---------------------------------------------------------------------------
# App fixture
# ---------------------------------------------------------------------------

@pytest.fixture(scope="function")
def app(tmp_path):
    """Create a fresh Flask test app with a per-test temporary SQLite database."""
    from app import create_app
    from config import TestingConfig
    from tests.mocks.mock_ai import MockAIProvider

    class _TestConfig(TestingConfig):
        DATABASE_PATH = str(tmp_path / "test_medflow.db")
        UPLOAD_FOLDER = str(tmp_path / "uploads")

    application = create_app(_TestConfig)
    application.ai = MockAIProvider()
    yield application


@pytest.fixture(scope="function")
def client(app):
    """Flask test client."""
    return app.test_client()


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

@pytest.fixture
def uid():
    return "test-user-123"


@pytest.fixture
def auth_headers(uid):
    """Legacy X-User-UID headers (FIREBASE_VERIFY=False in TestingConfig)."""
    return {
        "X-User-UID": uid,
        "X-User-Name": "Test User",
        "X-User-Avatar": "",
    }


# ---------------------------------------------------------------------------
# Database fixture (direct access, no HTTP)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="function")
def db(app):
    """Direct access to the app's database instance."""
    return app.db


# ---------------------------------------------------------------------------
# Sample data helpers
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_course_payload():
    return {
        "nom": "Cardiologie - Test",
        "summary": "<p>Résumé de test</p>",
        "flashcards": [
            {"question": "Q1", "answer": "R1"},
            {"question": "Q2", "answer": "R2"},
        ],
        "quiz": [
            {
                "question": "Question ?",
                "options": {"A": "1", "B": "2", "C": "3", "D": "4"},
                "correct": "A",
            }
        ],
        "sessions": 0,
    }


@pytest.fixture
def seeded_course(db, uid, sample_course_payload):
    """Insert a sample course into the DB and return its ID."""
    course_id = "test-course-id"
    db.save_course(uid, course_id, sample_course_payload)
    return course_id


@pytest.fixture
def minimal_pdf_bytes():
    """Minimal valid PDF binary (one blank page)."""
    return (
        b"%PDF-1.4\n"
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n"
        b"xref\n0 4\n"
        b"0000000000 65535 f \n"
        b"0000000009 00000 n \n"
        b"0000000058 00000 n \n"
        b"0000000115 00000 n \n"
        b"trailer\n<< /Size 4 /Root 1 0 R >>\n"
        b"startxref\n190\n%%EOF\n"
    )
