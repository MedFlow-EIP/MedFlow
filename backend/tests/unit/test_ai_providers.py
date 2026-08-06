"""Unit tests for the AI provider abstraction layer."""
import pytest
from unittest.mock import MagicMock, patch

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from tests.mocks.mock_ai import MockAIProvider


# ---------------------------------------------------------------------------
# MockAIProvider contract tests
# ---------------------------------------------------------------------------

class TestMockAIProvider:
    def setup_method(self):
        self.ai = MockAIProvider()

    def test_generate_flashcards_returns_list(self):
        result = self.ai.generate_flashcards("some text")
        assert isinstance(result, list)
        assert len(result) == 5

    def test_generate_flashcards_custom_count(self):
        result = self.ai.generate_flashcards("text", num_cards=3)
        assert len(result) == 3

    def test_flashcard_has_required_keys(self):
        result = self.ai.generate_flashcards("text")
        for card in result:
            assert "question" in card
            assert "answer" in card

    def test_generate_summary_returns_html_string(self):
        result = self.ai.generate_summary("text")
        assert isinstance(result, str)
        assert "<" in result  # contains HTML

    def test_generate_quiz_returns_list(self):
        result = self.ai.generate_quiz("text")
        assert isinstance(result, list)
        assert len(result) == 5

    def test_quiz_question_has_required_keys(self):
        result = self.ai.generate_quiz("text")
        for q in result:
            assert "question" in q
            assert "options" in q
            assert "correct" in q
            assert len(q["options"]) == 4

    def test_generate_title_returns_string(self):
        result = self.ai.generate_title("text", "myfile.pdf")
        assert isinstance(result, str)
        assert len(result) > 0


# ---------------------------------------------------------------------------
# OllamaProvider — mocked HTTP
# ---------------------------------------------------------------------------

class TestOllamaProvider:
    def _make_provider(self):
        from services.ai.ollama_provider import OllamaProvider
        return OllamaProvider(base_url="http://localhost:11434", model="llama3.2")

    def test_generate_flashcards_parses_json(self):
        provider = self._make_provider()
        mock_response = '[{"question": "Q1", "answer": "A1"}]'
        with patch.object(provider, "_generate", return_value=mock_response):
            result = provider.generate_flashcards("text")
        assert result == [{"question": "Q1", "answer": "A1"}]

    def test_generate_summary_returns_html(self):
        provider = self._make_provider()
        with patch.object(provider, "_generate", return_value="<p>Summary</p>"):
            result = provider.generate_summary("text")
        assert "<p>" in result

    def test_generate_quiz_parses_json(self):
        provider = self._make_provider()
        mock_json = '[{"question":"Q","options":{"A":"a","B":"b","C":"c","D":"d"},"correct":"A"}]'
        with patch.object(provider, "_generate", return_value=mock_json):
            result = provider.generate_quiz("text")
        assert result[0]["correct"] == "A"

    def test_generate_title_returns_string(self):
        provider = self._make_provider()
        with patch.object(provider, "_generate", return_value="Cardiologie Avancée"):
            result = provider.generate_title("text", "cardio.pdf")
        assert result == "Cardiologie Avancée"

    def test_generate_fallback_on_invalid_json(self):
        provider = self._make_provider()
        with patch.object(provider, "_generate", return_value="not json at all"):
            result = provider.generate_flashcards("text")
        # Should return error fallback, not raise
        assert isinstance(result, list)
        assert result[0].get("question") == "Erreur"

    def test_generate_title_fallback_to_filename_on_error(self):
        provider = self._make_provider()
        with patch.object(provider, "_generate", side_effect=Exception("timeout")):
            result = provider.generate_title("text", "mon_cours.pdf")
        assert result == "mon_cours"

    def test_http_request_structure(self):
        """Verify _generate sends the right payload to Ollama."""
        provider = self._make_provider()
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"response": "hello"}
        mock_resp.raise_for_status = MagicMock()
        with patch("services.ai.ollama_provider.requests.post", return_value=mock_resp) as mock_post:
            provider._generate("test prompt")
        call_kwargs = mock_post.call_args
        payload = call_kwargs[1]["json"] if "json" in call_kwargs[1] else call_kwargs[0][1]
        assert payload["model"] == "llama3.2"
        assert payload["stream"] is False


# ---------------------------------------------------------------------------
# AI provider factory
# ---------------------------------------------------------------------------

class TestGetAIProvider:
    def test_returns_vertexai_by_default(self):
        from services.ai import get_ai_provider

        class FakeConfig:
            AI_PROVIDER = "vertexai"
            GCP_PROJECT_ID = None
            GCP_LOCATION = "us-central1"

        try:
            import vertexai  # noqa: F401
            from services.ai.vertexai_provider import VertexAIProvider
            with patch("services.ai.vertexai_provider.vertexai.init"):
                provider = get_ai_provider(FakeConfig())
            assert isinstance(provider, VertexAIProvider)
        except ImportError:
            pytest.skip("vertexai not installed — skipping VertexAIProvider test")

    def test_returns_ollama_when_configured(self):
        from services.ai import get_ai_provider
        from services.ai.ollama_provider import OllamaProvider

        class FakeConfig:
            AI_PROVIDER = "ollama"
            OLLAMA_BASE_URL = "http://localhost:11434"
            OLLAMA_MODEL = "llama3.2"

        provider = get_ai_provider(FakeConfig())
        assert isinstance(provider, OllamaProvider)
        assert provider.model == "llama3.2"
