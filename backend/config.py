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
    # Routes /api/debug/* : désactivées sauf ENABLE_DEBUG_ROUTES=true explicite
    # (le conteneur peut tourner en config "development" si FLASK_ENV n'est pas défini).
    ENABLE_DEBUG_ROUTES = os.getenv("ENABLE_DEBUG_ROUTES", "false").lower() == "true"
    # Taille max d'une requête (PDF de 20 Mo + marge multipart, pièces jointes du chat en base64).
    MAX_CONTENT_LENGTH = 32 * 1024 * 1024
    # Taille max d'un PDF importé.
    MAX_PDF_BYTES = 20 * 1024 * 1024

    # --- Garde-fous de coût IA (Vertex AI est facturé au token) ---
    # Modèles, surchargeables par variable d'env. Gemini 2.5 Pro est le seul
    # disponible sur le projet Vertex (les modèles « flash » y renvoient 404).
    AI_CHAT_MODEL = os.getenv("AI_CHAT_MODEL", "gemini-2.5-pro")
    AI_COURSE_MODEL = os.getenv("AI_COURSE_MODEL", "gemini-2.5-pro")
    # Plafond de tokens générés par appel (réflexion du modèle comprise).
    AI_MAX_OUTPUT_TOKENS = int(os.getenv("AI_MAX_OUTPUT_TOKENS", "8192"))
    # Quotas par utilisateur (glissants) : messages de chat et imports de PDF.
    AI_CHAT_PER_MINUTE = int(os.getenv("AI_CHAT_PER_MINUTE", "6"))
    AI_CHAT_PER_DAY = int(os.getenv("AI_CHAT_PER_DAY", "60"))
    AI_PROCESS_PER_HOUR = int(os.getenv("AI_PROCESS_PER_HOUR", "5"))
    AI_PROCESS_PER_DAY = int(os.getenv("AI_PROCESS_PER_DAY", "10"))
    # Plafond global sur 24 h (tous comptes confondus) : coupe-circuit si
    # quelqu'un crée des comptes en masse pour contourner les quotas.
    AI_GLOBAL_PER_DAY = int(os.getenv("AI_GLOBAL_PER_DAY", "2000"))
    # Taille de ce qui part au modèle depuis le chat.
    CHAT_MAX_MESSAGE_CHARS = 2000
    CHAT_HISTORY_MESSAGES = 12
    CHAT_MAX_PDF_PAGES = 30
    # Photos et PDF scannés importés comme cours : lus page par page par l'IA.
    PROCESS_MAX_SCANNED_PAGES = 30
    # Texte d'une réponse du chat transformé en flashcards.
    FLASHCARDS_FROM_TEXT_MAX_CHARS = 8000


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
    ENABLE_DEBUG_ROUTES = True
    # Quotas larges : les tests qui les vérifient les abaissent eux-mêmes.
    AI_CHAT_PER_MINUTE = 1000
    AI_CHAT_PER_DAY = 1000
    AI_PROCESS_PER_HOUR = 1000
    AI_PROCESS_PER_DAY = 1000
    AI_GLOBAL_PER_DAY = 100000
    # Jamais de vraie notification push pendant les tests.
    PUSH_ENABLED = False
    PUSH_ASYNC = False
    # DATABASE_PATH is overridden per-test by conftest.py via a tmp_path fixture


# Mapping used by the app factory
config_map = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
}
