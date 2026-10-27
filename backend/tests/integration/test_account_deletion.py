"""Suppression de compte, historique du chat synchronisé, email vérifié pour l'IA."""
import os
import time

from flask import g


def _headers(uid):
    return {"X-User-UID": uid, "X-User-Name": "Testeur"}


def _count(db, table, column, value):
    with db.connection() as conn:
        return conn.execute(f"SELECT COUNT(*) FROM {table} WHERE {column} = ?", (value,)).fetchone()[0]


class TestDeleteAccount:
    def test_deletes_all_user_data(self, client, app, db, sample_course_payload):
        db.save_course("alice", "cours1", sample_course_payload)
        client.post("/chat", json={"message": "Bonjour"}, headers=_headers("alice"))
        client.post("/chat", json={"message": "Salut"}, headers=_headers("bob"))
        db.send_friend_request("alice", "bob")
        assert _count(db, "friendships", "requester_uid", "alice") == 1

        resp = client.delete("/api/account", headers=_headers("alice"))
        assert resp.status_code == 200

        assert _count(db, "courses", "uid", "alice") == 0
        assert _count(db, "chat_conversations", "uid", "alice") == 0
        assert _count(db, "user_stats", "uid", "alice") == 0
        assert _count(db, "friendships", "requester_uid", "alice") == 0
        with db.connection() as conn:
            orphans = conn.execute(
                "SELECT COUNT(*) FROM chat_messages WHERE conversation_id NOT IN "
                "(SELECT conversation_id FROM chat_conversations)"
            ).fetchone()[0]
        assert orphans == 0
        # Les autres comptes ne sont pas touchés.
        assert _count(db, "chat_conversations", "uid", "bob") == 1

    def test_deletes_avatar_file(self, client, app):
        folder = os.path.join(app.config["UPLOAD_FOLDER"], "avatars")
        os.makedirs(folder, exist_ok=True)
        path = os.path.join(folder, "alice.png")
        open(path, "wb").write(b"img")

        client.delete("/api/account", headers=_headers("alice"))
        assert not os.path.exists(path)

    def test_requires_auth(self, client):
        assert client.delete("/api/account").status_code == 400

    def test_requires_recent_login_in_production(self, client, app, monkeypatch):
        app.config["FIREBASE_VERIFY"] = True

        def fake_verify(_data=None):
            g.auth_time = time.time() - 3600
            g.email_verified = True
            return "alice"

        monkeypatch.setattr("middleware.auth._extract_verified_uid", fake_verify)
        resp = client.delete("/api/account")
        assert resp.status_code == 401
        assert resp.get_json()["code"] == "requires_recent_login"

    def test_accepts_recent_login_in_production(self, client, app, monkeypatch):
        app.config["FIREBASE_VERIFY"] = True

        def fake_verify(_data=None):
            g.auth_time = time.time() - 30
            return "alice"

        monkeypatch.setattr("middleware.auth._extract_verified_uid", fake_verify)
        assert client.delete("/api/account").status_code == 200


class TestEmailVerification:
    def test_ai_refused_when_email_not_verified(self, client, app, monkeypatch):
        app.config["FIREBASE_VERIFY"] = True

        def fake_verify(_data=None):
            g.email_verified = False
            return "alice"

        monkeypatch.setattr("middleware.auth._extract_verified_uid", fake_verify)
        resp = client.post("/chat", json={"message": "Bonjour"})
        assert resp.status_code == 403
        assert resp.get_json()["code"] == "email_not_verified"
        assert app.ai.last_chat_call is None

    def test_ai_allowed_when_email_verified(self, client, app, monkeypatch):
        app.config["FIREBASE_VERIFY"] = True

        def fake_verify(_data=None):
            g.email_verified = True
            return "alice"

        monkeypatch.setattr("middleware.auth._extract_verified_uid", fake_verify)
        assert client.post("/chat", json={"message": "Bonjour"}).status_code == 200


class TestChatHistorySync:
    def test_lists_own_conversations_with_messages(self, client):
        first = client.post("/chat", json={"message": "Premier"}, headers=_headers("alice")).get_json()
        client.post(
            "/chat",
            json={"message": "Second", "conversation_id": first["conversation_id"]},
            headers=_headers("alice"),
        )
        client.post("/chat", json={"message": "Pas à toi"}, headers=_headers("bob"))

        body = client.get("/chat/conversations", headers=_headers("alice")).get_json()
        assert len(body["conversations"]) == 1
        conv = body["conversations"][0]
        assert conv["conversation_id"] == first["conversation_id"]
        assert [m["sender"] for m in conv["messages"]] == ["user", "ai", "user", "ai"]
        assert conv["messages"][2]["content"] == "Second"

    def test_delete_own_conversation(self, client):
        conv = client.post("/chat", json={"message": "Hey"}, headers=_headers("alice")).get_json()["conversation_id"]

        assert client.delete(f"/chat/conversations/{conv}", headers=_headers("bob")).status_code == 404
        assert client.delete(f"/chat/conversations/{conv}", headers=_headers("alice")).status_code == 200
        assert client.get("/chat/conversations", headers=_headers("alice")).get_json()["conversations"] == []
