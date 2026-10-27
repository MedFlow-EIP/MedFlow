"""Sentry : inactif sans DSN, et aucune donnée personnelle dans les rapports."""
from services.monitoring import init_sentry, scrub_event


def test_inactive_without_dsn(monkeypatch):
    monkeypatch.delenv("SENTRY_DSN", raising=False)
    assert init_sentry() is False


def test_scrub_removes_identity_and_content():
    event = {
        "request": {
            "url": "https://api/chat",
            "headers": {"Authorization": "Bearer secret", "X-User-Email": "a@b.fr", "User-Agent": "okhttp"},
            "data": {"message": "J'ai une douleur thoracique"},
            "cookies": {"s": "1"},
            "query_string": "q=Alice",
        },
        "user": {"id": "uid-123", "ip_address": "1.2.3.4"},
    }
    clean = scrub_event(event)
    assert clean["request"]["headers"] == {"User-Agent": "okhttp"}
    assert "data" not in clean["request"]
    assert "cookies" not in clean["request"]
    assert "query_string" not in clean["request"]
    assert "user" not in clean
    assert clean["request"]["url"] == "https://api/chat"
