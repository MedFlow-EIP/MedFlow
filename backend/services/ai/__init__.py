from .base import AIProvider
from .ollama_provider import OllamaProvider


def _setting(config, key, default):
    # app.config (dict Flask) ou objet de config (classe Config, tests).
    if isinstance(config, dict):
        return config.get(key, default)
    return getattr(config, key, default)


def get_ai_provider(config) -> AIProvider:
    """Return the configured AI provider instance."""
    if _setting(config, "AI_PROVIDER", "vertexai") == "ollama":
        return OllamaProvider(
            base_url=_setting(config, "OLLAMA_BASE_URL", "http://localhost:11434"),
            model=_setting(config, "OLLAMA_MODEL", "llama3.2"),
        )
    # Lazy import so tests without vertexai installed still work
    from .vertexai_provider import VertexAIProvider
    return VertexAIProvider(
        project_id=_setting(config, "GCP_PROJECT_ID", None),
        location=_setting(config, "GCP_LOCATION", "us-central1"),
        chat_model=_setting(config, "AI_CHAT_MODEL", "gemini-2.5-pro"),
        course_model=_setting(config, "AI_COURSE_MODEL", "gemini-2.5-pro"),
        max_output_tokens=_setting(config, "AI_MAX_OUTPUT_TOKENS", 8192),
        max_input_chars=_setting(config, "COURSE_TEXT_MAX_CHARS", 30000),
    )


__all__ = ["AIProvider", "OllamaProvider", "get_ai_provider"]
