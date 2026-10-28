"""« Aujourd'hui » vu par l'utilisateur.

Le serveur tourne en UTC : entre minuit et 1 h (2 h l'été) en France, son
« aujourd'hui » est encore la veille, et les cartes du jour s'affichaient
pour demain. L'app envoie son décalage horaire (en-tête X-TZ-Offset, en
minutes, ex. 60 pour Paris l'hiver) ; sans requête ou sans en-tête valide,
on compte en UTC, comme les dates enregistrées.
"""
from datetime import date, datetime, timedelta, timezone

from flask import has_request_context, request

MAX_OFFSET_MINUTES = 14 * 60


def user_offset_minutes() -> int:
    """Décalage horaire de l'étudiant en minutes (0 si inconnu)."""
    if has_request_context():
        try:
            offset = int(request.headers.get("X-TZ-Offset", ""))
        except ValueError:
            return 0
        if abs(offset) <= MAX_OFFSET_MINUTES:
            return offset
    return 0


def user_today() -> date:
    return (datetime.now(timezone.utc) + timedelta(minutes=user_offset_minutes())).date()
