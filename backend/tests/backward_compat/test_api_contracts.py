"""Backward-compatibility contract tests.

These tests verify that all API response schemas exactly match what the
existing frontend (React) and mobile (React Native) apps expect.
They act as a regression guard: any schema change that would break
an existing client will be caught here first.
"""
import pytest


AUTH = {"X-User-UID": "compat-user", "X-User-Name": "Compat User"}


# ---------------------------------------------------------------------------
# Helper to seed a course
# ---------------------------------------------------------------------------

@pytest.fixture
def seeded_compat_course(db):
    uid = "compat-user"
    course_id = "compat-course-1"
    db.save_course(uid, course_id, {
        "nom": "Cardiologie - Compat Test",
        "summary": "<h2>Test</h2><p>Summary</p>",
        "flashcards": [
            {"question": "Q1", "answer": "A1"},
            {"question": "Q2", "answer": "A2"},
        ],
        "quiz": [
            {
                "question": "QCM 1",
                "options": {"A": "Opt A", "B": "Opt B", "C": "Opt C", "D": "Opt D"},
                "correct": "B",
            }
        ],
        "sessions": 3,
    })
    return course_id


# ---------------------------------------------------------------------------
# GET /api/dashboard — used by Dashboard.jsx (frontend) and DashboardScreen.tsx (mobile)
# ---------------------------------------------------------------------------

class TestDashboardContract:
    def test_top_level_keys(self, client, seeded_compat_course):
        resp = client.get("/api/dashboard", headers=AUTH)
        data = resp.get_json()
        assert "user" in data
        assert "cours" in data
        assert "stats" in data

    def test_user_object_shape(self, client, seeded_compat_course):
        resp = client.get("/api/dashboard", headers=AUTH)
        user = resp.get_json()["user"]
        assert "uid" in user
        assert "displayName" in user
        assert "photoURL" in user
        assert user["uid"] == "compat-user"
        assert user["displayName"] == "Compat User"

    def test_cours_item_shape(self, client, seeded_compat_course):
        resp = client.get("/api/dashboard", headers=AUTH)
        cours_list = resp.get_json()["cours"]
        assert len(cours_list) == 1
        item = cours_list[0]
        # Frontend accesses: item.id, item.nom, item.sessions
        assert "id" in item
        assert "nom" in item
        assert "sessions" in item
        assert isinstance(item["id"], str)
        assert isinstance(item["nom"], str)
        assert isinstance(item["sessions"], int)

    def test_stats_shape(self, client, seeded_compat_course):
        resp = client.get("/api/dashboard", headers=AUTH)
        stats = resp.get_json()["stats"]
        # Frontend accesses: stats.cours, stats.flashcards, stats.sessions
        assert "cours" in stats
        assert "flashcards" in stats
        assert "sessions" in stats
        assert isinstance(stats["cours"], int)
        assert isinstance(stats["flashcards"], int)
        assert isinstance(stats["sessions"], int)


# ---------------------------------------------------------------------------
# GET /api/course/{id} — used by Dashboard.jsx
# ---------------------------------------------------------------------------

class TestCourseContract:
    def test_top_level_keys(self, client, seeded_compat_course):
        resp = client.get(f"/api/course/{seeded_compat_course}", headers=AUTH)
        data = resp.get_json()
        # Frontend accesses: .nom, .flashcards, .quiz, .summary, .id
        for key in ("id", "nom", "summary", "flashcards", "quiz"):
            assert key in data, f"Missing key: {key}"

    def test_flashcard_shape(self, client, seeded_compat_course):
        resp = client.get(f"/api/course/{seeded_compat_course}", headers=AUTH)
        flashcards = resp.get_json()["flashcards"]
        for card in flashcards:
            assert "question" in card
            assert "answer" in card

    def test_quiz_question_shape(self, client, seeded_compat_course):
        resp = client.get(f"/api/course/{seeded_compat_course}", headers=AUTH)
        quiz = resp.get_json()["quiz"]
        for q in quiz:
            assert "question" in q
            assert "options" in q
            assert "correct" in q
            # Mobile app uses options as Record<string, string>
            assert isinstance(q["options"], dict)


# ---------------------------------------------------------------------------
# POST /api/revision — used by Dashboard.jsx and RevisionPage.jsx (frontend)
# ---------------------------------------------------------------------------

class TestRevisionContract:
    def test_response_shape_course_mode(self, client, seeded_compat_course):
        resp = client.post(
            "/api/revision",
            json={"mode": "course", "course_id": seeded_compat_course},
            headers=AUTH,
        )
        assert resp.status_code == 200
        data = resp.get_json()
        # Frontend reads: data.flashcards, data.quiz, data.mode, data.course_id
        assert "flashcards" in data
        assert "quiz" in data
        assert "mode" in data
        assert "course_id" in data
        assert data["mode"] == "course"

    def test_response_shape_all_mode(self, client, seeded_compat_course):
        resp = client.post(
            "/api/revision",
            json={"mode": "all"},
            headers=AUTH,
        )
        data = resp.get_json()
        assert "flashcards" in data
        assert "quiz" in data
        assert data["mode"] == "all"
        # course_id should NOT be present in all mode
        assert "course_id" not in data

    def test_flashcard_shape_in_revision(self, client, seeded_compat_course):
        resp = client.post(
            "/api/revision",
            json={"mode": "course", "course_id": seeded_compat_course},
            headers=AUTH,
        )
        for card in resp.get_json()["flashcards"]:
            assert "question" in card
            assert "answer" in card

    def test_quiz_shape_in_revision(self, client, seeded_compat_course):
        resp = client.post(
            "/api/revision",
            json={"mode": "course", "course_id": seeded_compat_course},
            headers=AUTH,
        )
        for q in resp.get_json()["quiz"]:
            assert "question" in q
            assert "options" in q
            assert "correct" in q


# ---------------------------------------------------------------------------
# GET /api/account — used by AccountScreen.tsx and DashboardScreen.tsx (mobile)
# ---------------------------------------------------------------------------

class TestAccountContract:
    def test_top_level_keys(self, client):
        resp = client.get("/api/account", headers=AUTH)
        data = resp.get_json()
        assert "user" in data
        assert "stats" in data

    def test_stats_shape(self, client):
        resp = client.get("/api/account", headers=AUTH)
        stats = resp.get_json()["stats"]
        # Mobile reads: stats.sessions, stats.avg_score, stats.total_lessons(?), stats.xp, stats.streak
        for key in ("courses", "flashcards", "sessions", "avg_score", "xp"):
            assert key in stats, f"Missing key in stats: {key}"


# ---------------------------------------------------------------------------
# GET /api/paths — used by HomeScreen.tsx (mobile)
# ---------------------------------------------------------------------------

class TestPathsContract:
    def test_returns_paths_array(self, client):
        resp = client.get("/api/paths", headers=AUTH)
        data = resp.get_json()
        assert "paths" in data
        assert isinstance(data["paths"], list)
        assert len(data["paths"]) > 0

    def test_path_shape(self, client):
        resp = client.get("/api/paths", headers=AUTH)
        path = resp.get_json()["paths"][0]
        # Mobile TypeScript interface: id, title, description, progress,
        # totalLessons, completedLessons, isLocked, color, emoji
        for key in ("id", "title", "description", "progress", "totalLessons",
                    "completedLessons", "isLocked", "color", "emoji"):
            assert key in path, f"Missing key in path: {key}"

    def test_progress_is_numeric(self, client):
        resp = client.get("/api/paths", headers=AUTH)
        for path in resp.get_json()["paths"]:
            assert isinstance(path["progress"], (int, float))

    def test_is_locked_is_bool(self, client):
        resp = client.get("/api/paths", headers=AUTH)
        for path in resp.get_json()["paths"]:
            assert isinstance(path["isLocked"], bool)


# ---------------------------------------------------------------------------
# GET /api/lessons/{path_id} — used by PathScreen.tsx (mobile)
# ---------------------------------------------------------------------------

class TestLessonsContract:
    def test_returns_lessons_array(self, client):
        client.get("/api/paths", headers=AUTH)  # ensure user lessons initialised
        resp = client.get("/api/lessons/anatomy", headers=AUTH)
        data = resp.get_json()
        assert "lessons" in data
        assert isinstance(data["lessons"], list)

    def test_lesson_shape(self, client):
        client.get("/api/paths", headers=AUTH)
        resp = client.get("/api/lessons/anatomy", headers=AUTH)
        lesson = resp.get_json()["lessons"][0]
        # Mobile TypeScript interface: id, title, type, status, stars, position, xp
        for key in ("id", "title", "type", "status", "stars", "position", "xp"):
            assert key in lesson, f"Missing key in lesson: {key}"

    def test_lesson_type_enum(self, client):
        client.get("/api/paths", headers=AUTH)
        resp = client.get("/api/lessons/anatomy", headers=AUTH)
        for lesson in resp.get_json()["lessons"]:
            assert lesson["type"] in ("lesson", "review", "test")

    def test_lesson_status_enum(self, client):
        client.get("/api/paths", headers=AUTH)
        resp = client.get("/api/lessons/anatomy", headers=AUTH)
        for lesson in resp.get_json()["lessons"]:
            assert lesson["status"] in ("locked", "available", "completed")
