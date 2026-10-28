"""Signalement d'une erreur dans le contenu généré."""
import csv

from export_analytics import export_reports


def _h(uid="u1"):
    return {"X-User-UID": uid, "X-User-Name": "Testeur"}


def test_report_is_saved_and_exported(client, app, tmp_path):
    resp = client.post("/api/reports", headers=_h(), json={
        "kind": "quiz", "course_id": "cardio", "excerpt": "B2 = ouverture des sigmoïdes", "comment": "C'est la fermeture",
    })
    assert resp.status_code == 201

    path = export_reports(app.config["DATABASE_PATH"], str(tmp_path))
    with open(path, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    assert [(r["type"], r["cours"], r["commentaire"]) for r in rows] == [("quiz", "cardio", "C'est la fermeture")]


def test_incomplete_report_is_refused(client):
    assert client.post("/api/reports", headers=_h(), json={"kind": "quiz"}).status_code == 400
    assert client.post("/api/reports", headers=_h(), json={"kind": "autre", "excerpt": "x"}).status_code == 400


def test_reports_are_rate_limited(client):
    for _ in range(20):
        client.post("/api/reports", headers=_h(), json={"kind": "chat", "excerpt": "x"})
    assert client.post("/api/reports", headers=_h(), json={"kind": "chat", "excerpt": "x"}).status_code == 429


def test_reports_are_deleted_with_the_account(client, db):
    client.post("/api/reports", headers=_h(), json={"kind": "chat", "excerpt": "x"})
    db.delete_user_data("u1")
    with db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM content_reports").fetchone()[0] == 0
