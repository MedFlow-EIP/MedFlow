"""Tests for revision streak tracking and leech (difficult card) retrieval."""
import pytest


class TestRevisionStreak:
    def test_zero_when_never_reviewed(self, client, auth_headers, uid, db):
        assert db.get_revision_streak(uid) == 0

    def test_first_revision_session_sets_streak_to_one(self, client, auth_headers, seeded_course):
        client.post(
            "/api/revision/answer",
            json={"course_id": seeded_course, "item_index": 0, "selected_option": "A"},
            headers=auth_headers,
        )
        resp = client.post(
            "/api/session-done",
            json={"mode": "all", "session_type": "revision", "score": 100, "total_questions": 1},
            headers=auth_headers,
        )
        assert resp.status_code == 200

    def test_streak_increments_on_consecutive_days(self, db, uid):
        import datetime
        yesterday = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()

        with db.transaction() as conn:
            conn.execute(
                "INSERT OR IGNORE INTO user_stats (uid, xp, streak) VALUES (?, 0, 0)", (uid,)
            )
            conn.execute(
                "UPDATE user_stats SET revision_streak=1, last_revision_activity=? WHERE uid=?",
                (yesterday, uid),
            )

        db.create_session_record(uid, None, "revision", 100, 1)

        assert db.get_revision_streak(uid) == 2

    def test_streak_stays_same_for_a_second_session_the_same_day(self, db, uid):
        db.create_session_record(uid, None, "revision", 100, 1)
        db.create_session_record(uid, None, "revision", 80, 1)

        assert db.get_revision_streak(uid) == 1

    def test_streak_resets_to_one_after_a_gap(self, db, uid):
        import datetime
        long_ago = (datetime.date.today() - datetime.timedelta(days=5)).isoformat()

        with db.transaction() as conn:
            conn.execute(
                "INSERT OR IGNORE INTO user_stats (uid, xp, streak) VALUES (?, 0, 0)", (uid,)
            )
            conn.execute(
                "UPDATE user_stats SET revision_streak=10, last_revision_activity=? WHERE uid=?",
                (long_ago, uid),
            )

        db.create_session_record(uid, None, "revision", 100, 1)

        assert db.get_revision_streak(uid) == 1

    def test_streak_reported_as_zero_if_stale_even_before_next_session(self, db, uid):
        # Un streak vieux de plus d'1 jour ne doit plus s'afficher comme
        # actif, même sans nouvelle session pour le "casser" explicitement.
        import datetime
        long_ago = (datetime.date.today() - datetime.timedelta(days=5)).isoformat()

        with db.transaction() as conn:
            conn.execute(
                "INSERT OR IGNORE INTO user_stats (uid, xp, streak) VALUES (?, 0, 0)", (uid,)
            )
            conn.execute(
                "UPDATE user_stats SET revision_streak=10, last_revision_activity=? WHERE uid=?",
                (long_ago, uid),
            )

        assert db.get_revision_streak(uid) == 0

    def test_lesson_streak_and_revision_streak_are_independent(self, db, uid):
        db.create_session_record(uid, None, "revision", 100, 1)

        with db.connection() as conn:
            row = conn.execute("SELECT streak FROM user_stats WHERE uid=?", (uid,)).fetchone()
        # Le streak de leçons (colonne "streak") ne doit pas bouger.
        assert row["streak"] == 0

    def test_flashcard_and_quiz_sessions_do_not_affect_revision_streak(self, db, uid):
        db.create_session_record(uid, None, "flashcards", 100, 5)
        db.create_session_record(uid, None, "quiz", 100, 5)

        assert db.get_revision_streak(uid) == 0

    def test_streak_included_in_forecast_response(self, client, auth_headers, seeded_course):
        client.post(
            "/api/revision/answer",
            json={"course_id": seeded_course, "item_index": 0, "selected_option": "A"},
            headers=auth_headers,
        )
        client.post(
            "/api/session-done",
            json={"mode": "all", "session_type": "revision", "score": 100, "total_questions": 1},
            headers=auth_headers,
        )

        resp = client.get("/api/revision/forecast", headers=auth_headers)
        data = resp.get_json()
        assert data["streak"] == 1


class TestLeechItems:
    def test_requires_auth(self, client):
        resp = client.get("/api/revision/leeches")
        assert resp.status_code == 400

    def test_empty_when_nothing_is_a_leech(self, client, auth_headers, seeded_course):
        resp = client.get("/api/revision/leeches", headers=auth_headers)
        assert resp.get_json() == {"items": [], "count": 0}

    def test_returns_card_after_three_consecutive_failures(self, client, auth_headers, seeded_course):
        for _ in range(3):
            client.post(
                "/api/revision/answer",
                json={"course_id": seeded_course, "item_index": 0, "selected_option": "B"},
                headers=auth_headers,
            )

        resp = client.get("/api/revision/leeches", headers=auth_headers)
        data = resp.get_json()
        assert data["count"] == 1
        assert data["items"][0]["lapses"] == 3
        assert data["items"][0]["question"] == "Question ?"

    def test_two_failures_is_not_yet_a_leech(self, client, auth_headers, seeded_course):
        for _ in range(2):
            client.post(
                "/api/revision/answer",
                json={"course_id": seeded_course, "item_index": 0, "selected_option": "B"},
                headers=auth_headers,
            )

        resp = client.get("/api/revision/leeches", headers=auth_headers)
        assert resp.get_json() == {"items": [], "count": 0}

    def test_a_correct_answer_removes_it_from_leeches(self, client, auth_headers, seeded_course):
        for _ in range(3):
            client.post(
                "/api/revision/answer",
                json={"course_id": seeded_course, "item_index": 0, "selected_option": "B"},
                headers=auth_headers,
            )
        client.post(
            "/api/revision/answer",
            json={"course_id": seeded_course, "item_index": 0, "selected_option": "A"},
            headers=auth_headers,
        )

        resp = client.get("/api/revision/leeches", headers=auth_headers)
        assert resp.get_json() == {"items": [], "count": 0}

    def test_filters_by_course_id(self, client, auth_headers, db, uid, sample_course_payload):
        db.save_course(uid, "course-a", sample_course_payload)
        db.save_course(uid, "course-b", sample_course_payload)

        for _ in range(3):
            client.post(
                "/api/revision/answer",
                json={"course_id": "course-a", "item_index": 0, "selected_option": "B"},
                headers=auth_headers,
            )
            client.post(
                "/api/revision/answer",
                json={"course_id": "course-b", "item_index": 0, "selected_option": "B"},
                headers=auth_headers,
            )

        resp = client.get("/api/revision/leeches?course_id=course-a", headers=auth_headers)
        data = resp.get_json()
        assert data["count"] == 1
        assert data["items"][0]["course_id"] == "course-a"

    def test_practice_mode_never_creates_leeches(self, client, auth_headers, seeded_course):
        for _ in range(5):
            client.post(
                "/api/revision/check",
                json={"course_id": seeded_course, "item_index": 0, "selected_option": "B"},
                headers=auth_headers,
            )

        resp = client.get("/api/revision/leeches", headers=auth_headers)
        assert resp.get_json() == {"items": [], "count": 0}

    def test_never_exposes_correct_answer(self, client, auth_headers, seeded_course):
        for _ in range(3):
            client.post(
                "/api/revision/answer",
                json={"course_id": seeded_course, "item_index": 0, "selected_option": "B"},
                headers=auth_headers,
            )

        resp = client.get("/api/revision/leeches", headers=auth_headers)
        item = resp.get_json()["items"][0]
        assert "correct" not in item


class TestMasteredItems:
    def test_requires_auth(self, client):
        resp = client.get("/api/revision/mastered")
        assert resp.status_code == 400

    def test_empty_when_nothing_is_mastered_yet(self, client, auth_headers, seeded_course):
        resp = client.get("/api/revision/mastered", headers=auth_headers)
        assert resp.get_json() == {"items": [], "count": 0}

    def test_returns_card_with_interval_at_or_above_threshold(
        self, client, auth_headers, db, uid, seeded_course
    ):
        with db.transaction() as conn:
            conn.execute(
                """
                INSERT INTO revision_schedule
                    (uid, course_id, item_index, ease_factor, interval_days, repetitions, lapses, next_review_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, date('now', '+21 days'))
                """,
                (uid, seeded_course, 0, 2.8, 21, 5, 0),
            )

        resp = client.get("/api/revision/mastered", headers=auth_headers)
        data = resp.get_json()
        assert data["count"] == 1
        assert data["items"][0]["interval_days"] == 21
        assert data["items"][0]["repetitions"] == 5
        assert data["items"][0]["question"] == "Question ?"

    def test_card_below_threshold_is_not_mastered(
        self, client, auth_headers, db, uid, seeded_course
    ):
        with db.transaction() as conn:
            conn.execute(
                """
                INSERT INTO revision_schedule
                    (uid, course_id, item_index, ease_factor, interval_days, repetitions, lapses, next_review_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, date('now', '+20 days'))
                """,
                (uid, seeded_course, 0, 2.8, 20, 5, 0),
            )

        resp = client.get("/api/revision/mastered", headers=auth_headers)
        assert resp.get_json() == {"items": [], "count": 0}

    def test_filters_by_course_id(self, client, auth_headers, db, uid, sample_course_payload):
        db.save_course(uid, "course-a", sample_course_payload)
        db.save_course(uid, "course-b", sample_course_payload)

        with db.transaction() as conn:
            for cid in ("course-a", "course-b"):
                conn.execute(
                    """
                    INSERT INTO revision_schedule
                        (uid, course_id, item_index, ease_factor, interval_days, repetitions, lapses, next_review_date)
                    VALUES (?, ?, ?, ?, ?, ?, ?, date('now', '+30 days'))
                    """,
                    (uid, cid, 0, 3.0, 30, 6, 0),
                )

        resp = client.get("/api/revision/mastered?course_id=course-a", headers=auth_headers)
        data = resp.get_json()
        assert data["count"] == 1
        assert data["items"][0]["course_id"] == "course-a"

    def test_practice_mode_never_creates_mastered_cards(self, client, auth_headers, seeded_course):
        for _ in range(5):
            client.post(
                "/api/revision/check",
                json={"course_id": seeded_course, "item_index": 0, "selected_option": "A"},
                headers=auth_headers,
            )

        resp = client.get("/api/revision/mastered", headers=auth_headers)
        assert resp.get_json() == {"items": [], "count": 0}

    def test_never_exposes_options_or_correct_answer(
        self, client, auth_headers, db, uid, seeded_course
    ):
        with db.transaction() as conn:
            conn.execute(
                """
                INSERT INTO revision_schedule
                    (uid, course_id, item_index, ease_factor, interval_days, repetitions, lapses, next_review_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, date('now', '+25 days'))
                """,
                (uid, seeded_course, 0, 2.9, 25, 4, 0),
            )

        resp = client.get("/api/revision/mastered", headers=auth_headers)
        item = resp.get_json()["items"][0]
        assert "options" not in item
        assert "correct" not in item