from abc import ABC, abstractmethod


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
    def generate_quiz(self, text: str, num_questions: int = 5) -> list:
        """Generate a list of MCQ dicts {question, options{A,B,C,D}, correct}."""
        ...

    @abstractmethod
    def generate_title(self, text: str, filename: str) -> str:
        """Generate a short descriptive course title (max 10 words)."""
        ...
