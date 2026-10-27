"""Import des comptes Firebase dans user_stats (classement / recherche d'amis)."""
from types import SimpleNamespace

from sync_firebase_users import sync_users


def _user(uid, name=None, email=None):
    return SimpleNamespace(uid=uid, display_name=name, email=email)


def test_imports_every_firebase_account(db):
    total = sync_users(db, [_user("a1", "Armod Elegbede", "Armod@Example.com"), _user("b2", "Bob")])

    assert total == 2
    uids = {e["uid"] for e in db.get_leaderboard(limit=50)}
    assert {"a1", "b2"} <= uids
    assert [r["uid"] for r in db.search_users("armod@example.com", exclude_uid="x")] == ["a1"]


def test_is_idempotent_and_keeps_known_name(db):
    sync_users(db, [_user("a1", "Armod")])
    sync_users(db, [_user("a1", None, "armod@example.com")])

    entries = [e for e in db.get_leaderboard(limit=50) if e["uid"] == "a1"]
    assert len(entries) == 1
    assert entries[0]["displayName"] == "Armod"
