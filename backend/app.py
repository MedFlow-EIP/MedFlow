"""MEDFLOW Flask application factory.

Usage
-----
Development (no Firebase token verification, trust X-User-UID header):
  python app.py

Production (verify Firebase ID tokens):
  FLASK_ENV=production python app.py

Tests:
  pytest tests/

AI provider selection:
  AI_PROVIDER=vertexai python app.py   # default — uses Google Gemini 2.5 Pro
  AI_PROVIDER=ollama   python app.py   # uses local Ollama (model: llama3.2)
"""
import logging
import os

from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS

load_dotenv()

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def create_app(config=None):
    """Application factory.

    Parameters
    ----------
    config:
        A config class (from ``config.py``) or ``None`` to auto-detect from
        the ``FLASK_ENV`` environment variable (defaults to DevelopmentConfig).
    """
    from config import DevelopmentConfig, ProductionConfig, config_map
    from database import Database
    from routes.account import account_bp
    from routes.courses import courses_bp
    from routes.health import health_bp
    from routes.paths import paths_bp
    from routes.sessions import sessions_bp
    from routes.chat import chat_bp
    from services.ai import get_ai_provider

    app = Flask(__name__)

    # ------------------------------------------------------------------
    # Configuration
    # ------------------------------------------------------------------
    if config is None:
        env = os.getenv("FLASK_ENV", "development")
        config = config_map.get(env, DevelopmentConfig)
    app.config.from_object(config)

    CORS(app)

    # ------------------------------------------------------------------
    # Database
    # ------------------------------------------------------------------
    db_path = app.config["DATABASE_PATH"]
    if db_path != ":memory:":
        os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
    db = Database(db_path)
    db.initialise()
    app.db = db

    # ------------------------------------------------------------------
    # Upload folder
    # ------------------------------------------------------------------
    upload_folder = app.config.get("UPLOAD_FOLDER", "uploads")
    os.makedirs(upload_folder, exist_ok=True)

    # ------------------------------------------------------------------
    # AI provider
    # ------------------------------------------------------------------
    try:
        app.ai = get_ai_provider(app.config)
    except Exception as e:
        logger.error("Failed to initialise AI provider: %s", e)
        app.ai = None

    # ------------------------------------------------------------------
    # Firebase Admin SDK (only when token verification is enabled)
    # ------------------------------------------------------------------
    if app.config.get("FIREBASE_VERIFY", False):
        _init_firebase()

    # ------------------------------------------------------------------
    # Blueprints
    # ------------------------------------------------------------------
    app.register_blueprint(health_bp)
    app.register_blueprint(courses_bp)
    app.register_blueprint(sessions_bp)
    app.register_blueprint(paths_bp)
    app.register_blueprint(account_bp)
    app.register_blueprint(chat_bp)

    # ------------------------------------------------------------------
    # Swagger / OpenAPI docs at /api/docs
    # ------------------------------------------------------------------
    _init_swagger(app)

    return app


def _init_firebase():
    """Initialise Firebase Admin SDK using GCP service-account env vars."""
    try:
        import json
        import firebase_admin
        from firebase_admin import credentials

        # Build credentials dict from individual GCP_* env vars (same pattern
        # already used by the existing Vertex AI setup).
        sa = {
            "type": os.getenv("GCP_TYPE", "service_account"),
            "project_id": os.getenv("GCP_PROJECT_ID", ""),
            "private_key_id": os.getenv("GCP_PRIVATE_KEY_ID", ""),
            "private_key": os.getenv("GCP_PRIVATE_KEY", "").replace("\\n", "\n"),
            "client_email": os.getenv("GCP_CLIENT_EMAIL", ""),
            "client_id": os.getenv("GCP_CLIENT_ID", ""),
            "auth_uri": os.getenv("GCP_AUTH_URI", "https://accounts.google.com/o/oauth2/auth"),
            "token_uri": os.getenv("GCP_TOKEN_URI", "https://oauth2.googleapis.com/token"),
            "auth_provider_x509_cert_url": os.getenv("GCP_AUTH_PROVIDER_X509_CERT_URL", ""),
            "client_x509_cert_url": os.getenv("GCP_CLIENT_X509_CERT_URL", ""),
            "universe_domain": os.getenv("GCP_UNIVERSE_DOMAIN", "googleapis.com"),
        }
        cred = credentials.Certificate(sa)
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred)
        logger.info("Firebase Admin SDK initialised")
    except Exception as e:
        logger.error("Firebase Admin SDK init failed: %s", e)


def _init_swagger(app: Flask):
    """Register Swagger UI at /api/docs using flasgger."""
    try:
        from flasgger import Swagger
        spec_path = os.path.join(os.path.dirname(__file__), "openapi.yaml")
        if os.path.exists(spec_path):
            swagger_config = {
                "headers": [],
                "specs": [
                    {
                        "endpoint": "apispec",
                        "route": "/api/docs/apispec.json",
                        "rule_filter": lambda rule: True,
                        "model_filter": lambda tag: True,
                    }
                ],
                "static_url_path": "/flasgger_static",
                "swagger_ui": True,
                "specs_route": "/api/docs",
            }
            Swagger(app, config=swagger_config, template_filename=spec_path)
            logger.info("Swagger UI available at /api/docs")
        else:
            logger.warning("openapi.yaml not found — Swagger UI disabled")
    except ImportError:
        logger.warning("flasgger not installed — Swagger UI disabled")
    except Exception as e:
        logger.error("Swagger init failed: %s", e)


if __name__ == "__main__":
    from config import ProductionConfig, DevelopmentConfig

    flask_env = os.getenv("FLASK_ENV", "development")
    cfg = ProductionConfig if flask_env == "production" else DevelopmentConfig

    application = create_app(cfg)
    application.run(debug=(flask_env != "production"), host="0.0.0.0", port=8080)
