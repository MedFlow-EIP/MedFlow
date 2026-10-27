"""Garde-fous de coût IA : quotas, taille des messages, historique envoyé au modèle."""
import base64
import io

import pytest


def _headers(uid):
    return {"X-User-UID": uid, "X-User-Name": "Testeur"}


def _chat(client, uid, message="Bonjour", **extra):
    return client.post("/chat", json={"message": message, **extra}, headers=_headers(uid))


def _upload(client, uid, pdf_bytes, name="cours.pdf"):
    return client.post(
        "/api/process",
        data={"file": (io.BytesIO(pdf_bytes), name)},
        headers=_headers(uid),
        content_type="multipart/form-data",
    )


def _pdf_with_pages(count):
    from pypdf import PdfWriter

    writer = PdfWriter()
    for _ in range(count):
        writer.add_blank_page(width=200, height=200)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


class TestChatQuota:
    def test_blocks_after_per_minute_limit(self, client, app):
        app.config["AI_CHAT_PER_MINUTE"] = 2
        assert _chat(client, "u1").status_code == 200
        assert _chat(client, "u1").status_code == 200

        resp = _chat(client, "u1")
        assert resp.status_code == 429
        assert resp.get_json()["code"] == "quota_exceeded"

    def test_quota_is_per_user(self, client, app):
        app.config["AI_CHAT_PER_MINUTE"] = 1
        assert _chat(client, "u1").status_code == 200
        assert _chat(client, "u1").status_code == 429
        assert _chat(client, "u2").status_code == 200

    def test_daily_limit(self, client, app):
        app.config["AI_CHAT_PER_DAY"] = 1
        assert _chat(client, "u1").status_code == 200
        assert _chat(client, "u1").status_code == 429

    def test_global_limit_stops_everyone(self, client, app):
        app.config["AI_GLOBAL_PER_DAY"] = 2
        assert _chat(client, "u1").status_code == 200
        assert _chat(client, "u2").status_code == 200

        resp = _chat(client, "u3")
        assert resp.status_code == 429
        assert "sollicitée" in resp.get_json()["error"]

    def test_rejected_requests_do_not_consume_quota(self, client, app):
        app.config["AI_CHAT_PER_MINUTE"] = 1
        assert _chat(client, "u1", message="   ").status_code == 400
        assert _chat(client, "u1").status_code == 200

    def test_model_not_called_when_blocked(self, client, app):
        app.config["AI_CHAT_PER_MINUTE"] = 1
        _chat(client, "u1", message="Premier")
        _chat(client, "u1", message="Second")
        assert app.ai.last_chat_call["user_message"] == "Premier"


class TestChatSize:
    def test_rejects_too_long_message(self, client, app):
        resp = _chat(client, "u1", message="a" * (app.config["CHAT_MAX_MESSAGE_CHARS"] + 1))
        assert resp.status_code == 400
        assert app.ai.last_chat_call is None

    def test_history_sent_to_model_is_bounded(self, client, app):
        app.config["CHAT_HISTORY_MESSAGES"] = 4
        conv = _chat(client, "u1", message="m0").get_json()["conversation_id"]
        for i in range(1, 6):
            _chat(client, "u1", message=f"m{i}", conversation_id=conv)

        history = app.ai.last_chat_call["history"]
        assert len(history) == 4
        assert history[-2]["content"] == "m4"

    def test_rejects_pdf_with_too_many_pages(self, client, app):
        app.config["CHAT_MAX_PDF_PAGES"] = 2
        pdf = base64.b64encode(_pdf_with_pages(3)).decode()
        resp = _chat(
            client, "u1", message="Lis ça",
            attachments=[{"name": "long.pdf", "mime_type": "application/pdf", "data": pdf}],
        )
        assert resp.status_code == 413
        assert app.ai.last_chat_call is None

    def test_accepts_short_pdf(self, client, app):
        pdf = base64.b64encode(_pdf_with_pages(1)).decode()
        resp = _chat(
            client, "u1", message="Lis ça",
            attachments=[{"name": "court.pdf", "mime_type": "application/pdf", "data": pdf}],
        )
        assert resp.status_code == 200


class TestProcessQuota:
    @pytest.fixture(autouse=True)
    def _pdf_has_text(self, monkeypatch):
        monkeypatch.setattr("routes.courses.extract_text_from_pdf", lambda _: "Le coeur a quatre cavités.")

    def test_empty_pdf_does_not_consume_quota(self, client, app, minimal_pdf_bytes, monkeypatch):
        app.config["AI_PROCESS_PER_HOUR"] = 1
        monkeypatch.setattr("routes.courses.extract_text_from_pdf", lambda _: "")
        assert _upload(client, "u1", minimal_pdf_bytes).status_code == 400
        monkeypatch.setattr("routes.courses.extract_text_from_pdf", lambda _: "Le coeur a quatre cavités.")
        assert _upload(client, "u1", minimal_pdf_bytes).status_code == 200

    def test_blocks_uploads_after_hourly_limit(self, client, app, minimal_pdf_bytes):
        app.config["AI_PROCESS_PER_HOUR"] = 1
        assert _upload(client, "u1", minimal_pdf_bytes, "a.pdf").status_code == 200

        resp = _upload(client, "u1", minimal_pdf_bytes, "b.pdf")
        assert resp.status_code == 429
        assert "imports" in resp.get_json()["error"]

    def test_chat_and_upload_quotas_are_separate(self, client, app, minimal_pdf_bytes):
        app.config["AI_PROCESS_PER_HOUR"] = 1
        assert _upload(client, "u1", minimal_pdf_bytes).status_code == 200
        assert _chat(client, "u1").status_code == 200


class TestProviderFactory:
    def test_reads_flask_config_dict(self):
        pytest.importorskip("vertexai")
        from unittest.mock import patch

        from services.ai import get_ai_provider

        config = {"AI_CHAT_MODEL": "modele-chat", "AI_COURSE_MODEL": "modele-cours", "AI_MAX_OUTPUT_TOKENS": 512}
        with patch("services.ai.vertexai_provider.vertexai.init"):
            provider = get_ai_provider(config)
        assert provider.chat_model == "modele-chat"
        assert provider.course_model == "modele-cours"
