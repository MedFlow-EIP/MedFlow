"""Import en arrière-plan : réponse immédiate, suivi de l'avancement."""
import io
import time
import zipfile

import pytest


def _h(uid="u1"):
    return {"X-User-UID": uid, "X-User-Name": "Testeur"}


W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'


def _docx(text):
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as z:
        z.writestr("word/document.xml", f"<w:document {W}><w:body><w:p><w:r><w:t>{text}</w:t></w:r></w:p></w:body></w:document>")
    return out.getvalue()


def _start(client, data, name="cours.docx", uid="u1"):
    return client.post(
        "/api/process",
        data={"file": (io.BytesIO(data), name), "background": "1"},
        headers=_h(uid),
        content_type="multipart/form-data",
    )


def _wait(client, job_id, uid="u1"):
    for _ in range(100):
        job = client.get(f"/api/process/jobs/{job_id}", headers=_h(uid)).get_json()
        if job["status"] != "processing":
            return job
        time.sleep(0.05)
    pytest.fail("l'import ne s'est pas terminé")


def test_returns_immediately_then_completes(client, db):
    resp = _start(client, _docx("Le coeur a quatre cavités et deux valves."))
    assert resp.status_code == 202
    job = _wait(client, resp.get_json()["job_id"])
    assert job["status"] == "done"
    assert job["file_name"] == "cours.docx"
    assert db.fetch_course("u1", job["course_id"]).nom == job["course_nom"]


def test_failure_is_reported(client, app):
    app.ai.generate_flashcards = lambda *a: []
    app.ai.generate_quiz = lambda *a: []
    job = _wait(client, _start(client, _docx("Le rein filtre le sang du corps.")).get_json()["job_id"])
    assert job["status"] == "error"
    assert "génération a échoué" in job["error"]


def test_validation_errors_stay_synchronous(client):
    resp = _start(client, b"texte", name="notes.txt")
    assert resp.status_code == 400


def test_only_owner_can_follow_the_job(client):
    job_id = _start(client, _docx("Le foie produit la bile.")).get_json()["job_id"]
    assert client.get(f"/api/process/jobs/{job_id}", headers=_h("u2")).status_code == 404
    _wait(client, job_id)


def test_stale_job_is_reported_as_interrupted(client, db):
    db.create_import_job("vieux", "u1", "a.pdf")
    with db.transaction() as conn:
        conn.execute("UPDATE import_jobs SET created_at='2000-01-01T00:00:00+00:00' WHERE id='vieux'")
    job = client.get("/api/process/jobs/vieux", headers=_h()).get_json()
    assert job["status"] == "error"
    assert "interrompue" in job["error"]
