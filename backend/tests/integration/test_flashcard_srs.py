"""Flashcards en répétition espacée (SM-2, auto-évaluation)."""
from datetime import date, timedelta

import pytest


def _h(uid="u1"):
    return {"X-User-UID": uid, "X-User-Name": "Testeur"}


@pytest.fixture
def course(db):
    cards = [{"question": f"Q{i}", "answer": f"R{i}"} for i in range(3)]
    db.save_course("u1", "cardio", {"nom": "Cardio", "flashcards": cards, "quiz": []})
    return "cardio"


def _due(client, **params):
    return client.get("/api/flashcards/due", query_string=params, headers=_h()).get_json()


def _review(client, item, grade):
    return client.post(
        "/api/flashcards/review",
        json={"course_id": item["course_id"], "card_key": item["card_key"], "grade": grade},
        headers=_h(),
    )


def test_new_cards_are_due_with_answers(client, course):
    data = _due(client)
    assert data["count"] == 3 and data["total_due"] == 3
    assert data["items"][0]["answer"] == "R0"


def test_good_answer_schedules_later(client, course):
    first = _due(client)["items"][0]
    resp = _review(client, first, "good")
    assert resp.status_code == 200
    assert resp.get_json()["interval_days"] == 1
    assert first["card_key"] not in {i["card_key"] for i in _due(client)["items"]}


def test_again_comes_back_tomorrow_and_overdue_first(client, course, db):
    items = _due(client)["items"]
    _review(client, items[1], "again")
    with db.transaction() as conn:
        conn.execute("UPDATE flashcard_schedule SET next_review_date=?", ((date.today() - timedelta(days=2)).isoformat(),))
    assert _due(client)["items"][0]["card_key"] == items[1]["card_key"]


def test_editing_the_answer_keeps_the_schedule(client, course, db):
    first = _due(client)["items"][0]
    _review(client, first, "easy")
    cards = db.fetch_course("u1", "cardio").flashcards
    cards[0]["answer"] = "Réponse corrigée"
    db.update_course("u1", "cardio", flashcards=cards)
    assert first["card_key"] not in {i["card_key"] for i in _due(client)["items"]}


@pytest.mark.parametrize("grade", ["parfait", ""])
def test_invalid_grade(client, course, grade):
    item = _due(client)["items"][0]
    assert _review(client, item, grade).status_code == 400


def test_unknown_card(client, course):
    assert _review(client, {"course_id": "cardio", "card_key": "inconnu"}, "good").status_code == 404


def test_other_users_course(client, course):
    item = _due(client)["items"][0]
    resp = client.post(
        "/api/flashcards/review",
        json={"course_id": "cardio", "card_key": item["card_key"], "grade": "good"},
        headers=_h("u2"),
    )
    assert resp.status_code == 404


def test_course_filter_and_exam_priority(client, course, db):
    db.save_course("u1", "neuro", {"nom": "Neuro", "flashcards": [{"question": "N", "answer": "n"}], "quiz": []})
    assert [i["course_id"] for i in _due(client, course_id="neuro")["items"]] == ["neuro"]
    client.post(
        "/api/exams",
        json={"title": "Partiel", "exam_date": (date.today() + timedelta(days=5)).isoformat(), "course_ids": ["neuro"]},
        headers=_h(),
    )
    assert _due(client)["items"][0]["course_id"] == "neuro"


def test_reviews_count_for_quests(client, course):
    item = _due(client)["items"][0]
    _review(client, item, "good")
    quests = {q["id"]: q for q in client.get("/api/quests", headers=_h()).get_json()["quests"]}
    assert quests["daily_answers"]["progress"] == 1
