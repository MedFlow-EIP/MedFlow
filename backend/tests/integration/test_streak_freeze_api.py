"""Protections de série via l'API (leçons et compte)."""
from datetime import date, timedelta


def _h(uid="u1"):
    return {"X-User-UID": uid, "X-User-Name": "Testeur"}


def _set_stats(db, streak, days_ago, freezes):
    with db.transaction() as conn:
        conn.execute("INSERT OR IGNORE INTO user_stats (uid, xp, streak) VALUES ('u1', 0, 0)")
        conn.execute(
            "UPDATE user_stats SET streak=?, last_activity=?, streak_freezes=? WHERE uid='u1'",
            (streak, (date.today() - timedelta(days=days_ago)).isoformat(), freezes),
        )


def _stats(client):
    return client.get("/api/account", headers=_h()).get_json()["stats"]


def test_account_exposes_freezes(client, db):
    _set_stats(db, 5, 1, 1)
    stats = _stats(client)
    assert (stats["streak"], stats["streakFreezes"], stats["maxStreakFreezes"]) == (5, 1, 2)


def test_lost_streak_is_shown_as_zero(client, db):
    _set_stats(db, 5, 3, 1)
    assert _stats(client)["streak"] == 0


def test_lesson_after_missed_day_uses_freeze(client, db):
    _set_stats(db, 5, 2, 1)
    db.complete_lesson("u1", "lecon-inconnue")
    with db.connection() as conn:
        row = conn.execute("SELECT streak, streak_freezes FROM user_stats WHERE uid='u1'").fetchone()
    assert (row["streak"], row["streak_freezes"]) == (6, 0)
    types = [a["type"] for a in db.get_recent_activity("u1")]
    assert "streak_freeze_used" in types
