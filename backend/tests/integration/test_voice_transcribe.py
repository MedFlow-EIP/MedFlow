"""Dictée vocale du chat (F45)."""
import base64


def _h(uid="u1"):
    return {"X-User-UID": uid, "X-User-Name": "Testeur"}


def _post(client, audio=b"\xff\xf1 audio", mime="audio/aac", uid="u1"):
    return client.post(
        "/chat/transcribe",
        json={"audio": base64.b64encode(audio).decode(), "mime_type": mime},
        headers=_h(uid),
    )


def test_returns_text(client, app):
    resp = _post(client)
    assert resp.status_code == 200
    assert resp.get_json()["text"] == "Quels sont les signes d'un infarctus ?"
    assert app.ai.audio_calls == ["audio/aac"]


def test_wav_from_ios(client):
    assert _post(client, mime="audio/wav").status_code == 200


def test_unsupported_format(client):
    assert _post(client, mime="video/mp4").status_code == 400


def test_invalid_base64(client):
    resp = client.post("/chat/transcribe", json={"audio": "%%%", "mime_type": "audio/aac"}, headers=_h())
    assert resp.status_code == 400


def test_too_long(client, app):
    app.config["MAX_AUDIO_BYTES"] = 10
    assert _post(client, audio=b"x" * 11).status_code == 413


def test_nothing_understood(client, app):
    app.ai.audio_transcription = ""
    assert _post(client).status_code == 422


def test_counts_in_chat_quota(client, app):
    app.config["AI_CHAT_PER_MINUTE"] = 1
    assert _post(client).status_code == 200
    assert _post(client).status_code == 429


def test_requires_auth(client):
    resp = client.post("/chat/transcribe", json={"audio": "", "mime_type": "audio/aac"})
    assert resp.status_code in (400, 401)
