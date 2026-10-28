"""« Aujourd'hui » suit le fuseau du téléphone (en-tête X-TZ-Offset)."""
from datetime import datetime, timedelta, timezone

from user_clock import user_today


def test_offset_header_gives_the_users_day(app):
    utc_now = datetime.now(timezone.utc)
    for offset in (14 * 60, -12 * 60, 0):
        with app.test_request_context(headers={"X-TZ-Offset": str(offset)}):
            assert user_today() == (utc_now + timedelta(minutes=offset)).date()


def test_invalid_or_missing_offset_falls_back_to_utc_day(app):
    utc_today = datetime.now(timezone.utc).date()
    for headers in ({}, {"X-TZ-Offset": "abc"}, {"X-TZ-Offset": "100000"}):
        with app.test_request_context(headers=headers):
            assert user_today() == utc_today
    assert user_today() == utc_today  # hors requête (tâches de fond)


def test_calendar_counts_an_answer_on_the_users_day(client, db):
    """Réponse à 23 h 30 UTC : c'est déjà le lendemain à Paris (UTC+1)."""
    quiz = [{"question": "Q", "options": {"A": "a", "B": "b"}, "correct": "A"}]
    db.save_course("u1", "c", {"nom": "C", "flashcards": [], "quiz": quiz})
    utc_today = datetime.now(timezone.utc).date()
    late = datetime.combine(utc_today - timedelta(days=1), datetime.min.time(), timezone.utc) + timedelta(hours=23, minutes=30)
    with db.transaction() as conn:
        conn.execute(
            "INSERT INTO answer_log (uid, course_id, item_index, correct, source, answered_at) VALUES ('u1', 'c', 0, 1, 'quiz', ?)",
            (late.isoformat(),),
        )

    def count_on(day, offset):
        headers = {"X-User-UID": "u1", "X-User-Name": "Testeur", "X-TZ-Offset": str(offset)}
        days = client.get("/api/activity/calendar?days=7", headers=headers).get_json()["days"]
        return next((d["count"] for d in days if d["date"] == day.isoformat()), None)

    assert count_on(utc_today - timedelta(days=1), 0) == 1   # en UTC : la veille
    assert count_on(utc_today, 60) == 1                      # à Paris : le jour même


def test_forecast_starts_on_the_users_day(client):
    headers = {"X-User-UID": "u1", "X-User-Name": "Testeur", "X-TZ-Offset": str(14 * 60)}
    forecast = client.get("/api/revision/forecast?days=7", headers=headers).get_json()["forecast"]
    assert forecast[0]["date"] == (datetime.now(timezone.utc) + timedelta(hours=14)).date().isoformat()
