"""Fournisseur Vertex via google-genai : appels construits correctement,
sans réseau (client remplacé par un faux)."""
from unittest.mock import MagicMock, patch

import pytest

genai = pytest.importorskip("google.genai")


@pytest.fixture
def provider(monkeypatch):
    monkeypatch.setenv("GCP_PRIVATE_KEY", "cle")
    from services.ai.vertexai_provider import VertexAIProvider

    with patch("services.ai.vertexai_provider.service_account.Credentials.from_service_account_info"), \
            patch("services.ai.vertexai_provider.genai.Client") as client_cls:
        p = VertexAIProvider(project_id="projet", chat_model="modele-chat", course_model="modele-cours",
                             max_output_tokens=321)
    p.client = client_cls.return_value
    return p


def _reply(provider, text):
    provider.client.models.generate_content.return_value = MagicMock(text=text)


def _call(provider):
    return provider.client.models.generate_content.call_args.kwargs


def test_quiz_asks_for_json(provider):
    _reply(provider, '[{"question": "Q", "options": {"A": "a"}, "correct": "A"}]')
    assert provider.generate_quiz("texte")[0]["question"] == "Q"
    kwargs = _call(provider)
    assert kwargs["model"] == "modele-cours"
    assert kwargs["config"].response_mime_type == "application/json"
    assert kwargs["config"].max_output_tokens == 321


def test_flashcards_tolerate_code_fences(provider):
    _reply(provider, '```json\n[{"question": "Q", "answer": "R"}]\n```')
    assert provider.generate_flashcards("texte") == [{"question": "Q", "answer": "R"}]


def test_chat_uses_chat_model_and_attachments(provider):
    _reply(provider, " Réponse ")
    assert provider.medical_chat("Bonjour", attachments=[(b"img", "image/png")]) == "Réponse"
    kwargs = _call(provider)
    assert kwargs["model"] == "modele-chat"
    assert kwargs["config"].response_mime_type is None
    assert len(kwargs["contents"]) == 2  # pièce jointe + texte


def test_errors_are_contained(provider):
    provider.client.models.generate_content.side_effect = RuntimeError("404 model not found")
    assert provider.generate_summary("texte").startswith("<p>")
    assert provider.medical_chat("Bonjour") == "Une erreur est survenue."
    assert provider.transcribe_document(b"x", "image/png") == ""


def test_no_client_when_init_fails(monkeypatch):
    monkeypatch.delenv("GCP_PRIVATE_KEY", raising=False)
    from services.ai.vertexai_provider import VertexAIProvider

    p = VertexAIProvider(project_id="projet")
    assert p.client is None
    assert p.generate_title("texte", "cours.pdf") == "cours"
