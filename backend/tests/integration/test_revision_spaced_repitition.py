"""Integration tests for the SM-2 spaced-repetition revision endpoints."""
import pytest


class TestGetDueFlashcards:
    def test_requires_auth(self, client):
        resp = client.get("/api/revision/due")
        assert resp.status_code == 400

    def test_never_reviewed_cards_are_all_due(self, client, auth_headers, seeded_course):
        resp = client.get("/api/revision/due", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["count"] == 2
        questions = {c["question"] for c in data["cards"]}
        assert questions == {"Q1", "Q2"}

    def test_no_courses_returns_empty_list(self, client, auth_headers):
        resp = client.get("/api/revision/due", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.get_json() == {"cards": [], "count": 0}

    def test_filters_by_course_id(self, client, auth_headers, db, uid, sample_course_payload):
        db.save_course(uid, "course-a", sample_course_payload)
        db.save_course(uid, "course-b", sample_course_payload)

        resp = client.get("/api/revision/due?course_id=course-a", headers=auth_headers)

        data = resp.get_json()
        assert data["count"] == 2
        assert all(c["course_id"] == "course-a" for c in data["cards"])

    def test_card_rated_well_disappears_until_its_next_review_date(
        self, client, auth_headers, seeded_course
    ):
        client.post(
            "/api/revision/answer",
            json={"course_id": seeded_course, "card_index": 0, "quality": 5},
            headers=auth_headers,
        )

        resp = client.get("/api/revision/due", headers=auth_headers)
        data = resp.get_json()

        # La carte 0 vient d'être planifiée dans le futur (>= 1 jour) -> ne
        # doit plus apparaître ; la carte 1, jamais vue, reste due.
        assert data["count"] == 1
        assert data["cards"][0]["question"] == "Q2"

    def test_overdue_cards_come_before_never_reviewed_cards(
        self, client, auth_headers, db, uid, seeded_course
    ):
        # Force la carte 0 à être en retard de 3 jours (date de révision
        # dans le passé), en insérant directement une planification déjà
        # échue plutôt que d'attendre un vrai écoulement du temps.
        import datetime
        past_date = (datetime.date.today() - datetime.timedelta(days=3)).isoformat()
        with db.transaction() as conn:
            conn.execute(
                """
                INSERT INTO flashcard_schedule
                    (uid, course_id, card_index, ease_factor, interval_days, repetitions, next_review_date)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (uid, seeded_course, 0, 2.5, 1, 1, past_date),
            )

        resp = client.get("/api/revision/due", headers=auth_headers)
        cards = resp.get_json()["cards"]

        assert cards[0]["card_index"] == 0
        assert cards[0]["overdue_days"] == 3


class TestAnswerRevisionCard:
    def test_requires_auth(self, client):
        resp = client.post(
            "/api/revision/answer",
            json={"course_id": "x", "card_index": 0, "quality": 5},
        )
        assert resp.status_code == 400

    def test_requires_course_id_card_index_and_quality(self, client, auth_headers):
        resp = client.post("/api/revision/answer", json={}, headers=auth_headers)
        assert resp.status_code == 400

    def test_rejects_non_integer_card_index(self, client, auth_headers, seeded_course):
        resp = client.post(
            "/api/revision/answer",
            json={"course_id": seeded_course, "card_index": "pas-un-entier", "quality": 5},
            headers=auth_headers,
        )
        assert resp.status_code == 400

    def test_first_review_returns_one_day_interval(self, client, auth_headers, seeded_course):
        resp = client.post(
            "/api/revision/answer",
            json={"course_id": seeded_course, "card_index": 0, "quality": 4},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["interval_days"] == 1
        assert data["repetitions"] == 1

    def test_low_quality_keeps_interval_at_one_day(self, client, auth_headers, seeded_course):
        resp = client.post(
            "/api/revision/answer",
            json={"course_id": seeded_course, "card_index": 0, "quality": 0},
            headers=auth_headers,
        )
        data = resp.get_json()
        assert data["interval_days"] == 1
        assert data["repetitions"] == 0

    def test_repeated_good_answers_grow_the_interval(self, client, auth_headers, seeded_course):
        for _ in range(3):
            resp = client.post(
                "/api/revision/answer",
                json={"course_id": seeded_course, "card_index": 0, "quality": 5},
                headers=auth_headers,
            )
        data = resp.get_json()
        assert data["interval_days"] > 6
        assert data["repetitions"] == 3

    def test_schedule_persists_between_calls(self, client, auth_headers, db, uid, seeded_course):
        client.post(
            "/api/revision/answer",
            json={"course_id": seeded_course, "card_index": 0, "quality": 5},
            headers=auth_headers,
        )

        with db.connection() as conn:
            row = conn.execute(
                "SELECT * FROM flashcard_schedule WHERE uid=? AND course_id=? AND card_index=0",
                (uid, seeded_course),
            ).fetchone()

        assert row is not None
        assert row["repetitions"] == 1