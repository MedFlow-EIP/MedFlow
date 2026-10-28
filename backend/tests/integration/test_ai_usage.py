"""Barre d'utilisation de l'IA : ce qui a été consommé et ce qu'il reste."""
from datetime import datetime


def _h(uid="u1"):
    return {"X-User-UID": uid, "X-User-Name": "Testeur"}


def _usage(client, uid="u1"):
    return {u["kind"]: u for u in client.get("/api/ai/usage", headers=_h(uid)).get_json()["usage"]}


def test_counts_the_calls_of_the_day(client, app):
    app.config.update(AI_CHAT_PER_DAY=60)
    client.post("/chat", json={"message": "Bonjour"}, headers=_h())
    client.post("/chat", json={"message": "La systole ?"}, headers=_h())

    usage = _usage(client)
    assert (usage["chat"]["used"], usage["chat"]["limit"], usage["chat"]["blocked_until"]) == (2, 60, None)
    assert usage["process"]["used"] == 0 and usage["case"]["used"] == 0
    assert _usage(client, "u2")["chat"]["used"] == 0


def test_says_when_the_limit_frees_up(client, app):
    app.config.update(AI_CHAT_PER_MINUTE=1, AI_CHAT_PER_DAY=60)
    client.post("/chat", json={"message": "Bonjour"}, headers=_h())

    blocked = _usage(client)["chat"]["blocked_until"]
    assert blocked is not None
    seconds_left = (datetime.fromisoformat(blocked) - datetime.now(datetime.fromisoformat(blocked).tzinfo)).total_seconds()
    assert 0 < seconds_left <= 60
