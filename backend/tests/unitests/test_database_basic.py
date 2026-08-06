import json
from pathlib import Path

from database import Database


def _make_db(tmp_path) -> Database:
    """Crée une base SQLite de test dans un fichier temporaire."""
    db_file = tmp_path / "test_medflow.db"
    db = Database(str(db_file))
    db.initialise()
    return db


def test_save_and_fetch_course_roundtrip(tmp_path):
    db = _make_db(tmp_path)

    payload = {
        "nom": "Cardiologie - Test",
        "summary": "<p>Résumé</p>",
        "flashcards": [{"question": "Q1", "answer": "R1"}],
        "quiz": [
            {
                "question": "Question ?",
                "options": {"A": "1", "B": "2", "C": "3", "D": "4"},
                "correct": "A",
            }
        ],
        "sessions": 2,
    }

    db.save_course("user-1", "course-1", payload)

    course = db.fetch_course("user-1", "course-1")

    assert course is not None
    assert course.id == "course-1"
    assert course.nom == "Cardiologie - Test"
    assert course.sessions == 2
    assert course.flashcards[0]["question"] == "Q1"
    assert course.quiz[0]["correct"] == "A"


def test_create_session_and_stats(tmp_path):
    db = _make_db(tmp_path)

    stats_empty = db.get_user_session_stats("user-1")
    assert stats_empty["total_sessions"] == 0
    assert stats_empty["avg_score"] == 0

    db.create_session_record(
        uid="user-1",
        course_id=None,
        session_type="quiz",
        score=80,
        total_questions=10,
    )

    stats = db.get_user_session_stats("user-1")
    assert stats["total_sessions"] == 1
    assert stats["quiz_sessions"] == 1
    assert stats["avg_score"] == 80.0


def test_increment_sessions_updates_course(tmp_path):
    db = _make_db(tmp_path)

    payload = {
        "nom": "Cours test",
        "summary": "",
        "flashcards": [],
        "quiz": [],
        "sessions": 0,
    }
    db.save_course("user-1", "course-1", payload)

    ok = db.increment_sessions("user-1", "course-1")
    assert ok is True

    course = db.fetch_course("user-1", "course-1")
    assert course.sessions == 1
