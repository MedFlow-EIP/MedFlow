import json
import logging
import os

import requests

from .base import AIProvider

logger = logging.getLogger(__name__)


class OllamaProvider(AIProvider):
    """AI provider backed by a local Ollama instance.

    Recommended model: ``llama3.2`` (good balance of quality and speed for
    medical text summarisation and Q&A generation).

    Configure via environment variables:
      AI_PROVIDER=ollama
      OLLAMA_BASE_URL=http://localhost:11434   (default)
      OLLAMA_MODEL=llama3.2                   (default)
    """

    def __init__(self, base_url: str = "http://localhost:11434", model: str = "llama3.2"):
        self.base_url = base_url.rstrip("/")
        self.model = model
        logger.info("OllamaProvider initialised (base_url=%s, model=%s)", self.base_url, self.model)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _generate(self, prompt: str) -> str:
        """Send a prompt to Ollama and return the response text."""
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
        }
        resp = requests.post(url, json=payload, timeout=120)
        resp.raise_for_status()
        data = resp.json()
        return data.get("response", "")

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

    # ------------------------------------------------------------------
    # AIProvider interface
    # ------------------------------------------------------------------

    def generate_flashcards(self, text: str, num_cards: int = 5) -> list:
        try:
            truncated = text[:2500]
            prompt = f"""Voici un extrait médical :

{truncated}

Génère {num_cards} flashcards simples (question + réponse concise).
Retourne UNIQUEMENT du JSON valide, sans explication ni markdown :
[
  {{"question": "Q1", "answer": "R1"}},
  {{"question": "Q2", "answer": "R2"}}
]"""
            raw = self._generate(prompt)
            return json.loads(self._clean_json(raw))
        except Exception as e:
            logger.error("OllamaProvider.generate_flashcards error: %s", e)
            return [{"question": "Erreur", "answer": str(e)}]

    def generate_summary(self, text: str) -> str:
        try:
            truncated = text[:4000]
            prompt = f"""Voici un texte médical :

{truncated}

Donne un résumé clair et structuré en HTML pur.
Utilise <h2>, <h3>, <ul>, <li>, <p> pour organiser.
N'utilise pas de Markdown, pas de balises <html>/<body>, pas de blocs de code.
Retourne uniquement le HTML."""
            html = self._generate(prompt).strip()
            for marker in ["```html", "```", "<html>", "</html>", "<body>", "</body>"]:
                html = html.replace(marker, "")
            return html.strip()
        except Exception as e:
            logger.error("OllamaProvider.generate_summary error: %s", e)
            return f"<p><strong>Erreur résumé :</strong> {e}</p>"

    def generate_quiz(self, text: str, num_questions: int = 5) -> list:
        try:
            truncated = text[:4000]
            prompt = f"""Voici un texte médical :

{truncated}

Crée {num_questions} QCM avec 4 options (A, B, C, D).
Retourne UNIQUEMENT du JSON valide :
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
    "explanation": "Explication courte (1-2 phrases) de pourquoi c'est la bonne réponse"
  }}
]"""
            raw = self._generate(prompt)
            return json.loads(self._clean_json(raw))
        except Exception as e:
            logger.error("OllamaProvider.generate_quiz error: %s", e)
            return [{"question": "Erreur", "options": {"A": "x", "B": "y", "C": "z", "D": "w"}, "correct": "A", "explanation": ""}]

    def generate_title(self, text: str, filename: str) -> str:
        try:
            truncated = text[:1000]
            prompt = f"""Voici un extrait d'un document médical :

{truncated}

Donne UNIQUEMENT un titre clair et court (max 10 mots).
Pas de phrases complètes, pas de guillemets, pas de ponctuation.
Exemple : Cardiologie - Bases essentielles"""
            title = self._generate(prompt).strip()
            if not title or len(title) < 3:
                return os.path.splitext(filename)[0]
            return title
        except Exception as e:
            logger.error("OllamaProvider.generate_title error: %s", e)
            return os.path.splitext(filename)[0]