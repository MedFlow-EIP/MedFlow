"""Chat IA : authentification, fil de conversation et pièces jointes."""
import base64


def _png(size=16):
    return base64.b64encode(b"\x89PNG" + b"0" * size).decode()


def _headers(uid):
    return {"X-User-UID": uid, "X-User-Name": "Testeur"}


class TestChatAuth:
    def test_requires_auth(self, client):
        resp = client.post("/chat", json={"message": "Bonjour"})
        assert resp.status_code == 400

    def test_answers_authenticated_user(self, client):
        resp = client.post("/chat", json={"message": "Qu'est-ce qu'un peptide ?"}, headers=_headers("u1"))
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["conversation_id"]
        assert "peptide" in body["response"]

    def test_rejects_empty_message(self, client):
        resp = client.post("/chat", json={"message": "   "}, headers=_headers("u1"))
        assert resp.status_code == 400


class TestChatConversation:
    def test_history_is_sent_once_and_in_order(self, client, app):
        first = client.post("/chat", json={"message": "Premier"}, headers=_headers("u1")).get_json()
        client.post(
            "/chat",
            json={"message": "Second", "conversation_id": first["conversation_id"]},
            headers=_headers("u1"),
        )

        call = app.ai.last_chat_call
        assert call["user_message"] == "Second"
        # L'historique contient l'échange précédent, sans le message en cours.
        assert [m["content"] for m in call["history"]] == ["Premier", "Réponse mock à : Premier"]

    def test_cannot_continue_someone_elses_conversation(self, client, app):
        theirs = client.post("/chat", json={"message": "Secret"}, headers=_headers("alice")).get_json()

        mine = client.post(
            "/chat",
            json={"message": "Salut", "conversation_id": theirs["conversation_id"]},
            headers=_headers("bob"),
        ).get_json()

        assert mine["conversation_id"] != theirs["conversation_id"]
        assert app.ai.last_chat_call["history"] == []


class TestChatAttachments:
    def test_image_is_forwarded_to_the_model(self, client, app):
        resp = client.post(
            "/chat",
            json={"message": "", "attachments": [{"name": "radio.png", "mime_type": "image/png", "data": _png()}]},
            headers=_headers("u1"),
        )
        assert resp.status_code == 200
        attachments = app.ai.last_chat_call["attachments"]
        assert len(attachments) == 1
        assert attachments[0][1] == "image/png"
        assert attachments[0][0].startswith(b"\x89PNG")
        # Message vide + pièce jointe : une consigne par défaut est envoyée.
        assert app.ai.last_chat_call["user_message"]

    def test_rejects_unsupported_type(self, client):
        resp = client.post(
            "/chat",
            json={"message": "x", "attachments": [{"name": "a.exe", "mime_type": "application/octet-stream", "data": _png()}]},
            headers=_headers("u1"),
        )
        assert resp.status_code == 400

    def test_rejects_invalid_base64(self, client):
        resp = client.post(
            "/chat",
            json={"message": "x", "attachments": [{"name": "a.png", "mime_type": "image/png", "data": "pas du base64 !"}]},
            headers=_headers("u1"),
        )
        assert resp.status_code == 400

    def test_rejects_too_many_attachments(self, client):
        item = {"name": "a.png", "mime_type": "image/png", "data": _png()}
        resp = client.post("/chat", json={"message": "x", "attachments": [item] * 4}, headers=_headers("u1"))
        assert resp.status_code == 400


class TestDebugRoutes:
    def test_hidden_when_disabled(self, client, app):
        app.config["ENABLE_DEBUG_ROUTES"] = False
        assert client.get("/api/debug/db-status").status_code == 404
        assert client.get("/api/debug/headers").status_code == 404

    def test_health_stays_public(self, client, app):
        app.config["ENABLE_DEBUG_ROUTES"] = False
        assert client.get("/health").status_code == 200


class TestUploadLimit:
    def test_pdf_over_limit_is_rejected(self, client, app):
        import io

        app.config["MAX_PDF_BYTES"] = 1024
        data = {"file": (io.BytesIO(b"%PDF-1.4" + b"0" * 2048), "gros.pdf")}
        resp = client.post("/api/process", data=data, headers=_headers("u1"), content_type="multipart/form-data")
        assert resp.status_code == 413
        assert "trop lourd" in resp.get_json()["error"]
