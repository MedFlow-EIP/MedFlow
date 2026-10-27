"""« Aujourd'hui » suit le fuseau du téléphone (en-tête X-TZ-Offset)."""
from datetime import date, datetime, timedelta, timezone

from user_clock import user_today


def test_offset_header_gives_the_users_day(app):
    utc_now = datetime.now(timezone.utc)
    for offset in (14 * 60, -12 * 60, 0):
        with app.test_request_context(headers={"X-TZ-Offset": str(offset)}):
            assert user_today() == (utc_now + timedelta(minutes=offset)).date()


def test_invalid_or_missing_offset_falls_back_to_server_day(app):
    for headers in ({}, {"X-TZ-Offset": "abc"}, {"X-TZ-Offset": "100000"}):
        with app.test_request_context(headers=headers):
            assert user_today() == date.today()
    assert user_today() == date.today()  # hors requête (tâches de fond)


def test_forecast_starts_on_the_users_day(client):
    headers = {"X-User-UID": "u1", "X-User-Name": "Testeur", "X-TZ-Offset": str(14 * 60)}
    forecast = client.get("/api/revision/forecast?days=7", headers=headers).get_json()["forecast"]
    assert forecast[0]["date"] == (datetime.now(timezone.utc) + timedelta(hours=14)).date().isoformat()
