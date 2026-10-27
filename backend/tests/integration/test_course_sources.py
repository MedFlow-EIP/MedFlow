"""Documents d'origine : conservés, rouverts, supprimés avec le cours."""
import io
import os
import zipfile


def _h(uid="u1"):
    return {"X-User-UID": uid, "X-User-Name": "Testeur"}


W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'


def _docx(text):
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as z:
        z.writestr("word/document.xml", f"<w:document {W}><w:body><w:p><w:r><w:t>{text}</w:t></w:r></w:p></w:body></w:document>")
    return out.getvalue()


def _upload(client, data, name="Cardio S1.docx", uid="u1"):
    return client.post(
        "/api/process",
        data={"file": (io.BytesIO(data), name)},
        headers=_h(uid),
        content_type="multipart/form-data",
    ).get_json()


def test_original_is_kept_and_served(client):
    data = _docx("Le coeur a quatre cavités et deux valves.")
    course = _upload(client, data)
    assert course["source_name"] == "Cardio S1.docx"
    assert course["source_size"] == len(data)

    resp = client.get(f"/api/course/{course['id']}/source", headers=_h())
    assert resp.status_code == 200
    assert resp.data == data
    assert resp.mimetype.endswith("wordprocessingml.document")


def test_list_of_documents(client):
    _upload(client, _docx("Le coeur a quatre cavités."))
    docs = client.get("/api/sources", headers=_h()).get_json()
    assert [d["source_name"] for d in docs["documents"]] == ["Cardio S1.docx"]
    assert docs["used_bytes"] > 0 and docs["max_bytes"] > docs["used_bytes"]


def test_other_user_cannot_download(client):
    course = _upload(client, _docx("Le foie produit la bile."))
    assert client.get(f"/api/course/{course['id']}/source", headers=_h("u2")).status_code == 404


def test_deleting_the_course_deletes_the_file(client, app):
    course = _upload(client, _docx("Le rein filtre le sang."))
    folder = os.path.join(app.config["UPLOAD_FOLDER"], "u1", "sources")
    assert len(os.listdir(folder)) == 1
    client.delete(f"/api/course/{course['id']}", headers=_h())
    assert os.listdir(folder) == []


def test_storage_quota(client, app):
    app.config["MAX_SOURCES_BYTES"] = 10
    course = _upload(client, _docx("Le pancréas sécrète l'insuline."))
    assert course["source_name"] is None  # cours créé, original non conservé
    assert client.get(f"/api/course/{course['id']}/source", headers=_h()).status_code == 404


def test_account_deletion_removes_documents(client, app, db):
    _upload(client, _docx("La rate filtre le sang."))
    folder = os.path.join(app.config["UPLOAD_FOLDER"], "u1")
    assert os.path.exists(folder)
    client.delete("/api/account", headers=_h())
    assert not os.path.exists(folder)
