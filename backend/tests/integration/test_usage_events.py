"""Données d'usage : événements des parcours clés et export CSV."""
import csv

from export_analytics import export, pseudonym


def _h(uid="u1"):
    return {"X-User-UID": uid, "X-User-Name": "Testeur"}


def test_known_event_is_logged_with_its_detail(client, db):
    resp = client.post("/api/analytics/event", json={"event": "import_started", "detail": "pdf"}, headers=_h())
    assert resp.status_code == 200
    with db.connection() as conn:
        row = conn.execute("SELECT event_type, detail FROM analytics_events WHERE uid='u1'").fetchone()
    assert (row["event_type"], row["detail"]) == ("import_started", "pdf")


def test_unknown_event_is_refused(client):
    resp = client.post("/api/analytics/event", json={"event": "drop table"}, headers=_h())
    assert resp.status_code == 400


def test_export_writes_events_and_summary(client, app, tmp_path):
    for uid, event in (("u1", "revision_started"), ("u1", "revision_finished"), ("u2", "revision_started")):
        client.post("/api/analytics/event", json={"event": event}, headers=_h(uid))

    events_path, summary_path = export(app.config["DATABASE_PATH"], str(tmp_path))

    with open(events_path, encoding="utf-8") as f:
        events = list(csv.DictReader(f))
    assert len(events) == 3
    assert events[0]["personne"] == pseudonym("u1") and "u1" not in events[0]["personne"]

    with open(summary_path, encoding="utf-8") as f:
        summary = {r["evenement"]: r for r in csv.DictReader(f)}
    assert (summary["revision_started"]["total"], summary["revision_started"]["personnes"]) == ("2", "2")
    assert summary["revision_finished"]["personnes"] == "1"
