"""Tags de spécialité (F54) et statistiques par spécialité (F69)."""
import io

import pytest

from services.specialties import clean_tags, suggest_tags


def _h(uid="u1"):
    return {"X-User-UID": uid, "X-User-Name": "Testeur"}


def _quiz(n):
    return [{"question": f"Q{i}", "options": {"A": "a", "B": "b"}, "correct": "A"} for i in range(n)]


class TestSuggestion:
    def test_cardiology_text(self):
        text = "Le coeur a deux ventricules. L'infarctus touche le muscle cardiaque. Le ventricule gauche..."
        assert suggest_tags(text)[0] == "Cardiologie"

    def test_accents_are_ignored(self):
        assert "Néphrologie" in suggest_tags("Le néphron filtre. Le rein, la fonction rénale, le glomérule.")

    def test_no_match(self):
        assert suggest_tags("Texte sans rapport avec la médecine.") == []

    def test_clean_tags(self):
        assert clean_tags([" Cardiologie ", "cardiologie", "", "Mon  tag"]) == (["Cardiologie", "Mon tag"], None)
        assert clean_tags(["x" * 31])[1]
        assert clean_tags([f"t{i}" for i in range(6)])[1]
        assert clean_tags("Cardiologie")[1]


class TestCourseTags:
    def test_import_suggests_tags(self, client, app):
        app.ai.transcription = "Le coeur, le ventricule gauche, l'oreillette et l'infarctus du myocarde."
        resp = client.post(
            "/api/process",
            data={"file": (io.BytesIO(b"\xff\xd8\xff"), "photo.jpg")},
            headers=_h(),
            content_type="multipart/form-data",
        )
        assert resp.get_json()["tags"] == ["Cardiologie"]

    def test_regenerate_keeps_user_tags(self, client, db):
        db.save_course("u1", "c1", {"nom": "C", "flashcards": [], "quiz": _quiz(1), "tags": ["Neurologie"]})
        client.post(
            "/api/process",
            data={"file": (io.BytesIO(b"\xff\xd8\xff"), "photo.jpg"), "replace_course_id": "c1"},
            headers=_h(),
            content_type="multipart/form-data",
        )
        assert db.fetch_course("u1", "c1").tags == ["Neurologie"]

    def test_edit_tags(self, client, db):
        db.save_course("u1", "c1", {"nom": "C", "flashcards": [], "quiz": []})
        resp = client.patch("/api/course/c1", json={"tags": ["Cardiologie", "Mes partiels"]}, headers=_h())
        assert resp.status_code == 200
        assert resp.get_json()["tags"] == ["Cardiologie", "Mes partiels"]

    def test_invalid_tags(self, client, db):
        db.save_course("u1", "c1", {"nom": "C", "flashcards": [], "quiz": []})
        assert client.patch("/api/course/c1", json={"tags": "Cardio"}, headers=_h()).status_code == 400

    def test_dashboard_returns_tags(self, client, db):
        db.save_course("u1", "c1", {"nom": "C", "flashcards": [], "quiz": [], "tags": ["Cardiologie"]})
        cours = client.get("/api/dashboard", headers=_h()).get_json()["cours"]
        assert cours[0]["tags"] == ["Cardiologie"]

    def test_specialty_list(self, client):
        assert "Cardiologie" in client.get("/api/specialties", headers=_h()).get_json()["specialties"]


class TestSpecialtyStats:
    @pytest.fixture
    def data(self, db):
        db.save_course("u1", "cardio", {"nom": "Cardio", "flashcards": [], "quiz": _quiz(4), "tags": ["Cardiologie"]})
        db.save_course("u1", "mix", {"nom": "Mix", "flashcards": [], "quiz": _quiz(2), "tags": ["Cardiologie", "Pneumologie"]})
        db.save_course("u1", "vrac", {"nom": "Vrac", "flashcards": [], "quiz": _quiz(1)})
        db.record_quiz_answer("u1", "cardio", 0, "A")
        db.record_quiz_answer("u1", "cardio", 1, "B")
        with db.transaction() as conn:
            conn.execute(
                "UPDATE revision_schedule SET interval_days=30, next_review_date='2999-01-01' "
                "WHERE uid='u1' AND course_id='cardio' AND item_index=0"
            )

    def test_groups(self, client, data):
        stats = {s["tag"]: s for s in client.get("/api/stats/specialties", headers=_h()).get_json()["specialties"]}
        assert list(stats) == ["Cardiologie", "Pneumologie", "Sans spécialité"]

        cardio = stats["Cardiologie"]
        assert (cardio["courses"], cardio["questions"], cardio["mastered"]) == (2, 6, 1)
        assert cardio["mastery"] == 17
        assert cardio["due_today"] == 4  # questions jamais vues : 2 dans chaque cours
        assert (cardio["answers"], cardio["accuracy"]) == (2, 50)
        assert stats["Pneumologie"]["accuracy"] is None

    def test_only_own_courses(self, client, data):
        assert client.get("/api/stats/specialties", headers=_h("u2")).get_json()["specialties"] == []

    def test_practice_answers_count(self, client, db):
        db.save_course("u1", "c", {"nom": "C", "flashcards": [], "quiz": _quiz(1), "tags": ["Anatomie"]})
        client.post("/api/revision/check", json={"course_id": "c", "item_index": 0, "selected_option": "A"}, headers=_h())
        stats = client.get("/api/stats/specialties", headers=_h()).get_json()["specialties"]
        assert stats[0]["accuracy"] == 100
