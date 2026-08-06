"""Unit tests for the Database class."""
import pytest
from database import Database, Course


def _make_db(tmp_path) -> Database:
    db = Database(str(tmp_path / "test.db"))
    db.initialise()
    return db


# ---------------------------------------------------------------------------
# Course CRUD
# ---------------------------------------------------------------------------

def test_save_and_fetch_course(tmp_path):
    db = _make_db(tmp_path)
    payload = {
        "nom": "Cardiologie",
        "summary": "<p>ok</p>",
        "flashcards": [{"question": "Q", "answer": "A"}],
        "quiz": [{"question": "QCM", "options": {"A": "x"}, "correct": "A"}],
        "sessions": 0,
    }
    db.save_course("u1", "c1", payload)
    course = db.fetch_course("u1", "c1")
    assert course is not None
    assert course.id == "c1"
    assert course.nom == "Cardiologie"
    assert len(course.flashcards) == 1


def test_fetch_course_not_found(tmp_path):
    db = _make_db(tmp_path)
    assert db.fetch_course("u1", "nonexistent") is None


def test_fetch_courses_returns_list(tmp_path):
    db = _make_db(tmp_path)
    for i in range(3):
        db.save_course("u1", f"c{i}", {"nom": f"Cours {i}", "summary": "", "flashcards": [], "quiz": [], "sessions": 0})
    courses = db.fetch_courses("u1")
    assert len(courses) == 3


def test_fetch_courses_isolated_by_uid(tmp_path):
    db = _make_db(tmp_path)
    db.save_course("u1", "c1", {"nom": "A", "summary": "", "flashcards": [], "quiz": [], "sessions": 0})
    db.save_course("u2", "c1", {"nom": "B", "summary": "", "flashcards": [], "quiz": [], "sessions": 0})
    assert len(db.fetch_courses("u1")) == 1
    assert len(db.fetch_courses("u2")) == 1


def test_delete_course(tmp_path):
    db = _make_db(tmp_path)
    db.save_course("u1", "c1", {"nom": "X", "summary": "", "flashcards": [], "quiz": [], "sessions": 0})
    assert db.fetch_course("u1", "c1") is not None
    db.delete_course("u1", "c1")
    assert db.fetch_course("u1", "c1") is None


def test_delete_course_not_found_returns_false(tmp_path):
    db = _make_db(tmp_path)
    result = db.delete_course("u1", "no-such-course")
    assert result is False


def test_fetch_courses_paginated(tmp_path):
    db = _make_db(tmp_path)
    for i in range(5):
        db.save_course("u1", f"c{i}", {"nom": f"Cours {i}", "summary": "", "flashcards": [], "quiz": [], "sessions": 0})
    page1, total = db.fetch_courses_paginated("u1", page=1, per_page=3)
    assert total == 5
    assert len(page1) == 3
    page2, _ = db.fetch_courses_paginated("u1", page=2, per_page=3)
    assert len(page2) == 2


def test_upsert_course(tmp_path):
    db = _make_db(tmp_path)
    db.save_course("u1", "c1", {"nom": "Original", "summary": "", "flashcards": [], "quiz": [], "sessions": 0})
    db.save_course("u1", "c1", {"nom": "Updated", "summary": "", "flashcards": [], "quiz": [], "sessions": 0})
    course = db.fetch_course("u1", "c1")
    assert course.nom == "Updated"


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------

def test_create_session_record(tmp_path):
    db = _make_db(tmp_path)
    db.create_session_record("u1", None, "revision", 8, 10)
    stats = db.get_user_session_stats("u1")
    assert stats["total_sessions"] == 1
    assert stats["revision_sessions"] == 1
    assert stats["avg_score"] == 8.0


def test_get_session_stats_empty(tmp_path):
    db = _make_db(tmp_path)
    stats = db.get_user_session_stats("no-user")
    assert stats["total_sessions"] == 0
    assert stats["avg_score"] == 0


def test_increment_sessions(tmp_path):
    db = _make_db(tmp_path)
    db.save_course("u1", "c1", {"nom": "X", "summary": "", "flashcards": [], "quiz": [], "sessions": 0})
    ok = db.increment_sessions("u1", "c1")
    assert ok is True
    assert db.fetch_course("u1", "c1").sessions == 1


def test_session_stats_by_type(tmp_path):
    db = _make_db(tmp_path)
    db.create_session_record("u1", None, "quiz", 5, 10)
    db.create_session_record("u1", None, "flashcards", None, None)
    stats = db.get_user_session_stats("u1")
    assert stats["quiz_sessions"] == 1
    assert stats["flashcard_sessions"] == 1
    assert stats["total_sessions"] == 2


# ---------------------------------------------------------------------------
# Paths & lessons
# ---------------------------------------------------------------------------

def test_ensure_user_lessons_creates_entries(tmp_path):
    db = _make_db(tmp_path)
    db.ensure_user_lessons("u1")
    paths = db.fetch_user_paths("u1")
    assert len(paths) > 0
    # First path should not be locked (it's the first one)
    assert paths[0]["isLocked"] is False


def test_fetch_path_lessons(tmp_path):
    db = _make_db(tmp_path)
    db.ensure_user_lessons("u1")
    lessons = db.fetch_path_lessons("u1", "anatomy")
    assert len(lessons) == 10
    assert lessons[0]["status"] == "available"
    # All others start locked
    assert all(l["status"] == "locked" for l in lessons[1:])


def test_complete_lesson_unlocks_next(tmp_path):
    db = _make_db(tmp_path)
    db.ensure_user_lessons("u1")
    lessons_before = db.fetch_path_lessons("u1", "anatomy")
    first_id = lessons_before[0]["id"]
    second_id = lessons_before[1]["id"]
    assert lessons_before[1]["status"] == "locked"
    db.complete_lesson("u1", first_id)
    lessons_after = db.fetch_path_lessons("u1", "anatomy")
    second_after = next(l for l in lessons_after if l["id"] == second_id)
    assert second_after["status"] == "available"
