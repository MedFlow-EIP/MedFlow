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

    def generate_quiz(self, text: str, num_questions: int = 5) -> list:
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
