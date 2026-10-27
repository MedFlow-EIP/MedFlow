from abc import ABC, abstractmethod


# Consigne ajoutée au prompt du quiz selon la difficulté choisie à l'import (F53).
QUIZ_DIFFICULTY = {
    "facile": (
        "Niveau FACILE : questions directes sur les notions principales et les définitions. "
        "Les mauvaises réponses sont clairement fausses pour qui a lu le cours."
    ),
    "normal": (
        "Niveau NORMAL : mélange de questions de connaissance et de compréhension, "
        "avec des mauvaises réponses vraisemblables."
    ),
    "difficile": (
        "Niveau DIFFICILE : questions d'application et de raisonnement (cas cliniques courts, "
        "comparaisons, mécanismes). Les mauvaises réponses sont très plausibles, proches de la "
        "bonne réponse, et reprennent les confusions et pièges classiques des examens."
    ),
}


class AIProvider(ABC):
    """Abstract base class for AI content generation providers."""

    @abstractmethod
    def generate_flashcards(self, text: str, num_cards: int = 5) -> list:
        """Generate a list of {question, answer} dicts from medical text."""
        ...

    @abstractmethod
    def generate_summary(self, text: str) -> str:
        """Generate an HTML-formatted summary from medical text."""
        ...

    @abstractmethod
    def generate_quiz(self, text: str, num_questions: int = 5, difficulty: str = "normal") -> list:
        """Generate a list of MCQ dicts {question, options{A,B,C,D}, correct}.

        difficulty : "facile", "normal" ou "difficile" (voir QUIZ_DIFFICULTY)."""
        ...

    @abstractmethod
    def generate_title(self, text: str, filename: str) -> str:
        """Generate a short descriptive course title (max 10 words)."""
        ...

    def generate_clinical_case(self, material: str, difficulty: str = "normal") -> dict | None:
        """Cas clinique interactif (F43) à partir d'un cours ou d'un sujet.

        Format attendu (validé par routes/cases.py) :
        {"title", "context", "steps": [{"situation", "question", "options": {A..D},
        "correct", "feedback": {A..D}, "explanation"}], "debrief": [points clés]}
        Renvoie None si le fournisseur ne sait pas le faire ou en cas d'échec."""
        return None

    def generate_chat_title(self, question: str, answer: str) -> str:
        """Titre court d'une conversation. Chaîne vide si non pris en charge."""
        return ""

    def transcribe_audio(self, data: bytes, mime_type: str) -> str:
        """Retranscrit une question dictée (F45). Chaîne vide si non pris en charge."""
        return ""

    def transcribe_document(self, data: bytes, mime_type: str) -> str:
        """Retranscrit le texte d'une image ou d'un PDF scanné (OCR).

        Renvoie une chaîne vide si le fournisseur ne sait pas lire les fichiers.
        """
        return ""
