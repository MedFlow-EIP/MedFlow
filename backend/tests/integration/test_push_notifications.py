"""Notifications push (Expo) : jetons et envois déclenchés par les actions."""
import io
import zipfile

import pytest

TOKEN_A = "ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]"
TOKEN_B = "ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]"


def _h(uid):
    return {"X-User-UID": uid, "X-User-Name": uid.capitalize()}


class FakeResponse:
    ok = True

    def __init__(self, tickets):
        self._tickets = tickets

    def json(self):
        return {"data": self._tickets}


@pytest.fixture
def sent(app, monkeypatch):
    """Active les push (synchrones) et capture ce qui part chez Expo."""
    app.config["PUSH_ENABLED"] = True
    calls = []

    def fake_post(url, json, timeout):
        calls.append(json)
        return FakeResponse([{"status": "ok"} for _ in json])

    monkeypatch.setattr("services.push.requests.post", fake_post)
    return calls


def _register(client, uid, token):
    return client.post("/api/push-token", json={"token": token}, headers=_h(uid))


class TestTokens:
    def test_register_and_unregister(self, client, db):
        assert _register(client, "bob", TOKEN_A).status_code == 200
        assert db.get_push_tokens("bob") == [TOKEN_A]
        client.delete("/api/push-token", json={"token": TOKEN_A}, headers=_h("bob"))
        assert db.get_push_tokens("bob") == []

    def test_invalid_token(self, client):
        assert _register(client, "bob", "pas-un-jeton").status_code == 400

    def test_token_follows_account_switch(self, client, db):
        _register(client, "alice", TOKEN_A)
        _register(client, "bob", TOKEN_A)
        assert db.get_push_tokens("alice") == []
        assert db.get_push_tokens("bob") == [TOKEN_A]

    def test_cannot_unregister_someone_elses_token(self, client, db):
        _register(client, "bob", TOKEN_A)
        client.delete("/api/push-token", json={"token": TOKEN_A}, headers=_h("eve"))
        assert db.get_push_tokens("bob") == [TOKEN_A]


def test_friend_request_notifies_addressee(client, db, sent):
    db.upsert_user_profile("bob", "Bob")
    _register(client, "bob", TOKEN_A)
    client.post("/api/friends/request", json={"uid": "bob"}, headers=_h("alice"))
    assert len(sent) == 1
    assert sent[0][0]["to"] == TOKEN_A
    assert sent[0][0]["body"] == "Alice veut t’ajouter en ami."


def test_challenge_notifies_opponent(client, db, sent):
    db.send_friend_request("alice", "bob")
    db.respond_to_friend_request("bob", "alice", True)
    quiz = [{"question": f"Q{i}", "options": {"A": "a", "B": "b"}, "correct": "A"} for i in range(5)]
    db.save_course("alice", "c", {"nom": "Cardio", "flashcards": [], "quiz": quiz})
    _register(client, "bob", TOKEN_B)
    resp = client.post("/api/challenges", json={"friend_uid": "bob", "course_id": "c", "count": 5}, headers=_h("alice"))
    message = sent[-1][0]
    assert message["title"] == "⚡ Nouveau défi"
    assert message["data"] == {"screen": "Challenge", "challengeId": resp.get_json()["id"]}


def test_background_import_notifies_when_ready(client, db, sent):
    import time

    _register(client, "alice", TOKEN_A)
    W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as z:
        z.writestr("word/document.xml", f"<w:document {W}><w:body><w:p><w:r><w:t>Le coeur a quatre cavités.</w:t></w:r></w:p></w:body></w:document>")
    client.post(
        "/api/process",
        data={"file": (io.BytesIO(out.getvalue()), "cours.docx"), "background": "1"},
        headers=_h("alice"),
        content_type="multipart/form-data",
    )
    for _ in range(100):
        if sent:
            break
        time.sleep(0.05)
    assert sent[0][0]["title"] == "✅ Cours prêt"
    assert sent[0][0]["data"]["screen"] == "CourseDetail"


def test_uninstalled_device_token_is_removed(client, db, app, monkeypatch):
    app.config["PUSH_ENABLED"] = True
    monkeypatch.setattr(
        "services.push.requests.post",
        lambda url, json, timeout: FakeResponse([{"status": "error", "details": {"error": "DeviceNotRegistered"}}]),
    )
    _register(client, "bob", TOKEN_A)
    client.post("/api/friends/request", json={"uid": "bob"}, headers=_h("alice"))
    assert db.get_push_tokens("bob") == []


def test_no_push_when_disabled(client, db, monkeypatch):
    called = []
    monkeypatch.setattr("services.push.requests.post", lambda *a, **k: called.append(1))
    _register(client, "bob", TOKEN_A)
    client.post("/api/friends/request", json={"uid": "bob"}, headers=_h("alice"))
    assert called == []
