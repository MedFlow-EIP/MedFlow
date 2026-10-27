import json
import logging
import os

# SDK « google-genai » : remplace vertexai.generative_models, retiré par Google
# en juin 2026 (voir docs Vertex AI « genai-vertexai-sdk »).
from google import genai
from google.genai import types
from google.oauth2 import service_account

from .base import QUIZ_DIFFICULTY, AIProvider

CLINICAL_CASE_PROMPT = """
Crée un cas clinique interactif pour un étudiant en médecine, en français,
à partir du matériel ci-dessous (cours ou sujet). Le cas doit rester fidèle
au matériel et médicalement exact.

{difficulty}

Structure :
- "title" : titre court (ex. « Douleur thoracique chez un homme de 58 ans »).
- "context" : présentation du patient (âge, sexe, motif de consultation,
  antécédents, signes cliniques) en 3 à 6 phrases.
- "steps" : 4 étapes de décision, dans l'ordre de la prise en charge
  (hypothèse diagnostique, examen à demander, interprétation d'un résultat,
  traitement ou orientation…). Pour chaque étape :
  - "situation" : ce qui se passe à cette étape (nouveaux éléments,
    résultats d'examens…), qui découle de la bonne réponse précédente ;
  - "question" : la décision à prendre ;
  - "options" : 4 choix A, B, C, D, plausibles ;
  - "correct" : la lettre du meilleur choix ;
  - "feedback" : pour CHAQUE lettre, 1 à 2 phrases qui expliquent pourquoi
    ce choix est bon, insuffisant ou dangereux dans ce contexte précis ;
  - "explanation" : le raisonnement attendu, en 1 à 3 phrases.
- "debrief" : 3 à 5 points clés à retenir.

Matériel :
{material}

Réponds UNIQUEMENT avec le JSON.
"""

logger = logging.getLogger(__name__)

_SYSTEM_INSTRUCTION = """
    Tu es un assistant IA spécialisé uniquement en médecine et santé.

    Si la question n'est pas liée à la médecine :
    "Je suis spécialisé uniquement dans le domaine médical et de la santé."

    Les salutations simples sont autorisées.
    """


_SCOPES = ["https://www.googleapis.com/auth/cloud-platform"]


class VertexAIProvider(AIProvider):
    """AI provider backed by Google Vertex AI (Gemini), via le SDK google-genai."""

    def __init__(
        self,
        project_id: str | None = None,
        location: str = "us-central1",
        chat_model: str = "gemini-2.5-pro",
        course_model: str = "gemini-2.5-pro",
        max_output_tokens: int = 8192,
        max_input_chars: int = 30000,
    ):
        self.chat_model = chat_model
        self.course_model = course_model
        # Plafonne la facture d'un appel : sans ça, le modèle peut générer
        # (et facturer) des dizaines de milliers de tokens.
        self.max_output_tokens = max_output_tokens
        # Texte du cours envoyé à chaque génération : tout le cours (borné),
        # pas seulement ses premières pages.
        self.max_input_chars = max_input_chars
        self.client = None

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
                credentials_info, scopes=_SCOPES
            )

            self.client = genai.Client(
                vertexai=True,
                project=project_id,
                location=location,
                credentials=credentials,
            )

            logger.info(
                "Vertex AI initialised with google-genai (project=%s, location=%s)",
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

    def _generate(self, contents, model: str | None = None, json_output: bool = False) -> str:
        """Un appel Gemini ; renvoie le texte de la réponse.

        json_output : impose une réponse JSON valide (flashcards, quiz)."""
        if self.client is None:
            raise RuntimeError("Vertex AI non initialisé")
        response = self.client.models.generate_content(
            model=model or self.course_model,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=_SYSTEM_INSTRUCTION,
                max_output_tokens=self.max_output_tokens,
                response_mime_type="application/json" if json_output else None,
            ),
        )
        return response.text or ""

    @staticmethod
    def _part(data: bytes, mime_type: str):
        return types.Part.from_bytes(data=data, mime_type=mime_type)

    # ------------------------------------------------------------------
    # AIProvider interface
    # ------------------------------------------------------------------

    def generate_flashcards(self, text: str, num_cards: int = 5) -> list:
        try:
            truncated = text[: self.max_input_chars]
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
            return json.loads(self._clean_json(self._generate(prompt, json_output=True)))
        except Exception as e:
            logger.error("Erreur flashcards: %s", e)
            return [{"question": "Erreur", "answer": "Génération impossible, réimporte le cours."}]

    def generate_summary(self, text: str) -> str:
        try:
            truncated = text[: self.max_input_chars]
            prompt = f"""
        Voici un texte médical :

        {truncated}

        Donne un résumé clair et structuré en **HTML pur**.
        Utilise <h2>, <h3>, <ul>, <li>, <p> pour organiser.
        ❌ Pas de Markdown
        ❌ Pas de balises <html> ni <body>
        ❌ Pas de ```html ou ```
        """
            html = self._generate(prompt).strip()
            for marker in ["```html", "```", "<html>", "</html>", "<body>", "</body>"]:
                html = html.replace(marker, "")
            return html.strip()
        except Exception as e:
            logger.error("Erreur résumé: %s", e)
            return "<p><strong>Le résumé n'a pas pu être généré.</strong></p>"

    def generate_quiz(self, text: str, num_questions: int = 5, difficulty: str = "normal") -> list:
        try:
            truncated = text[: self.max_input_chars]
            prompt = f"""
        Voici un texte médical :

        {truncated}

        Crée {num_questions} QCM avec 4 options (A, B, C, D).
        {QUIZ_DIFFICULTY.get(difficulty, QUIZ_DIFFICULTY["normal"])}
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
            "correct": "A",
            "explanation": "Une ou deux phrases expliquant pourquoi A est la bonne réponse."
          }}
        ]
        L'explication s'appuie sur le texte fourni et reste courte.
        Retourne UNIQUEMENT du JSON.
        """
            return json.loads(self._clean_json(self._generate(prompt, json_output=True)))
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
            title = self._generate(prompt).strip()
            if not title or len(title) < 3:
                return os.path.splitext(filename)[0]
            return title
        except Exception as e:
            logger.error("Erreur génération titre: %s", e)
            return os.path.splitext(filename)[0]

    def transcribe_document(self, data: bytes, mime_type: str) -> str:
        """Lit une photo de cours ou un PDF scanné et renvoie son texte."""
        try:
            prompt = """
        Retranscris fidèlement tout le texte lisible de ce document de cours
        (titres, paragraphes, listes, légendes, tableaux en lignes), dans l'ordre.
        Pour chaque schéma, figure, image ou graphique, ajoute à l'endroit où il
        apparaît une ligne « [Schéma : … » qui décrit précisément ce qu'il montre :
        structures, légendes, flèches, étapes, valeurs. Ces descriptions servent
        à créer des questions de révision sur les schémas.
        N'ajoute aucun autre commentaire, aucun Markdown.
        S'il n'y a aucun texte lisible, réponds uniquement : AUCUN_TEXTE
        """
            text = self._generate([self._part(data, mime_type), prompt]).strip()
            return "" if text == "AUCUN_TEXTE" else text
        except Exception as e:
            logger.error("Erreur lecture document: %s", e)
            return ""

    def generate_clinical_case(self, material: str, difficulty: str = "normal") -> dict | None:
        try:
            prompt = CLINICAL_CASE_PROMPT.format(
                difficulty=QUIZ_DIFFICULTY.get(difficulty, QUIZ_DIFFICULTY["normal"]),
                material=material[: self.max_input_chars],
            )
            return json.loads(self._clean_json(self._generate(prompt, json_output=True)))
        except Exception as e:
            logger.error("Erreur cas clinique: %s", e)
            return None

    def transcribe_audio(self, data: bytes, mime_type: str) -> str:
        """Dictée vocale du chat : retranscrit mot pour mot ce que l'utilisateur a dit."""
        try:
            prompt = (
                "Retranscris mot pour mot ce que dit la personne dans cet enregistrement, en français, "
                "avec la ponctuation. Écris correctement les termes médicaux. Ne réponds pas à la question, "
                "n'ajoute rien. Si rien n'est compréhensible, réponds uniquement : AUCUN_TEXTE"
            )
            text = self._generate([self._part(data, mime_type), prompt], model=self.chat_model).strip()
            return "" if text == "AUCUN_TEXTE" else text
        except Exception as e:
            logger.error("Erreur dictée: %s", e)
            return ""

    def medical_chat(
        self,
        user_message: str,
        history: list | None = None,
        attachments: list | None = None,
    ) -> str:
        """``attachments`` : liste de (octets, mime_type) — images ou PDF lus par Gemini."""

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

    - Schémas : quand l'utilisateur demande un schéma, un dessin ou un
      diagramme (ou quand un schéma aide vraiment à comprendre), ajoute UN
      schéma dans un bloc de code ```svg … ``` puis explique-le en texte.
      Règles du SVG : une seule balise <svg> avec viewBox="0 0 400 300"
      (ou une hauteur adaptée), fond blanc, formes simples (rect, circle,
      ellipse, line, path, polygon, text), flèches avec des <path> ou
      <polygon>, texte en français en font-family="sans-serif" et
      font-size 11 à 14, couleurs sobres (#2563eb, #10b981, #f59e0b,
      #ef4444, #111827). Pas de script, d'image, de lien ni de <foreignObject>.
      Privilégie des schémas lisibles : étapes, cycles, voies, coupes simplifiées
      avec des légendes reliées par des traits.

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

            if attachments:
                prompt += "\n(L'utilisateur a joint des fichiers : appuie-toi dessus pour répondre.)\n"

            prompt += f"\nUtilisateur: {user_message}\nAssistant:"

            parts = [self._part(data, mime) for data, mime in (attachments or [])]

            return self._generate([*parts, prompt] if parts else prompt, model=self.chat_model).strip()

        except Exception as e:

            logger.error("Erreur medical_chat: %s", e)

            return "Une erreur est survenue."