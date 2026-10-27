"""PDF avec schémas : lus par l'IA ; tout le cours sert à la génération."""
import io

import pytest

from services.pdf import pdf_has_images


def _h():
    return {"X-User-UID": "u1", "X-User-Name": "Testeur"}


def _upload(client, data=b"%PDF-1.4 faux", name="cours.pdf"):
    return client.post(
        "/api/process",
        data={"file": (io.BytesIO(data), name)},
        headers=_h(),
        content_type="multipart/form-data",
    )


@pytest.fixture
def pdf_with_text(monkeypatch):
    monkeypatch.setattr("routes.courses.extract_text_from_pdf", lambda _: "Le coeur a quatre cavités. " * 20)
    monkeypatch.setattr("routes.courses._pdf_page_count", lambda _: 12)


def test_pdf_with_figures_is_read_by_ai(client, app, pdf_with_text, monkeypatch):
    monkeypatch.setattr("routes.courses.pdf_has_images", lambda _: True)
    app.ai.transcription = "Texte du cours. [Schéma : coupe du cœur, ventricule gauche à droite de l'image]"
    seen = {}
    original = app.ai.generate_summary
    app.ai.generate_summary = lambda text: seen.setdefault("text", text) and original(text)

    assert _upload(client).status_code == 200
    assert app.ai.transcribe_calls == ["application/pdf"]
    assert "[Schéma : coupe du cœur" in seen["text"]


def test_text_only_pdf_skips_ai_reading(client, app, pdf_with_text, monkeypatch):
    monkeypatch.setattr("routes.courses.pdf_has_images", lambda _: False)
    assert _upload(client).status_code == 200
    assert app.ai.transcribe_calls == []


def test_extracted_text_is_kept_if_ai_reading_fails(client, app, pdf_with_text, monkeypatch):
    monkeypatch.setattr("routes.courses.pdf_has_images", lambda _: True)
    app.ai.transcription = ""
    assert _upload(client).status_code == 200


def test_long_pdf_uses_text_only(client, app, monkeypatch):
    monkeypatch.setattr("routes.courses.extract_text_from_pdf", lambda _: "Texte. " * 50)
    monkeypatch.setattr("routes.courses._pdf_page_count", lambda _: 200)
    monkeypatch.setattr("routes.courses.pdf_has_images", lambda _: True)
    assert _upload(client).status_code == 200
    assert app.ai.transcribe_calls == []


def test_card_count_grows_with_course_length(client, monkeypatch):
    monkeypatch.setattr("routes.courses.extract_text_from_pdf", lambda _: "x" * 60000)
    monkeypatch.setattr("routes.courses.pdf_has_images", lambda _: False)
    course = _upload(client).get_json()
    assert len(course["flashcards"]) == 15
    assert len(course["quiz"]) == 15


def test_short_course_keeps_five_cards(client, pdf_with_text, monkeypatch):
    monkeypatch.setattr("routes.courses.pdf_has_images", lambda _: False)
    assert len(_upload(client).get_json()["flashcards"]) == 5


def test_minimal_pdf_has_no_images(minimal_pdf_bytes):
    assert pdf_has_images(minimal_pdf_bytes) is False
    assert pdf_has_images(b"pas un pdf") is False
