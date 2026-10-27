"""Protections de série : calcul pur, sans base."""
from datetime import date

from database import Database

TODAY = date(2026, 11, 10)


def nxt(current, last, freezes):
    return Database.next_streak(current, last, freezes, TODAY)


def test_first_activity():
    assert nxt(0, None, 0) == (1, 0, 0, False)


def test_same_day_changes_nothing():
    assert nxt(4, "2026-11-10", 1) == (4, 1, 0, False)


def test_consecutive_day():
    assert nxt(4, "2026-11-09", 0) == (5, 0, 0, False)


def test_one_missed_day_uses_a_freeze():
    assert nxt(4, "2026-11-08", 1) == (5, 0, 1, False)


def test_two_missed_days_need_two_freezes():
    assert nxt(4, "2026-11-07", 2) == (5, 0, 2, False)
    assert nxt(4, "2026-11-07", 1) == (1, 1, 0, False)


def test_without_freeze_the_streak_restarts():
    assert nxt(9, "2026-11-08", 0) == (1, 0, 0, False)


def test_earn_a_freeze_every_seven_days():
    assert nxt(6, "2026-11-09", 0) == (7, 1, 0, True)
    assert nxt(13, "2026-11-09", 1) == (14, 2, 0, True)


def test_freezes_are_capped():
    assert nxt(13, "2026-11-09", 2) == (14, 2, 0, False)


def test_displayed_streak():
    assert Database.displayed_streak(5, "2026-11-09", 0, TODAY) == 5
    assert Database.displayed_streak(5, "2026-11-08", 1, TODAY) == 5
    assert Database.displayed_streak(5, "2026-11-08", 0, TODAY) == 0
    assert Database.displayed_streak(0, None, 2, TODAY) == 0
