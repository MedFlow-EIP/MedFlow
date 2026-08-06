import os


class Config:
    """Base configuration shared by all environments."""
    TESTING = False
    DATABASE_PATH = os.getenv(
        "DATABASE_PATH",
        os.path.join(os.path.dirname(__file__), "data", "medflow.db"),
    )
    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", "uploads")
    # AI provider: "vertexai" | "ollama"
    AI_PROVIDER = os.getenv("AI_PROVIDER", "vertexai")
    OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")
    # GCP / Vertex AI
    GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID")
    GCP_LOCATION = os.getenv("GCP_LOCATION", "us-central1")
    # When True, require a valid Firebase ID token (Authorization: Bearer <token>).
    # When False (dev/test), fall back to trusting the raw X-User-UID header.
    FIREBASE_VERIFY = os.getenv("FIREBASE_VERIFY", "true").lower() == "true"
    VERSION = "2.0.0"


class DevelopmentConfig(Config):
    """Local development: skip token verification for convenience."""
    FIREBASE_VERIFY = False


class ProductionConfig(Config):
    """Production: always verify Firebase tokens."""
    FIREBASE_VERIFY = True


class TestingConfig(Config):
    """Automated tests: temporary file DB (set by conftest), no token verification."""
    TESTING = True
    FIREBASE_VERIFY = False
    # DATABASE_PATH is overridden per-test by conftest.py via a tmp_path fixture


# Mapping used by the app factory
config_map = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
}
