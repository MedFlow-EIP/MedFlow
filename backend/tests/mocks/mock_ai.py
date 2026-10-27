"""Mock AI provider for deterministic testing without real AI calls."""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from services.ai.base import AIProvider


class MockAIProvider(AIProvider):
    """Returns static, deterministic test data.  No network calls."""

    def generate_flashcards(self, text: str, num_cards: int = 5) -> list:
        return [
            {"question": f"Question {i + 1}", "answer": f"Réponse {i + 1}"}
            for i in range(num_cards)
        ]

    def generate_summary(self, text: str) -> str:
        return "<h2>Résumé Mock</h2><p>Contenu de test généré par MockAIProvider.</p>"

    def generate_quiz(self, text: str, num_questions: int = 5, difficulty: str = "normal") -> list:
        self.last_quiz_difficulty = difficulty
        return [
            {
                "question": f"Question QCM {i + 1}",
                "options": {"A": "Option A", "B": "Option B", "C": "Option C", "D": "Option D"},
                "correct": "A",
            }
            for i in range(num_questions)
        ]

    def generate_title(self, text: str, filename: str) -> str:
        return "Cours de Test - Titre Mock"

    def __init__(self):
        # Derniers arguments reçus par medical_chat, pour vérifier ce qui part au modèle.
        self.last_chat_call = None
        # Texte renvoyé par la « lecture » d'une image ou d'un PDF scanné.
        self.transcription = "Texte lu sur la photo : le coeur a quatre cavités."
        self.transcribe_calls = []

    def generate_clinical_case(self, material: str, difficulty: str = "normal"):
        self.last_case_material = material
        if getattr(self, "case_fails", False):
            return None
        return {
            "title": "Douleur thoracique chez un homme de 58 ans",
            "context": "Homme de 58 ans, fumeur, douleur thoracique constrictive depuis 40 minutes.",
            "steps": [
                {
                    "situation": f"Étape {i + 1} : nouveaux éléments.",
                    "question": f"Décision {i + 1} ?",
                    "options": {"A": "Choix A", "B": "Choix B", "C": "Choix C", "D": "Choix D"},
                    "correct": "B",
                    "feedback": {k: f"Retour {k}{i}" for k in "ABCD"},
                    "explanation": f"Raisonnement {i + 1}.",
                }
                for i in range(4)
            ],
            "debrief": ["Point clé 1", "Point clé 2", "Point clé 3"],
        }

    def transcribe_audio(self, data: bytes, mime_type: str) -> str:
        self.audio_calls = getattr(self, "audio_calls", []) + [mime_type]
        return getattr(self, "audio_transcription", "Quels sont les signes d'un infarctus ?")

    def transcribe_document(self, data: bytes, mime_type: str) -> str:
        self.transcribe_calls.append(mime_type)
        return self.transcription

    def generate_chat_title(self, question: str, answer: str) -> str:
        return "Cycle cardiaque"

    def medical_chat(self, user_message: str, history: list | None = None, attachments: list | None = None,
                     context: str | None = None) -> str:
        self.last_chat_call = {"user_message": user_message, "history": history or [], "attachments": attachments or [],
                               "context": context}
        return f"Réponse mock à : {user_message}"
