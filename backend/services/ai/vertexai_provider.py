import json
import logging
import os

import vertexai
from vertexai.generative_models import GenerativeModel
from google.oauth2 import service_account

from .base import AIProvider

logger = logging.getLogger(__name__)

_GEMINI_MODEL = "gemini-2.5-pro"




class VertexAIProvider(AIProvider):
    """AI provider backed by Google Vertex AI (Gemini 2.5 Pro)."""

    def __init__(
        self,
        project_id: str | None = None,
        location: str = "us-central1",
    ):

        try:

            project_id = (
                project_id
                or os.getenv("GCP_PROJECT_ID")
            )

            credentials_info = {
                "type": os.getenv("GCP_TYPE"),
                "project_id": os.getenv("GCP_PROJECT_ID"),
                "private_key_id": os.getenv("GCP_PRIVATE_KEY_ID"),
                "private_key": os.getenv("GCP_PRIVATE_KEY").replace("\\n", "\n"),
                "client_email": os.getenv("GCP_CLIENT_EMAIL"),
                "client_id": os.getenv("GCP_CLIENT_ID"),
                "auth_uri": os.getenv("GCP_AUTH_URI"),
                "token_uri": os.getenv("GCP_TOKEN_URI"),
                "auth_provider_x509_cert_url": os.getenv("GCP_AUTH_PROVIDER_X509_CERT_URL"),
                "client_x509_cert_url": os.getenv("GCP_CLIENT_X509_CERT_URL"),
                "universe_domain": os.getenv("GCP_UNIVERSE_DOMAIN"),
            }

            credentials = service_account.Credentials.from_service_account_info(
                credentials_info
            )

            vertexai.init(
                project=project_id,
                location=location,
                credentials=credentials,
            )

            logger.info(
                "Vertex AI initialised (project=%s, location=%s)",
                project_id,
                location,
            )

        except Exception as e:

            logger.error(
                "Erreur initialisation Vertex AI: %s",
                e,
            )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _clean_json(raw: str) -> str:
        s = raw.strip()
        if s.startswith("```json"):
            s = s[7:]
        if s.startswith("```"):
            s = s[3:]
        if s.endswith("```"):
            s = s[:-3]
        return s.strip()

    @staticmethod
    def _model() -> GenerativeModel:
        return GenerativeModel(
            _GEMINI_MODEL,
            system_instruction="""
    Tu es un assistant IA spécialisé uniquement en médecine et santé.

    Si la question n'est pas liée à la médecine :
    "Je suis spécialisé uniquement dans le domaine médical et de la santé."

    Les salutations simples sont autorisées.
    """
        )

    # ------------------------------------------------------------------
    # AIProvider interface
    # ------------------------------------------------------------------

    def generate_flashcards(self, text: str, num_cards: int = 5) -> list:
        try:
            truncated = text[:2500]
            prompt = f"""
        Voici un extrait médical :

        {truncated}

        Génère {num_cards} flashcards simples (question + réponse concise).
        Format JSON uniquement :
        [
          {{"question": "Q1", "answer": "R1"}},
          {{"question": "Q2", "answer": "R2"}}
        ]
        """
            response = self._model().generate_content(prompt, stream=False)
            return json.loads(self._clean_json(response.text))
        except Exception as e:
            logger.error("Erreur flashcards: %s", e)
            return [{"question": "Erreur", "answer": str(e)}]

    def generate_summary(self, text: str) -> str:
        try:
            truncated = text[:4000]
            prompt = f"""
        Voici un texte médical :

        {truncated}

        Donne un résumé clair et structuré en **HTML pur**.
        Utilise <h2>, <h3>, <ul>, <li>, <p> pour organiser.
        ❌ Pas de Markdown
        ❌ Pas de balises <html> ni <body>
        ❌ Pas de ```html ou ```
        """
            response = self._model().generate_content(prompt)
            html = response.text.strip()
            for marker in ["```html", "```", "<html>", "</html>", "<body>", "</body>"]:
                html = html.replace(marker, "")
            return html.strip()
        except Exception as e:
            logger.error("Erreur résumé: %s", e)
            return f"<p><strong>Erreur résumé :</strong> {e}</p>"

    def generate_quiz(self, text: str, num_questions: int = 5) -> list:
        try:
            truncated = text[:4000]
            prompt = f"""
        Voici un texte médical :

        {truncated}

        Crée {num_questions} QCM avec 4 options (A, B, C, D).
        Format JSON:
        [
          {{
            "question": "Question 1",
            "options": {{
              "A": "Option A",
              "B": "Option B",
              "C": "Option C",
              "D": "Option D"
            }},
            "correct": "A"
          }}
        ]
        Retourne UNIQUEMENT du JSON.
        """
            response = self._model().generate_content(prompt)
            return json.loads(self._clean_json(response.text))
        except Exception as e:
            logger.error("Erreur quiz: %s", e)
            return [{"question": "Erreur", "options": {"A": "x", "B": "y", "C": "z", "D": "w"}, "correct": "A"}]

    def generate_title(self, text: str, filename: str) -> str:
        try:
            truncated = text[:1000]
            prompt = f"""
        Voici un extrait d'un document médical :

        {truncated}

        Donne UNIQUEMENT un titre clair et court (max 10 mots).
        Pas de phrases complètes, pas de guillemets, pas de ponctuation.
        Exemple : "Cardiologie - Bases essentielles"
        """
            response = self._model().generate_content(prompt, stream=False)
            title = response.text.strip()
            if not title or len(title) < 3:
                return os.path.splitext(filename)[0]
            return title
        except Exception as e:
            logger.error("Erreur génération titre: %s", e)
            return os.path.splitext(filename)[0]

    def medical_chat(
        self,
        user_message: str,
        history: list | None = None,
    ) -> str:

        try:

            system_prompt = """
    Tu es un assistant IA spécialisé UNIQUEMENT dans le domaine médical et des études de médecine.

    Règles importantes :
    - Réponds uniquement aux questions liées à :
    - médecine
    - anatomie
    - physiologie
    - pharmacologie
    - maladies
    - soins
    - études médicales
    - biologie médicale
    - santé
    - imagerie médicale
    - examens médicaux
    - nutrition médicale

    - Si la question n'est PAS liée à la médecine ou à la santé :
    Réponds UNIQUEMENT :
    "Je suis spécialisé uniquement dans le domaine médical et de la santé."

    - Réponses :
    - claires
    - structurées
    - pédagogiques
    - précises
    - en français

    - Ne jamais inventer d'informations médicales.
    - Ne jamais poser de diagnostic définitif.
    - Toujours préciser qu'un professionnel de santé doit être consulté en cas de doute.
    """

            prompt = system_prompt + "\n\n"

            if history:

                prompt += "Historique conversation :\n\n"

                for msg in history:

                    role = (
                        "Assistant"
                        if msg["role"] == "assistant"
                        else "Utilisateur"
                    )

                    prompt += f"{role}: {msg['content']}\n"

            prompt += f"\nUtilisateur: {user_message}\nAssistant:"

            response = self._model().generate_content(
                prompt,
                stream=False,
            )

            return response.text.strip()

        except Exception as e:

            logger.error("Erreur medical_chat: %s", e)

            return "Une erreur est survenue."