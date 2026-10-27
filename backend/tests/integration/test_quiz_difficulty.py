"""Difficulté du quiz choisie à l'import (F53)."""
import io

import pytest

from services.ai.base import QUIZ_DIFFICULTY


def _upload(client, **form):
    return client.post(
        "/api/process",
        data={"file": (io.BytesIO(b"\xff\xd8\xff"), "photo.jpg"), **form},
        headers={"X-User-UID": "u1", "X-User-Name": "T"},
        content_type="multipart/form-data",
    )


@pytest.mark.parametrize("level", ["facile", "normal", "difficile"])
def test_difficulty_reaches_the_quiz_prompt(client, app, level):
    assert _upload(client, difficulty=level).status_code == 200
    assert app.ai.last_quiz_difficulty == level


def test_default_is_normal(client, app):
    _upload(client)
    assert app.ai.last_quiz_difficulty == "normal"


def test_invalid_difficulty(client, app):
    resp = _upload(client, difficulty="extrême")
    assert resp.status_code == 400
    assert app.ai.transcribe_calls == []  # refusé avant tout appel IA


def test_each_level_has_instructions():
    assert set(QUIZ_DIFFICULTY) == {"facile", "normal", "difficile"}
    assert "DIFFICILE" in QUIZ_DIFFICULTY["difficile"]
