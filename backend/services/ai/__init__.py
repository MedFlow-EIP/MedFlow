from .base import AIProvider
from .ollama_provider import OllamaProvider


def get_ai_provider(config) -> AIProvider:
    """Return the configured AI provider instance."""
    if getattr(config, "AI_PROVIDER", "vertexai") == "ollama":
        return OllamaProvider(
            base_url=getattr(config, "OLLAMA_BASE_URL", "http://localhost:11434"),
            model=getattr(config, "OLLAMA_MODEL", "llama3.2"),
        )
    # Lazy import so tests without vertexai installed still work
    from .vertexai_provider import VertexAIProvider
    return VertexAIProvider(
        project_id=getattr(config, "GCP_PROJECT_ID", None),
        location=getattr(config, "GCP_LOCATION", "us-central1"),
    )


__all__ = ["AIProvider", "OllamaProvider", "get_ai_provider"]
