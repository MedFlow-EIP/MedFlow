"""« Aujourd'hui » vu par l'utilisateur.

Le serveur tourne en UTC : entre minuit et 1 h (2 h l'été) en France, son
« aujourd'hui » est encore la veille, et les cartes du jour s'affichaient
pour demain. L'app envoie son décalage horaire (en-tête X-TZ-Offset, en
minutes, ex. 60 pour Paris l'hiver) ; sans requête ou sans en-tête valide,
on garde la date du serveur.
"""
from datetime import date, datetime, timedelta, timezone

from flask import has_request_context, request

MAX_OFFSET_MINUTES = 14 * 60


def user_today() -> date:
    if has_request_context():
        try:
            offset = int(request.headers.get("X-TZ-Offset", ""))
        except ValueError:
            offset = None
        if offset is not None and abs(offset) <= MAX_OFFSET_MINUTES:
            return (datetime.now(timezone.utc) + timedelta(minutes=offset)).date()
    return date.today()
