import hashlib
import logging
import os
import re
import threading
import uuid
from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict

from flask import Blueprint, current_app, g, jsonify, request
from werkzeug.utils import secure_filename

from middleware.ai_quota import consume_ai_quota
from middleware.auth import build_user_response, require_auth
from services.ai.base import QUIZ_DIFFICULTY
from services.documents import (
    DOCUMENT_TYPES,
    IMAGE_EXTENSIONS,
    DocumentError,
    extract_text_from_docx,
    extract_text_from_pptx,
)
from services.pdf import extract_text_from_pdf, pdf_has_images, pdf_page_count as _pdf_page_count
from services.specialties import SPECIALTIES, clean_tags, suggest_tags
from routes.errors import internal_error
from services.push import notify_user

logger = logging.getLogger(__name__)

courses_bp = Blueprint("courses", __name__)

# En dessous, le document est considéré comme vide.
MIN_TEXT_CHARS = 10
MAX_COURSE_NAME_CHARS = 120
MAX_FLASHCARDS = 200
MAX_CARD_CHARS = 1000

# Cours qui reçoit les flashcards créées depuis le chat.
NOTES_COURSE_ID = "notes-assistant"
NOTES_COURSE_NAME = "Notes de l'assistant"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _course_to_response(course) -> dict:
    data = asdict(course)
    data["flashcards"] = course.flashcards
    data["quiz"] = course.quiz
    data["summary"] = course.summary
    return data


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@courses_bp.route("/api/search", methods=["GET"])
@require_auth
def search_courses():
    """Recherche dans les cours de l'utilisateur : nom de cours,
    flashcards (question/réponse), questions de quiz. ``?q=`` requis."""
    try:
        db = current_app.db
        uid = g.uid
        query = request.args.get("q", "")

        results = db.search_courses(uid, query)
        return jsonify({"results": results, "count": len(results)})

    except Exception as e:
        logger.exception("Erreur search")
        return internal_error("Erreur search")


@courses_bp.route("/api/dashboard", methods=["GET"])
@require_auth
def get_dashboard():
    """Return user courses and statistics.

    Supports optional pagination via ``?page=1&per_page=20``.
    """
    try:
        db = current_app.db
        uid = g.uid

        # Pagination parameters
        try:
            page = max(1, int(request.args.get("page", 1)))
            per_page = max(1, min(100, int(request.args.get("per_page", 20))))
        except (TypeError, ValueError):
            page, per_page = 1, 20

        all_courses = db.fetch_courses(uid)
        total = len(all_courses)

        # Slice for the requested page
        start = (page - 1) * per_page
        paginated = all_courses[start: start + per_page]

        cours = [
            {
                "nom": c.nom or "Sans nom",
                "id": c.id,
                "sessions": c.sessions or 0,
                "flashcards": len(c.flashcards or []),
                "quiz": len(c.quiz or []),
                "created_at": c.created_at,
                "tags": c.tags,
            }
            for c in paginated
        ]

        total_flashcards = sum(len(c.flashcards or []) for c in all_courses)
        session_stats = db.get_user_session_stats(uid)

        stats = {
            "cours": total,
            "flashcards": total_flashcards,
            "sessions": session_stats.get("total_sessions", 0),
            "detailed_sessions": session_stats,
        }

        return jsonify({
            "user": build_user_response(),
            "cours": cours,
            "stats": stats,
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "pages": max(1, -(-total // per_page)),  # ceiling division
            },
        })

    except Exception as e:
        logger.exception("Erreur dashboard")
        return internal_error("Erreur dashboard")


@courses_bp.route("/api/course/<course_id>", methods=["GET"])
@require_auth
def get_course(course_id):
    """Return the full content of a single course."""
    try:
        course = current_app.db.fetch_course(g.uid, course_id)
        if not course:
            return jsonify({"error": "Cours introuvable"}), 404
        return jsonify(_course_to_response(course))
    except Exception as e:
        logger.exception("Erreur lecture cours")
        return internal_error("Erreur lecture cours")


@courses_bp.route("/api/course/<course_id>", methods=["DELETE"])
@require_auth
def delete_course(course_id):
    """Delete a course belonging to the authenticated user."""
    try:
        db = current_app.db
        course = db.fetch_course(g.uid, course_id)
        if not course:
            return jsonify({"error": "Cours introuvable"}), 404
        db.delete_course(g.uid, course_id)
        return jsonify({"success": True})
    except Exception as e:
        logger.exception("Erreur suppression cours")
        return internal_error("Erreur suppression")


def _read_course_text(data: bytes, extension: str, mime_type: str):
    """Texte du document. Renvoie (texte, besoin_ia, erreur, code HTTP).

    ``besoin_ia`` : image ou PDF scanné, à faire lire par l'IA (compte dans le quota).
    """
    if extension in IMAGE_EXTENSIONS:
        return "", True, None, None

    if extension == ".pdf":
        try:
            text = extract_text_from_pdf(data)
        except Exception:
            return None, False, "PDF illisible ou corrompu", 400
        max_pages = current_app.config.get("PROCESS_MAX_SCANNED_PAGES", 30)
        if text and len(text.strip()) >= MIN_TEXT_CHARS:
            # Schémas ou figures : l'IA lit le PDF entier pour les décrire (le
            # texte extrait reste en secours). Au-delà de 30 pages, texte seul.
            pages = _pdf_page_count(data) or 0
            if pages <= max_pages and pdf_has_images(data):
                return text, True, None, None
            return text, False, None, None
        # Pas de texte : PDF scanné (photos de pages). L'IA le lit, mais
        # chaque page est facturée : on limite le nombre de pages.
        pages = _pdf_page_count(data)
        if pages is None:
            return None, False, "PDF illisible ou corrompu", 400
        if pages > max_pages:
            return None, False, f"PDF scanné trop long ({max_pages} pages maximum)", 413
        return "", True, None, None

    try:
        if extension == ".docx":
            text = extract_text_from_docx(data)
        else:
            text = extract_text_from_pptx(data)
    except DocumentError as e:
        return None, False, str(e), 400
    if not text or len(text.strip()) < MIN_TEXT_CHARS:
        return None, False, "Document vide : aucun texte à analyser", 400
    return text, False, None, None


def _source_hash(data: bytes, text: str) -> str:
    """Empreinte du document : son texte normalisé (un même cours réexporté ou
    renommé est reconnu), sinon ses octets (photo, scan)."""
    if text and text.strip():
        normalized = re.sub(r"\s+", " ", text.lower()).strip()
        return "t:" + hashlib.sha256(normalized.encode("utf-8")).hexdigest()
    return "b:" + hashlib.sha256(data).hexdigest()


def _clean_flashcards(cards) -> list:
    """Garde les cartes valides (les fournisseurs IA renvoient une carte « Erreur » en cas d'échec)."""
    if not isinstance(cards, list):
        return []
    return [
        {"question": str(c["question"]).strip(), "answer": str(c["answer"]).strip()}
        for c in cards
        if isinstance(c, dict)
        and str(c.get("question", "")).strip()
        and str(c.get("answer", "")).strip()
        and c.get("question") != "Erreur"
    ]


def _clean_quiz(questions) -> list:
    if not isinstance(questions, list):
        return []
    return [
        q for q in questions
        if isinstance(q, dict)
        and q.get("question") not in (None, "", "Erreur")
        and isinstance(q.get("options"), dict)
        and q.get("correct") in q["options"]
    ]


def _new_course_id(db, uid: str, filename: str) -> str:
    """Identifiant libre : deux photos « image.jpg » ne s'écrasent plus."""
    base = os.path.splitext(filename)[0] or "cours"
    course_id, n = base, 2
    while db.fetch_course(uid, course_id):
        course_id = f"{base}-{n}"
        n += 1
    return course_id


class GenerationError(Exception):
    """Échec de génération à montrer à l'utilisateur (message + code HTTP)."""

    def __init__(self, message: str, status: int):
        super().__init__(message)
        self.status = status


def _generate_course(app, uid: str, job: dict) -> dict:
    """Lecture (OCR) + génération IA + enregistrement d'un cours. Appelé
    pendant la requête, ou dans un thread pour un import en arrière-plan."""
    ai = app.ai
    text = job["text"]
    if job["needs_reading"]:
        read = ai.transcribe_document(job["data"], job["mime_type"])
        # PDF avec schémas : si la lecture par l'IA échoue, on garde le texte extrait.
        text = read if read and len(read.strip()) >= MIN_TEXT_CHARS else text
        if not text or len(text.strip()) < MIN_TEXT_CHARS:
            raise GenerationError("Aucun texte lisible sur ce document. Essaie une photo plus nette.", 400)

    logger.info("Extracted text length: %d", len(text))
    filename = job["filename"]

    # Plus le cours est long, plus il y a de flashcards et de questions (5 à 15).
    count = max(5, min(15, len(text) // 2500))

    # Run all 4 AI generation tasks concurrently
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {
            executor.submit(ai.generate_title, text, filename): "nom",
            executor.submit(ai.generate_flashcards, text, count): "flashcards",
            executor.submit(ai.generate_summary, text): "summary",
            executor.submit(ai.generate_quiz, text, count, job["difficulty"]): "quiz",
        }
        results = {}
        for future in as_completed(futures):
            key = futures[future]
            results[key] = future.result()

    flashcards = _clean_flashcards(results["flashcards"])
    quiz = _clean_quiz(results["quiz"])
    if not flashcards and not quiz:
        # Rien d'exploitable : on n'enregistre pas un cours vide.
        raise GenerationError("La génération a échoué. Réessaie dans un instant.", 502)

    replace_id = job["replace_id"]
    course_id = replace_id or _new_course_id(app.db, uid, filename)
    output = {
        "id": course_id,
        "nom": (results["nom"] or os.path.splitext(filename)[0])[:MAX_COURSE_NAME_CHARS],
        "flashcards": flashcards,
        "summary": results["summary"],
        "quiz": quiz,
        "sessions": 0,
        "source_hash": job["source_hash"],
    }
    # Nouveau cours : spécialités suggérées. Régénération : on garde les tags choisis.
    if not replace_id:
        output["tags"] = suggest_tags(text)

    logger.info("Saving course %s for user %s", course_id, uid)
    app.db.save_course(uid, course_id, output)

    course = app.db.fetch_course(uid, course_id)
    return _course_to_response(course) if course else output


# Au-delà, une génération « en cours » est considérée comme interrompue
# (serveur redémarré pendant le traitement, par exemple lors d'un déploiement).
JOB_TIMEOUT = timedelta(minutes=10)
GENERIC_FAILURE = "La génération a échoué. Réessaie dans un instant."


def _run_import_job(app, uid: str, job_id: str, job: dict) -> None:
    with app.app_context():
        try:
            course = _generate_course(app, uid, job)
            app.db.finish_import_job(job_id, "done", course_id=course["id"], course_nom=course["nom"])
            notify_user(app, uid, "✅ Cours prêt", f"« {course['nom']} » est prêt à réviser.",
                        {"screen": "CourseDetail", "courseId": course["id"]})
        except GenerationError as e:
            app.db.finish_import_job(job_id, "error", error=str(e))
            notify_user(app, uid, "Import échoué", f"{job['filename']} : {e}")
        except Exception:
            logger.exception("Erreur import en arrière-plan")
            app.db.finish_import_job(job_id, "error", error=GENERIC_FAILURE)
            notify_user(app, uid, "Import échoué", f"{job['filename']} : {GENERIC_FAILURE}")


def _job_response(row) -> dict:
    status, error = row["status"], row["error"]
    started = datetime.fromisoformat(row["created_at"])
    if status == "processing" and datetime.now(timezone.utc) - started > JOB_TIMEOUT:
        status, error = "error", "La génération a été interrompue. Relance l'import."
    return {
        "job_id": row["id"],
        "status": status,
        "file_name": row["file_name"],
        "course_id": row["course_id"],
        "course_nom": row["course_nom"],
        "error": error,
        "created_at": row["created_at"],
    }


@courses_bp.route("/api/process/jobs/<job_id>", methods=["GET"])
@require_auth
def get_import_job(job_id):
    """État d'un import lancé en arrière-plan : processing, done ou error."""
    row = current_app.db.fetch_import_job(g.uid, job_id)
    if not row:
        return jsonify({"error": "Import introuvable"}), 404
    return jsonify(_job_response(row))


@courses_bp.route("/api/process", methods=["POST"])
@require_auth
def process_document():
    """Importe un cours (PDF, Word, PowerPoint ou photo) et génère titre,
    résumé, flashcards et quiz en parallèle.

    ``replace_course_id`` (facultatif) : régénère ce cours au lieu d'en créer un.
    ``background=1`` : répond tout de suite (202 + job_id) et génère en
    arrière-plan ; l'app suit l'avancement via /api/process/jobs/<id>.
    """
    logger.info("Starting document processing for uid=%s", g.uid)

    if "file" not in request.files:
        return jsonify({"error": "Aucun fichier fourni"}), 400

    file = request.files["file"]
    if not file or file.filename == "":
        return jsonify({"error": "Nom de fichier vide"}), 400

    filename = secure_filename(file.filename) or "cours"
    extension = os.path.splitext(filename)[1].lower()
    mime_type = DOCUMENT_TYPES.get(extension)
    if not mime_type:
        return jsonify({"error": "Format non supporté : PDF, Word, PowerPoint ou photo (JPEG, PNG, WebP)"}), 400

    # Taille réelle du fichier reçu (sans le charger en mémoire).
    file.stream.seek(0, os.SEEK_END)
    size = file.stream.tell()
    file.stream.seek(0)
    max_bytes = current_app.config.get("MAX_PDF_BYTES", 20 * 1024 * 1024)
    if size > max_bytes:
        return jsonify({"error": f"Fichier trop lourd ({max_bytes // (1024 * 1024)} Mo maximum)"}), 413
    if size == 0:
        return jsonify({"error": "Fichier vide"}), 400

    if current_app.ai is None:
        return jsonify({"error": "IA indisponible"}), 503

    difficulty = (request.form.get("difficulty") or "normal").strip().lower()
    if difficulty not in QUIZ_DIFFICULTY:
        return jsonify({"error": "Difficulté invalide : facile, normal ou difficile"}), 400

    replace_id = (request.form.get("replace_course_id") or "").strip()
    if replace_id and not current_app.db.fetch_course(g.uid, replace_id):
        return jsonify({"error": "Cours introuvable"}), 404

    try:
        # Le fichier n'est pas gardé sur le disque : seul le contenu généré est
        # conservé (évite que le dossier uploads/ grossisse sans fin).
        data = file.read()

        text, needs_reading, error, status = _read_course_text(data, extension, mime_type)
        if error:
            return jsonify({"error": error}), status

        # Déjà importé ? On demande avant de dépenser un appel IA (F52).
        source_hash = _source_hash(data, text)
        if not replace_id and request.form.get("on_duplicate") != "keep":
            existing = current_app.db.find_course_by_hash(g.uid, source_hash)
            if existing:
                return jsonify({
                    "error": f"Tu as déjà importé ce cours : « {existing['nom']} »",
                    "code": "duplicate",
                    "course_id": existing["course_id"],
                    "nom": existing["nom"],
                }), 409

        # Quota compté seulement quand l'IA va vraiment être appelée.
        quota_error = consume_ai_quota("process")
        if quota_error:
            return quota_error

        job = {
            "text": text,
            "needs_reading": needs_reading,
            "data": data,
            "mime_type": mime_type,
            "filename": filename,
            "difficulty": difficulty,
            "replace_id": replace_id,
            "source_hash": source_hash,
        }
        app = current_app._get_current_object()

        if request.form.get("background") == "1":
            job_id = str(uuid.uuid4())
            app.db.create_import_job(job_id, g.uid, file.filename or filename)
            threading.Thread(target=_run_import_job, args=(app, g.uid, job_id, job), daemon=True).start()
            return jsonify({"job_id": job_id, "status": "processing"}), 202

        try:
            return jsonify(_generate_course(app, g.uid, job))
        except GenerationError as e:
            return jsonify({"error": str(e)}), e.status

    except Exception as e:
        logger.exception("Erreur traitement document")
        return internal_error("Erreur traitement")


# ---------------------------------------------------------------------------
# Modification d'un cours (F77)
# ---------------------------------------------------------------------------

def _validate_flashcards(raw):
    """Cartes envoyées par l'app. Renvoie (cartes, erreur)."""
    if not isinstance(raw, list):
        return None, "Flashcards invalides"
    if len(raw) > MAX_FLASHCARDS:
        return None, f"{MAX_FLASHCARDS} flashcards maximum par cours"
    cards = []
    for card in raw:
        if not isinstance(card, dict):
            return None, "Flashcard invalide"
        question = str(card.get("question") or "").strip()
        answer = str(card.get("answer") or "").strip()
        if not question or not answer:
            return None, "Chaque flashcard doit avoir une question et une réponse"
        if len(question) > MAX_CARD_CHARS or len(answer) > MAX_CARD_CHARS:
            return None, f"Question et réponse : {MAX_CARD_CHARS} caractères maximum"
        cards.append({"question": question, "answer": answer})
    return cards, None


@courses_bp.route("/api/course/<course_id>", methods=["PATCH"])
@require_auth
def update_course(course_id):
    """Renomme un cours et/ou remplace ses flashcards (corrections de l'utilisateur)."""
    try:
        db = current_app.db
        if not db.fetch_course(g.uid, course_id):
            return jsonify({"error": "Cours introuvable"}), 404

        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify({"error": "Body JSON invalide"}), 400

        nom = None
        if "nom" in body:
            nom = str(body.get("nom") or "").strip()
            if not nom:
                return jsonify({"error": "Le titre ne peut pas être vide"}), 400
            if len(nom) > MAX_COURSE_NAME_CHARS:
                return jsonify({"error": f"Titre trop long ({MAX_COURSE_NAME_CHARS} caractères maximum)"}), 400

        tags = None
        if "tags" in body:
            tags, error = clean_tags(body.get("tags"))
            if error:
                return jsonify({"error": error}), 400

        flashcards = None
        if "flashcards" in body:
            flashcards, error = _validate_flashcards(body.get("flashcards"))
            if error:
                return jsonify({"error": error}), 400

        if nom is None and flashcards is None and tags is None:
            return jsonify({"error": "Rien à modifier"}), 400

        db.update_course(g.uid, course_id, nom=nom, flashcards=flashcards, tags=tags)
        return jsonify(_course_to_response(db.fetch_course(g.uid, course_id)))
    except Exception:
        logger.exception("Erreur modification cours")
        return internal_error("Erreur modification")


# ---------------------------------------------------------------------------
# Flashcards créées depuis un texte (réponse de l'assistant)
# ---------------------------------------------------------------------------

@courses_bp.route("/api/flashcards/from-text", methods=["POST"])
@require_auth
def flashcards_from_text():
    """Transforme un texte (réponse du chat) en flashcards ajoutées à un cours.

    ``course_id`` absent : les cartes vont dans le cours « Notes de l'assistant ».
    """
    try:
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify({"error": "Body JSON invalide"}), 400

        text = str(body.get("text") or "").strip()
        if len(text) < MIN_TEXT_CHARS:
            return jsonify({"error": "Texte trop court pour créer des flashcards"}), 400
        max_chars = current_app.config.get("FLASHCARDS_FROM_TEXT_MAX_CHARS", 8000)
        if len(text) > max_chars:
            return jsonify({"error": f"Texte trop long ({max_chars} caractères maximum)"}), 400

        db = current_app.db
        course_id = (body.get("course_id") or "").strip() or NOTES_COURSE_ID
        course = db.fetch_course(g.uid, course_id)
        if course_id != NOTES_COURSE_ID and not course:
            return jsonify({"error": "Cours introuvable"}), 404
        if course and len(course.flashcards or []) >= MAX_FLASHCARDS:
            return jsonify({"error": f"Ce cours a déjà {MAX_FLASHCARDS} flashcards"}), 400

        if current_app.ai is None:
            return jsonify({"error": "IA indisponible"}), 503
        quota_error = consume_ai_quota("chat")
        if quota_error:
            return quota_error

        cards = _clean_flashcards(current_app.ai.generate_flashcards(text, 3))
        if not cards:
            return jsonify({"error": "Impossible de créer des flashcards. Réessaie."}), 502

        if course:
            room = MAX_FLASHCARDS - len(course.flashcards or [])
            cards = cards[:room]
            db.update_course(g.uid, course_id, flashcards=[*(course.flashcards or []), *cards])
        else:
            db.save_course(g.uid, course_id, {
                "nom": NOTES_COURSE_NAME,
                "summary": "<p>Flashcards créées depuis tes conversations avec l’assistant.</p>",
                "flashcards": cards,
                "quiz": [],
            })

        updated = db.fetch_course(g.uid, course_id)
        return jsonify({"course_id": course_id, "course_nom": updated.nom, "added": cards})
    except Exception:
        logger.exception("Erreur flashcards depuis texte")
        return internal_error("Erreur création flashcards")


# ---------------------------------------------------------------------------
# Spécialités (F54, F69)
# ---------------------------------------------------------------------------

@courses_bp.route("/api/specialties", methods=["GET"])
@require_auth
def list_specialties():
    """Spécialités proposées comme tags (l'app accepte aussi des tags libres)."""
    return jsonify({"specialties": list(SPECIALTIES)})


@courses_bp.route("/api/stats/specialties", methods=["GET"])
@require_auth
def specialty_stats():
    """Progression par spécialité : maîtrise, cartes dues, taux de bonnes réponses."""
    try:
        return jsonify({"specialties": current_app.db.get_specialty_stats(g.uid)})
    except Exception:
        logger.exception("Erreur stats par spécialité")
        return internal_error("Erreur stats")
