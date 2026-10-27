"""Détection des cours déjà importés (F52)."""
import io
import zipfile


def _h(uid="u1"):
    return {"X-User-UID": uid, "X-User-Name": "Testeur"}


W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'


def _docx(text):
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as z:
        z.writestr("word/document.xml", f"<w:document {W}><w:body><w:p><w:r><w:t>{text}</w:t></w:r></w:p></w:body></w:document>")
    return out.getvalue()


def _upload(client, data, name, uid="u1", **form):
    return client.post(
        "/api/process",
        data={"file": (io.BytesIO(data), name), **form},
        headers=_h(uid),
        content_type="multipart/form-data",
    )


TEXT = "Le coeur a quatre cavités et deux valves auriculo-ventriculaires."


def test_same_document_is_detected(client, app):
    first = _upload(client, _docx(TEXT), "cardio.docx").get_json()
    resp = _upload(client, _docx(TEXT), "copie.docx")
    assert resp.status_code == 409
    body = resp.get_json()
    assert body["code"] == "duplicate"
    assert body["course_id"] == first["id"]
    assert body["nom"] == first["nom"]


def test_detection_ignores_case_and_spacing(client):
    _upload(client, _docx(TEXT), "a.docx")
    assert _upload(client, _docx("  " + TEXT.upper().replace(" ", "   ")), "b.docx").status_code == 409


def test_duplicate_does_not_consume_quota(client, app):
    app.config["AI_PROCESS_PER_HOUR"] = 1
    _upload(client, _docx(TEXT), "a.docx")
    assert _upload(client, _docx(TEXT), "b.docx").status_code == 409


def test_keep_both(client, db):
    _upload(client, _docx(TEXT), "a.docx")
    assert _upload(client, _docx(TEXT), "b.docx", on_duplicate="keep").status_code == 200
    assert len(db.fetch_courses("u1")) == 2


def test_replace_existing(client, db):
    first = _upload(client, _docx(TEXT), "a.docx").get_json()["id"]
    resp = _upload(client, _docx(TEXT), "a.docx", replace_course_id=first)
    assert resp.status_code == 200
    assert len(db.fetch_courses("u1")) == 1


def test_same_photo_is_detected(client):
    _upload(client, b"\xff\xd8\xff photo", "p.jpg")
    assert _upload(client, b"\xff\xd8\xff photo", "p2.jpg").status_code == 409


def test_other_users_courses_are_ignored(client):
    _upload(client, _docx(TEXT), "a.docx", uid="u1")
    assert _upload(client, _docx(TEXT), "a.docx", uid="u2").status_code == 200


def test_different_document(client):
    _upload(client, _docx(TEXT), "a.docx")
    assert _upload(client, _docx("Le rein filtre le sang grâce aux néphrons."), "b.docx").status_code == 200
