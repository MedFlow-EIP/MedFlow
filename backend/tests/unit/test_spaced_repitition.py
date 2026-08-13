"""Unit tests for the SM-2 spaced repetition algorithm (pure, no DB)."""
from datetime import date

import pytest

from spaced_repetition import CardSchedule, next_review_date, next_schedule


class TestNextScheduleOnSuccess:
    def test_first_success_sets_interval_to_one_day(self):
        result = next_schedule(CardSchedule(), quality=4)
        assert result.interval_days == 1
        assert result.repetitions == 1

    def test_second_success_sets_interval_to_six_days(self):
        after_first = next_schedule(CardSchedule(), quality=4)
        after_second = next_schedule(after_first, quality=4)
        assert after_second.interval_days == 6
        assert after_second.repetitions == 2

    def test_third_success_multiplies_interval_by_ease_factor(self):
        s = next_schedule(CardSchedule(), quality=4)
        s = next_schedule(s, quality=4)
        ease_after_two = s.ease_factor
        s = next_schedule(s, quality=4)
        assert s.interval_days == round(6 * ease_after_two)

    def test_intervals_grow_across_many_successful_reviews(self):
        s = CardSchedule()
        intervals = []
        for _ in range(6):
            s = next_schedule(s, quality=5)
            intervals.append(s.interval_days)
        # Chaque intervalle doit être strictement croissant (courbe de
        # l'oubli espacée) une fois passé les deux premières révisions fixes.
        assert intervals == sorted(intervals)
        assert intervals[-1] > intervals[2]

    def test_perfect_quality_increases_ease_factor(self):
        result = next_schedule(CardSchedule(ease_factor=2.5), quality=5)
        assert result.ease_factor > 2.5

    def test_barely_passing_quality_decreases_ease_factor(self):
        result = next_schedule(CardSchedule(ease_factor=2.5), quality=3)
        assert result.ease_factor < 2.5


class TestNextScheduleOnFailure:
    def test_failure_resets_interval_to_one_day(self):
        s = next_schedule(CardSchedule(), quality=5)
        s = next_schedule(s, quality=5)
        assert s.interval_days == 6  # avant l'échec

        failed = next_schedule(s, quality=1)
        assert failed.interval_days == 1

    def test_failure_resets_repetitions_to_zero(self):
        s = next_schedule(CardSchedule(), quality=5)
        s = next_schedule(s, quality=5)
        assert s.repetitions == 2

        failed = next_schedule(s, quality=0)
        assert failed.repetitions == 0

    def test_failure_still_degrades_ease_factor(self):
        s = next_schedule(CardSchedule(), quality=5)
        ease_before_failure = s.ease_factor

        failed = next_schedule(s, quality=0)
        assert failed.ease_factor < ease_before_failure

    def test_quality_exactly_at_threshold_counts_as_success(self):
        # QUALITY_PASS_THRESHOLD = 3 : une qualité de 3 doit encore compter
        # comme une réussite (pas un échec), pas un cas limite ambigu.
        result = next_schedule(CardSchedule(), quality=3)
        assert result.repetitions == 1
        assert result.interval_days == 1


class TestEaseFactorFloor:
    def test_ease_factor_never_drops_below_1_3(self):
        s = CardSchedule(ease_factor=1.3)
        for _ in range(10):
            s = next_schedule(s, quality=0)
        assert s.ease_factor >= 1.3


class TestQualityBounds:
    def test_quality_above_5_is_clamped(self):
        result = next_schedule(CardSchedule(), quality=99)
        expected = next_schedule(CardSchedule(), quality=5)
        assert result.interval_days == expected.interval_days
        assert result.ease_factor == expected.ease_factor

    def test_negative_quality_is_clamped(self):
        result = next_schedule(CardSchedule(), quality=-10)
        expected = next_schedule(CardSchedule(), quality=0)
        assert result.interval_days == expected.interval_days
        assert result.ease_factor == expected.ease_factor


class TestNextReviewDate:
    def test_adds_interval_days_to_given_date(self):
        schedule = CardSchedule(interval_days=6)
        result = next_review_date(schedule, from_date=date(2026, 1, 1))
        assert result == date(2026, 1, 7)

    def test_defaults_to_today_when_no_date_given(self):
        schedule = CardSchedule(interval_days=0)
        assert next_review_date(schedule) == date.today()

    def test_zero_interval_returns_same_date(self):
        schedule = CardSchedule(interval_days=0)
        d = date(2026, 3, 15)
        assert next_review_date(schedule, from_date=d) == d