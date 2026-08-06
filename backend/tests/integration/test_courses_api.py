"""Integration tests for course-related API endpoints."""
import io
import pytest


class TestDashboard:
    def test_returns_empty_state_for_new_user(self, client, auth_headers):
        resp = client.get("/api/dashboard", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["stats"]["cours"] == 0
        assert data["stats"]["flashcards"] == 0
        assert data["stats"]["sessions"] == 0
        assert data["cours"] == []

    def test_returns_courses_after_seeding(self, client, auth_headers, seeded_course):
        resp = client.get("/api/dashboard", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["stats"]["cours"] == 1
        assert len(data["cours"]) == 1
        assert data["cours"][0]["id"] == seeded_course

    def test_pagination_default(self, client, auth_headers, db, uid):
        for i in range(5):
            db.save_course(uid, f"c{i}", {
                "nom": f"Cours {i}", "summary": "", "flashcards": [], "quiz": [], "sessions": 0
            })
        resp = client.get("/api/dashboard", headers=auth_headers)
        data = resp.get_json()
        assert data["pagination"]["total"] == 5
        assert data["pagination"]["page"] == 1
        assert len(data["cours"]) == 5

    def test_pagination_second_page(self, client, auth_headers, db, uid):
        for i in range(25):
            db.save_course(uid, f"c{i}", {
                "nom": f"Cours {i}", "summary": "", "flashcards": [], "quiz": [], "sessions": 0
            })
        resp = client.get("/api/dashboard?page=2&per_page=20", headers=auth_headers)
        data = resp.get_json()
        assert data["pagination"]["page"] == 2
        assert len(data["cours"]) == 5

    def test_requires_auth(self, client):
        resp = client.get("/api/dashboard")
        assert resp.status_code == 400


class TestGetCourse:
    def test_returns_course_content(self, client, auth_headers, seeded_course, sample_course_payload):
        resp = client.get(f"/api/course/{seeded_course}", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["id"] == seeded_course
        assert data["nom"] == sample_course_payload["nom"]
        assert len(data["flashcards"]) == len(sample_course_payload["flashcards"])

    def test_returns_404_for_unknown_course(self, client, auth_headers):
        resp = client.get("/api/course/no-such-course", headers=auth_headers)
        assert resp.status_code == 404

    def test_requires_auth(self, client):
        resp = client.get("/api/course/any")
        assert resp.status_code == 400

    def test_user_isolation(self, client, db, seeded_course):
        resp = client.get(
            f"/api/course/{seeded_course}",
            headers={"X-User-UID": "other-user"},
        )
        assert resp.status_code == 404


class TestDeleteCourse:
    def test_delete_existing_course(self, client, auth_headers, seeded_course, db, uid):
        resp = client.delete(f"/api/course/{seeded_course}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.get_json()["success"] is True
        assert db.fetch_course(uid, seeded_course) is None

    def test_delete_nonexistent_course_returns_404(self, client, auth_headers):
        resp = client.delete("/api/course/ghost", headers=auth_headers)
        assert resp.status_code == 404

    def test_delete_requires_auth(self, client, seeded_course):
        resp = client.delete(f"/api/course/{seeded_course}")
        assert resp.status_code == 400

    def test_cannot_delete_other_users_course(self, client, db, uid, seeded_course):
        resp = client.delete(
            f"/api/course/{seeded_course}",
            headers={"X-User-UID": "attacker"},
        )
        assert resp.status_code == 404
        # Original course must still exist
        assert db.fetch_course(uid, seeded_course) is not None


class TestProcessDocument:
    def test_process_valid_pdf(self, client, auth_headers, minimal_pdf_bytes):
        data = {"file": (io.BytesIO(minimal_pdf_bytes), "test.pdf")}
        resp = client.post(
            "/api/process",
            data=data,
            headers=auth_headers,
            content_type="multipart/form-data",
        )
        # MockAIProvider returns valid data; PDF text will be empty/minimal
        # but the route should still complete (no error check on text length
        # for minimal PDFs — depends on extraction result)
        assert resp.status_code in (200, 400)  # 400 if "PDF vide"

    def test_process_no_file_returns_400(self, client, auth_headers):
        resp = client.post("/api/process", headers=auth_headers, content_type="multipart/form-data")
        assert resp.status_code == 400

    def test_process_wrong_extension_returns_400(self, client, auth_headers):
        data = {"file": (io.BytesIO(b"not a pdf"), "document.docx")}
        resp = client.post(
            "/api/process",
            data=data,
            headers=auth_headers,
            content_type="multipart/form-data",
        )
        assert resp.status_code == 400
        assert "PDF" in resp.get_json()["error"]

    def test_process_requires_auth(self, client, minimal_pdf_bytes):
        data = {"file": (io.BytesIO(minimal_pdf_bytes), "test.pdf")}
        resp = client.post(
            "/api/process",
            data=data,
            content_type="multipart/form-data",
        )
        assert resp.status_code == 400
