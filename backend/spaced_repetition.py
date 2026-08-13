"""Algorithme SM-2 (SuperMemo 2) de répétition espacée.

Référence : Piotr Wozniak, SuperMemo (1987) — l'algorithme derrière Anki et
la plupart des systèmes de répétition espacée modernes. Principe : plus une
carte est bien sue, plus l'intervalle avant la prochaine révision s'allonge
(courbe de l'oubli d'Ebbinghaus) ; une carte mal sue repart de zéro.

``quality`` va de 0 à 5 :
    0 = trou noir total       3 = correct, mais difficile
    1 = incorrect, reconnu    4 = correct, léger effort
    2 = incorrect, presque    5 = parfait, immédiat
"""
from dataclasses import dataclass
from datetime import date, timedelta


@dataclass
class CardSchedule:
    ease_factor: float = 2.5
    interval_days: int = 0
    repetitions: int = 0


# En-dessous de ce seuil de qualité, la carte est considérée comme "ratée" :
# on repart de zéro (intervalle 1 jour), peu importe l'historique précédent.
QUALITY_PASS_THRESHOLD = 3

MIN_EASE_FACTOR = 1.3


def next_schedule(current: CardSchedule, quality: int) -> CardSchedule:
    """Calcule le prochain intervalle de révision selon SM-2.

    ``quality`` doit être un entier entre 0 et 5 inclus (voir docstring du
    module). Une valeur hors de cet intervalle est bornée automatiquement
    plutôt que de lever une exception — un mauvais input ne doit jamais
    faire planter une session de révision en cours.
    """
    quality = max(0, min(5, quality))

    new_ease = current.ease_factor + (
        0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
    )
    new_ease = max(MIN_EASE_FACTOR, new_ease)

    if quality < QUALITY_PASS_THRESHOLD:
        # Échec : on repart de zéro, mais l'ease factor dégradé reste —
        # une carte échouée plusieurs fois aura des intervalles plus courts
        # même une fois qu'elle recommence à être réussie.
        return CardSchedule(ease_factor=new_ease, interval_days=1, repetitions=0)

    repetitions = current.repetitions + 1
    if repetitions == 1:
        interval = 1
    elif repetitions == 2:
        interval = 6
    else:
        interval = round(current.interval_days * new_ease)

    return CardSchedule(ease_factor=new_ease, interval_days=interval, repetitions=repetitions)


def next_review_date(schedule: CardSchedule, from_date: date | None = None) -> date:
    """Date de la prochaine révision, calculée depuis ``from_date`` (aujourd'hui par défaut)."""
    base = from_date or date.today()
    return base + timedelta(days=schedule.interval_days)