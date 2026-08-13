"""Integration tests for the quiz-based SM-2 spaced-repetition endpoints."""
import pytest


class TestGetDueQuizItems:
    def test_requires_auth(self, client):
        resp = client.get("/api/revision/due")
        assert resp.status_code == 400

    def test_never_reviewed_item_is_due(self, client, auth_headers, seeded_course):
        resp = client.get("/api/revision/due", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["count"] == 1
        assert data["items"][0]["question"] == "Question ?"

    def test_no_courses_returns_empty_list(self, client, auth_headers):
        resp = client.get("/api/revision/due", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.get_json() == {"items": [], "count": 0}

    def test_includes_the_correct_answer_for_instant_client_side_feedback(
        self, client, auth_headers, seeded_course
    ):
        # Décision produit assumée : contrairement à une version précédente,
        # la bonne réponse EST incluse — outil de révision personnel, pas un
        # contexte compétitif, et ça évite un aller-retour réseau bloquant à
        # chaque réponse.
        resp = client.get("/api/revision/due", headers=auth_headers)
        item = resp.get_json()["items"][0]
        assert item["correct"] == "A"
        assert set(item.keys()) == {"course_id", "course_nom", "item_index", "question", "options", "correct"}

    def test_includes_the_options(self, client, auth_headers, seeded_course):
        resp = client.get("/api/revision/due", headers=auth_headers)
        item = resp.get_json()["items"][0]
        assert item["options"] == {"A": "1", "B": "2", "C": "3", "D": "4"}

    def test_filters_by_course_id(self, client, auth_headers, db, uid, sample_course_payload):
        db.save_course(uid, "course-a", sample_course_payload)
        db.save_course(uid, "course-b", sample_course_payload)

        resp = client.get("/api/revision/due?course_id=course-a", headers=auth_headers)

        data = resp.get_json()
        assert data["count"] == 1
        assert data["items"][0]["course_id"] == "course-a"

    def test_correctly_answered_item_disappears_until_next_review_date(
        self, client, auth_headers, seeded_course
    ):
        client.post(
            "/api/revision/answer",
            json={"course_id": seeded_course, "item_index": 0, "selected_option": "A"},
            headers=auth_headers,
        )

        resp = client.get("/api/revision/due", headers=auth_headers)
        assert resp.get_json()["count"] == 0

    def test_overdue_items_come_before_never_reviewed_items(
        self, client, auth_headers, db, uid, sample_course_payload
    ):
        import datetime

        two_question_payload = dict(sample_course_payload)
        two_question_payload["quiz"] = [
            {"question": "Q1 ?", "options": {"A": "1", "B": "2"}, "correct": "A"},
            {"question": "Q2 ?", "options": {"A": "1", "B": "2"}, "correct": "B"},
        ]
        db.save_course(uid, "course-x", two_question_payload)

        past_date = (datetime.date.today() - datetime.timedelta(days=3)).isoformat()
        with db.transaction() as conn:
            conn.execute(
                """
                INSERT INTO revision_schedule
                    (uid, course_id, item_index, ease_factor, interval_days, repetitions, next_review_date)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (uid, "course-x", 0, 2.5, 1, 1, past_date),
            )

        resp = client.get("/api/revision/due?course_id=course-x", headers=auth_headers)
        items = resp.get_json()["items"]

        assert items[0]["item_index"] == 0
        assert items[0]["overdue_days"] == 3


class TestAnswerRevisionQuiz:
    def test_requires_auth(self, client):
        resp = client.post(
            "/api/revision/answer",
            json={"course_id": "x", "item_index": 0, "selected_option": "A"},
        )
        assert resp.status_code == 400

    def test_requires_course_id_item_index_and_selected_option(self, client, auth_headers):
        resp = client.post("/api/revision/answer", json={}, headers=auth_headers)
        assert resp.status_code == 400

    def test_rejects_non_integer_item_index(self, client, auth_headers, seeded_course):
        resp = client.post(
            "/api/revision/answer",
            json={"course_id": seeded_course, "item_index": "pas-un-entier", "selected_option": "A"},
            headers=auth_headers,
        )
        assert resp.status_code == 400

    def test_unknown_course_or_item_returns_404(self, client, auth_headers):
        resp = client.post(
            "/api/revision/answer",
            json={"course_id": "ghost", "item_index": 0, "selected_option": "A"},
            headers=auth_headers,
        )
        assert resp.status_code == 404

    def test_correct_answer_reports_correct_true(self, client, auth_headers, seeded_course):
        # Le fixture sample_course_payload a "correct": "A" pour l'unique question.
        resp = client.post(
            "/api/revision/answer",
            json={"course_id": seeded_course, "item_index": 0, "selected_option": "A"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["correct"] is True
        assert data["correct_answer"] == "A"

    def test_incorrect_answer_reports_correct_false(self, client, auth_headers, seeded_course):
        resp = client.post(
            "/api/revision/answer",
            json={"course_id": seeded_course, "item_index": 0, "selected_option": "B"},
            headers=auth_headers,
        )
        data = resp.get_json()
        assert data["correct"] is False
        assert data["correct_answer"] == "A"

    def test_correct_answer_grows_the_interval_like_a_high_quality_review(
        self, client, auth_headers, seeded_course
    ):
        resp = client.post(
            "/api/revision/answer",
            json={"course_id": seeded_course, "item_index": 0, "selected_option": "A"},
            headers=auth_headers,
        )
        data = resp.get_json()
        assert data["interval_days"] == 1
        assert data["repetitions"] == 1

    def test_incorrect_answer_resets_like_a_failed_review(
        self, client, auth_headers, seeded_course
    ):
        resp = client.post(
            "/api/revision/answer",
            json={"course_id": seeded_course, "item_index": 0, "selected_option": "B"},
            headers=auth_headers,
        )
        data = resp.get_json()
        assert data["interval_days"] == 1
        assert data["repetitions"] == 0

    def test_repeated_correct_answers_grow_the_interval_beyond_six_days(
        self, client, auth_headers, seeded_course
    ):
        for _ in range(3):
            resp = client.post(
                "/api/revision/answer",
                json={"course_id": seeded_course, "item_index": 0, "selected_option": "A"},
                headers=auth_headers,
            )
        data = resp.get_json()
        assert data["interval_days"] > 6
        assert data["repetitions"] == 3

    def test_schedule_persists_between_calls(self, client, auth_headers, db, uid, seeded_course):
        client.post(
            "/api/revision/answer",
            json={"course_id": seeded_course, "item_index": 0, "selected_option": "A"},
            headers=auth_headers,
        )

        with db.connection() as conn:
            row = conn.execute(
                "SELECT * FROM revision_schedule WHERE uid=? AND course_id=? AND item_index=0",
                (uid, seeded_course),
            ).fetchone()

        assert row is not None
        assert row["repetitions"] == 1

    def test_no_quality_field_is_ever_accepted_from_the_client(
        self, client, auth_headers, seeded_course
    ):
        # Régression : la qualité doit être déduite en interne, jamais
        # acceptée depuis la requête, même si un client malicieux ou
        # obsolète en envoie une.
        resp = client.post(
            "/api/revision/answer",
            json={
                "course_id": seeded_course,
                "item_index": 0,
                "selected_option": "B",  # mauvaise réponse
                "quality": 5,  # tentative d'usurper une bonne note
            },
            headers=auth_headers,
        )
        data = resp.get_json()
        # La mauvaise réponse doit primer, quality=5 du client est ignoré.
        assert data["correct"] is False
        assert data["interval_days"] == 1
        assert data["repetitions"] == 0


class TestGetPracticeQuizItems:
    def test_requires_auth(self, client):
        resp = client.get("/api/revision/practice")
        assert resp.status_code == 400

    def test_returns_all_items_regardless_of_schedule(self, client, auth_headers, seeded_course):
        # Même en marquant la question comme réussie et planifiée loin dans
        # le futur, le mode pratique doit quand même la renvoyer.
        client.post(
            "/api/revision/answer",
            json={"course_id": seeded_course, "item_index": 0, "selected_option": "A"},
            headers=auth_headers,
        )

        resp = client.get("/api/revision/practice", headers=auth_headers)
        data = resp.get_json()

        assert data["count"] == 1
        assert data["items"][0]["question"] == "Question ?"

    def test_can_be_called_repeatedly_with_identical_results(
        self, client, auth_headers, seeded_course
    ):
        first = client.get("/api/revision/practice", headers=auth_headers).get_json()
        second = client.get("/api/revision/practice", headers=auth_headers).get_json()
        assert first == second

    def test_filters_by_course_id(self, client, auth_headers, db, uid, sample_course_payload):
        db.save_course(uid, "course-a", sample_course_payload)
        db.save_course(uid, "course-b", sample_course_payload)

        resp = client.get("/api/revision/practice?course_id=course-a", headers=auth_headers)

        data = resp.get_json()
        assert data["count"] == 1
        assert data["items"][0]["course_id"] == "course-a"

    def test_does_not_include_overdue_days(self, client, auth_headers, seeded_course):
        resp = client.get("/api/revision/practice", headers=auth_headers)
        item = resp.get_json()["items"][0]
        assert "overdue_days" not in item


class TestCheckRevisionAnswer:
    def test_requires_auth(self, client):
        resp = client.post(
            "/api/revision/check",
            json={"course_id": "x", "item_index": 0, "selected_option": "A"},
        )
        assert resp.status_code == 400

    def test_requires_all_fields(self, client, auth_headers):
        resp = client.post("/api/revision/check", json={}, headers=auth_headers)
        assert resp.status_code == 400

    def test_unknown_course_returns_404(self, client, auth_headers):
        resp = client.post(
            "/api/revision/check",
            json={"course_id": "ghost", "item_index": 0, "selected_option": "A"},
            headers=auth_headers,
        )
        assert resp.status_code == 404

    def test_reports_correctness_like_answer_endpoint(self, client, auth_headers, seeded_course):
        resp = client.post(
            "/api/revision/check",
            json={"course_id": seeded_course, "item_index": 0, "selected_option": "A"},
            headers=auth_headers,
        )
        data = resp.get_json()
        assert data == {"correct": True, "correct_answer": "A"}

    def test_never_writes_to_revision_schedule(self, client, auth_headers, db, uid, seeded_course):
        # Le coeur de la fonctionnalité : répéter le mode pratique ne doit
        # JAMAIS créer ou modifier une ligne dans revision_schedule.
        for _ in range(5):
            client.post(
                "/api/revision/check",
                json={"course_id": seeded_course, "item_index": 0, "selected_option": "A"},
                headers=auth_headers,
            )

        with db.connection() as conn:
            row = conn.execute(
                "SELECT * FROM revision_schedule WHERE uid=? AND course_id=? AND item_index=0",
                (uid, seeded_course),
            ).fetchone()

        assert row is None

    def test_does_not_disturb_an_existing_real_schedule(
        self, client, auth_headers, db, uid, seeded_course
    ):
        # Planifie la question via le vrai flux SM-2 d'abord...
        client.post(
            "/api/revision/answer",
            json={"course_id": seeded_course, "item_index": 0, "selected_option": "A"},
            headers=auth_headers,
        )
        with db.connection() as conn:
            before = dict(conn.execute(
                "SELECT * FROM revision_schedule WHERE uid=? AND course_id=? AND item_index=0",
                (uid, seeded_course),
            ).fetchone())

        # ...puis rejoue la même question en mode pratique plusieurs fois.
        for _ in range(3):
            client.post(
                "/api/revision/check",
                json={"course_id": seeded_course, "item_index": 0, "selected_option": "B"},
                headers=auth_headers,
            )

        with db.connection() as conn:
            after = dict(conn.execute(
                "SELECT * FROM revision_schedule WHERE uid=? AND course_id=? AND item_index=0",
                (uid, seeded_course),
            ).fetchone())

        assert before == after