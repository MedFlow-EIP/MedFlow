"""Import de photos / Word / PowerPoint, modification d'un cours, flashcards
depuis le chat et export des données."""
import io
import zipfile

import pytest

from services.documents import DocumentError, extract_text_from_docx, extract_text_from_pptx


def _headers(uid="u1"):
    return {"X-User-UID": uid, "X-User-Name": "Testeur"}


def _upload(client, data, name, uid="u1", **form):
    return client.post(
        "/api/process",
        data={"file": (io.BytesIO(data), name), **form},
        headers=_headers(uid),
        content_type="multipart/form-data",
    )


def _zip(files: dict) -> bytes:
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as archive:
        for name, content in files.items():
            archive.writestr(name, content)
    return out.getvalue()


W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
A = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'


def _docx(*paragraphs):
    body = "".join(f"<w:p><w:r><w:t>{p}</w:t></w:r></w:p>" for p in paragraphs)
    return _zip({"word/document.xml": f"<w:document {W}><w:body>{body}</w:body></w:document>"})


def _pptx(*slides):
    files = {}
    for i, text in enumerate(slides, start=1):
        files[f"ppt/slides/slide{i}.xml"] = f"<p:sld {A} xmlns:p='p'><a:p><a:r><a:t>{text}</a:t></a:r></a:p></p:sld>"
    return _zip(files)


class TestDocumentExtraction:
    def test_docx_text(self):
        text = extract_text_from_docx(_docx("Le coeur", "a quatre cavités"))
        assert text == "Le coeur\na quatre cavités"

    def test_pptx_slides_in_order(self):
        files = {
            "ppt/slides/slide10.xml": f"<p:sld {A} xmlns:p='p'><a:p><a:r><a:t>Dixième</a:t></a:r></a:p></p:sld>",
            "ppt/slides/slide2.xml": f"<p:sld {A} xmlns:p='p'><a:p><a:r><a:t>Deuxième</a:t></a:r></a:p></p:sld>",
        }
        text = extract_text_from_pptx(_zip(files))
        assert text.index("Deuxième") < text.index("Dixième")

    def test_corrupted_file(self):
        with pytest.raises(DocumentError):
            extract_text_from_docx(b"pas un zip")

    def test_docx_without_document(self):
        with pytest.raises(DocumentError):
            extract_text_from_docx(_zip({"autre.xml": "<x/>"}))


class TestImportFormats:
    def test_word_document(self, client, app):
        resp = _upload(client, _docx("Le coeur a quatre cavités et deux valves."), "cours.docx")
        assert resp.status_code == 200
        assert resp.get_json()["flashcards"]
        assert app.ai.transcribe_calls == []  # texte lu directement, sans IA

    def test_powerpoint(self, client):
        resp = _upload(client, _pptx("Anatomie du coeur", "Le ventricule gauche"), "diapos.pptx")
        assert resp.status_code == 200

    def test_photo_is_read_by_ai(self, client, app):
        resp = _upload(client, b"\xff\xd8\xff fausse image", "photo.jpg")
        assert resp.status_code == 200
        assert app.ai.transcribe_calls == ["image/jpeg"]

    def test_unreadable_photo(self, client, app):
        app.ai.transcription = ""
        resp = _upload(client, b"\xff\xd8\xff", "floue.jpg")
        assert resp.status_code == 400
        assert "lisible" in resp.get_json()["error"]

    def test_scanned_pdf_is_read_by_ai(self, client, app, minimal_pdf_bytes):
        resp = _upload(client, minimal_pdf_bytes, "scan.pdf")
        assert resp.status_code == 200
        assert app.ai.transcribe_calls == ["application/pdf"]

    def test_scanned_pdf_page_limit(self, client, app, minimal_pdf_bytes):
        app.config["PROCESS_MAX_SCANNED_PAGES"] = 0
        resp = _upload(client, minimal_pdf_bytes, "scan.pdf")
        assert resp.status_code == 413
        assert app.ai.transcribe_calls == []

    def test_corrupted_pdf_does_not_consume_quota(self, client, app):
        app.config["AI_PROCESS_PER_HOUR"] = 1
        assert _upload(client, b"%PDF-casse", "a.pdf").status_code == 400
        assert _upload(client, _docx("Le coeur a quatre cavités."), "b.docx").status_code == 200

    def test_empty_word_document(self, client):
        resp = _upload(client, _docx(""), "vide.docx")
        assert resp.status_code == 400

    def test_unsupported_format(self, client):
        resp = _upload(client, b"texte", "notes.txt")
        assert resp.status_code == 400
        assert "Format non supporté" in resp.get_json()["error"]

    def test_same_file_name_does_not_overwrite(self, client, db):
        first = _upload(client, b"\xff\xd8\xff", "image.jpg").get_json()["id"]
        second = _upload(client, b"\xff\xd8\xff", "image.jpg").get_json()["id"]
        assert first != second
        assert len(db.fetch_courses("u1")) == 2

    def test_regenerate_replaces_course(self, client, db):
        course_id = _upload(client, b"\xff\xd8\xff", "image.jpg").get_json()["id"]
        resp = _upload(client, b"\xff\xd8\xff", "image.jpg", replace_course_id=course_id)
        assert resp.get_json()["id"] == course_id
        assert len(db.fetch_courses("u1")) == 1

    def test_regenerate_someone_elses_course(self, client):
        course_id = _upload(client, b"\xff\xd8\xff", "image.jpg", uid="u1").get_json()["id"]
        resp = _upload(client, b"\xff\xd8\xff", "image.jpg", uid="u2", replace_course_id=course_id)
        assert resp.status_code == 404

    def test_failed_generation_saves_nothing(self, client, app, db):
        app.ai.generate_flashcards = lambda text, n=5: [{"question": "Erreur", "answer": "x"}]
        app.ai.generate_quiz = lambda text, *args: [{"question": "Erreur", "options": {"A": "x"}, "correct": "A"}]
        resp = _upload(client, _docx("Le coeur a quatre cavités."), "cours.docx")
        assert resp.status_code == 502
        assert db.fetch_courses("u1") == []


@pytest.fixture
def course(db):
    db.save_course("u1", "c1", {
        "nom": "Cardio",
        "summary": "<p>x</p>",
        "flashcards": [{"question": "Q1", "answer": "R1"}],
        "quiz": [],
    })
    return "c1"


class TestEditCourse:
    def test_rename(self, client, course, db):
        resp = client.patch(f"/api/course/{course}", json={"nom": "  Cardiologie  "}, headers=_headers())
        assert resp.status_code == 200
        assert db.fetch_course("u1", course).nom == "Cardiologie"

    def test_edit_flashcards(self, client, course, db):
        cards = [{"question": "Q corrigée", "answer": "R corrigée"}, {"question": "Q2", "answer": "R2"}]
        resp = client.patch(f"/api/course/{course}", json={"flashcards": cards}, headers=_headers())
        assert resp.status_code == 200
        assert db.fetch_course("u1", course).flashcards == cards

    @pytest.mark.parametrize("body", [
        {"nom": ""},
        {"nom": "x" * 121},
        {"flashcards": [{"question": "", "answer": "R"}]},
        {"flashcards": "pas une liste"},
        {},
    ])
    def test_invalid_changes(self, client, course, body):
        assert client.patch(f"/api/course/{course}", json=body, headers=_headers()).status_code == 400

    def test_cannot_edit_other_users_course(self, client, course, db):
        resp = client.patch(f"/api/course/{course}", json={"nom": "Piraté"}, headers=_headers("u2"))
        assert resp.status_code == 404
        assert db.fetch_course("u1", course).nom == "Cardio"


class TestFlashcardsFromText:
    TEXT = "Le ventricule gauche éjecte le sang dans l'aorte."

    def test_adds_to_course(self, client, course, db):
        resp = client.post("/api/flashcards/from-text", json={"text": self.TEXT, "course_id": course}, headers=_headers())
        assert resp.status_code == 200
        assert len(resp.get_json()["added"]) == 3
        assert len(db.fetch_course("u1", course).flashcards) == 4

    def test_creates_notes_course(self, client, db):
        resp = client.post("/api/flashcards/from-text", json={"text": self.TEXT}, headers=_headers())
        assert resp.status_code == 200
        assert resp.get_json()["course_nom"] == "Notes de l'assistant"
        client.post("/api/flashcards/from-text", json={"text": self.TEXT}, headers=_headers())
        assert len(db.fetch_course("u1", "notes-assistant").flashcards) == 6

    def test_other_users_course(self, client, course):
        resp = client.post("/api/flashcards/from-text", json={"text": self.TEXT, "course_id": course}, headers=_headers("u2"))
        assert resp.status_code == 404

    def test_text_too_long(self, client, app):
        app.config["FLASHCARDS_FROM_TEXT_MAX_CHARS"] = 20
        resp = client.post("/api/flashcards/from-text", json={"text": self.TEXT}, headers=_headers())
        assert resp.status_code == 400

    def test_counts_in_chat_quota(self, client, app):
        app.config["AI_CHAT_PER_MINUTE"] = 1
        assert client.post("/api/flashcards/from-text", json={"text": self.TEXT}, headers=_headers()).status_code == 200
        assert client.post("/chat", json={"message": "Bonjour"}, headers=_headers()).status_code == 429


class TestExport:
    def test_export_contains_user_data_only(self, client, course, db):
        db.save_course("u2", "autre", {"nom": "Pas à moi", "flashcards": [], "quiz": []})
        client.post("/chat", json={"message": "Bonjour"}, headers=_headers())

        resp = client.get("/api/account/export", headers=_headers())
        assert resp.status_code == 200
        data = resp.get_json()["data"]
        assert [c["nom"] for c in data["courses"]] == ["Cardio"]
        assert data["courses"][0]["flashcards"] == [{"question": "Q1", "answer": "R1"}]
        assert [m["sender"] for m in data["chat_messages"]] == ["user", "ai"]
        assert "Pas à moi" not in resp.get_data(as_text=True)

    def test_export_requires_auth(self, client):
        assert client.get("/api/account/export").status_code in (400, 401)
