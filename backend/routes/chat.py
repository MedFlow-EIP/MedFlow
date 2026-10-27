import base64
import binascii
import logging
import uuid

from flask import Blueprint, current_app, g, jsonify, request

from middleware.ai_quota import consume_ai_quota
from middleware.auth import require_auth
from services.pdf import pdf_page_count as _pdf_page_count

logger = logging.getLogger(__name__)

chat_bp = Blueprint("chat", __name__)

# Pièces jointes acceptées par le chat (lues par Gemini).
ALLOWED_ATTACHMENT_TYPES = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
MAX_ATTACHMENTS = 3
MAX_ATTACHMENT_BYTES = 7 * 1024 * 1024  # 7 Mo par fichier, après décodage

DEFAULT_ATTACHMENT_PROMPT = "Analyse ce document et explique-moi l'essentiel."


def _parse_attachments(raw):
    """Valide et décode les pièces jointes. Renvoie (fichiers, erreur, code HTTP)."""
    if not raw:
        return [], None, None
    if not isinstance(raw, list):
        return None, "Pièces jointes invalides", 400
    if len(raw) > MAX_ATTACHMENTS:
        return None, f"{MAX_ATTACHMENTS} pièces jointes maximum par message", 400

    files = []
    for item in raw:
        if not isinstance(item, dict):
            return None, "Pièce jointe invalide", 400
        mime_type = (item.get("mime_type") or "").lower()
        if mime_type not in ALLOWED_ATTACHMENT_TYPES:
            return None, "Format non pris en charge (images JPEG/PNG/WebP ou PDF)", 400
        try:
            data = base64.b64decode(item.get("data") or "", validate=True)
        except (binascii.Error, ValueError):
            return None, "Pièce jointe illisible", 400
        if not data:
            return None, "Pièce jointe vide", 400
        if len(data) > MAX_ATTACHMENT_BYTES:
            return None, "Pièce jointe trop lourde (7 Mo maximum)", 413
        if mime_type == "application/pdf":
            # Gemini facture chaque page lue : un PDF de 500 pages coûterait cher.
            max_pages = current_app.config.get("CHAT_MAX_PDF_PAGES", 30)
            pages = _pdf_page_count(data)
            if pages is None:
                return None, "PDF illisible", 400
            if pages > max_pages:
                return None, f"PDF trop long ({max_pages} pages maximum dans le chat)", 413
        files.append({"name": item.get("name") or "fichier", "mime_type": mime_type, "data": data})
    return files, None, None


# Formats enregistrés par l'app (AAC sur Android, WAV sur iOS) et lus par Gemini.
AUDIO_TYPES = {"audio/aac", "audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp4", "audio/ogg", "audio/flac"}


@chat_bp.route("/chat/transcribe", methods=["POST"])
@require_auth
def transcribe():
    """Dictée vocale (F45) : renvoie le texte, que l'utilisateur relit avant
    de l'envoyer. Compte dans le quota du chat."""
    try:
        data = request.get_json(silent=True) or {}
        mime_type = (data.get("mime_type") or "").lower()
        if mime_type not in AUDIO_TYPES:
            return jsonify({"error": "Format audio non pris en charge"}), 400
        try:
            audio = base64.b64decode(data.get("audio") or "", validate=True)
        except (binascii.Error, ValueError):
            return jsonify({"error": "Audio illisible"}), 400
        if not audio:
            return jsonify({"error": "Enregistrement vide"}), 400
        if len(audio) > current_app.config.get("MAX_AUDIO_BYTES", 2 * 1024 * 1024):
            return jsonify({"error": "Enregistrement trop long (2 minutes maximum)"}), 413

        if current_app.ai is None:
            return jsonify({"error": "Assistant IA indisponible"}), 503
        quota_error = consume_ai_quota("chat")
        if quota_error:
            return quota_error

        text = current_app.ai.transcribe_audio(audio, mime_type)
        if not text:
            return jsonify({"error": "Je n'ai rien compris. Parle plus près du micro et réessaie."}), 422
        return jsonify({"text": text[: current_app.config.get("CHAT_MAX_MESSAGE_CHARS", 2000)]})
    except Exception:
        logger.exception("Erreur dictée vocale")
        return jsonify({"error": "Erreur interne de l'assistant"}), 500


@chat_bp.route("/chat", methods=["POST"])
@require_auth
def medical_chat():
    """Assistant médical. Garde le fil de la conversation (conversation_id)
    et transmet images / PDF joints au modèle."""
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"error": "Body JSON invalide"}), 400

        uid = g.uid
        conversation_id = data.get("conversation_id")
        message = (data.get("message") or "").strip()

        attachments, error, status = _parse_attachments(data.get("attachments"))
        if error:
            return jsonify({"error": error}), status

        if not message and not attachments:
            return jsonify({"error": "Le message est vide"}), 400
        max_chars = current_app.config.get("CHAT_MAX_MESSAGE_CHARS", 2000)
        if len(message) > max_chars:
            return jsonify({"error": f"Message trop long ({max_chars} caractères maximum)"}), 400
        if not message:
            message = DEFAULT_ATTACHMENT_PROMPT

        db = current_app.db
        ai_provider = current_app.ai
        if ai_provider is None:
            return jsonify({"error": "Assistant IA indisponible"}), 503

        quota_error = consume_ai_quota("chat")
        if quota_error:
            return quota_error

        # Une conversation inconnue ou appartenant à quelqu'un d'autre
        # repart de zéro : on ne mélange jamais les historiques.
        if not conversation_id or db.get_chat_conversation_owner(conversation_id) != uid:
            conversation_id = str(uuid.uuid4())
            title = message[:30] + "..." if len(message) > 30 else message
            db.create_chat_conversation(uid=uid, title=title, conversation_id=conversation_id)

        # Historique AVANT le nouveau message (sinon il serait envoyé deux fois au modèle).
        # Seuls les derniers échanges partent, tronqués : chaque token est facturé.
        keep = current_app.config.get("CHAT_HISTORY_MESSAGES", 12)
        history = [
            {
                "role": "user" if msg["sender"] == "user" else "assistant",
                "content": msg["content"][:max_chars],
            }
            for msg in db.fetch_chat_messages(conversation_id)[-keep:]
        ]

        db.save_chat_message(
            message_id=str(uuid.uuid4()),
            conversation_id=conversation_id,
            sender="user",
            content=message,
            # Seuls le nom et le type sont conservés, jamais le contenu du fichier.
            attachments=[{"name": a["name"], "mime_type": a["mime_type"]} for a in attachments],
        )

        ai_response = ai_provider.medical_chat(
            user_message=message,
            history=history,
            attachments=[(a["data"], a["mime_type"]) for a in attachments],
        )

        db.save_chat_message(
            message_id=str(uuid.uuid4()),
            conversation_id=conversation_id,
            sender="ai",
            content=ai_response,
        )

        return jsonify({"conversation_id": conversation_id, "response": ai_response})

    except Exception:
        logger.exception("Erreur chat médical")
        return jsonify({"error": "Erreur interne de l'assistant"}), 500


# ---------------------------------------------------------------------------
# Historique synchronisé entre appareils
# ---------------------------------------------------------------------------

@chat_bp.route("/chat/conversations", methods=["GET"])
@require_auth
def list_conversations():
    """Conversations de l'utilisateur, avec leurs messages (plus récentes d'abord)."""
    try:
        db = current_app.db
        conversations = []
        for conv in db.fetch_chat_conversations(g.uid)[:50]:
            messages = db.fetch_chat_messages(conv["conversation_id"])
            if not messages:
                continue
            conversations.append({
                "conversation_id": conv["conversation_id"],
                "title": conv["title"],
                "created_at": conv["created_at"],
                "updated_at": conv["updated_at"],
                "messages": [
                    {
                        "sender": m["sender"],
                        "content": m["content"],
                        "attachments": m["attachments"],
                        "created_at": m["created_at"],
                    }
                    for m in messages
                ],
            })
        return jsonify({"conversations": conversations})
    except Exception:
        logger.exception("Erreur liste des conversations")
        return jsonify({"error": "Erreur interne"}), 500


@chat_bp.route("/chat/conversations/<conversation_id>", methods=["DELETE"])
@require_auth
def delete_conversation(conversation_id):
    try:
        if not current_app.db.delete_chat_conversation(g.uid, conversation_id):
            return jsonify({"error": "Conversation introuvable"}), 404
        return jsonify({"success": True})
    except Exception:
        logger.exception("Erreur suppression conversation")
        return jsonify({"error": "Erreur interne"}), 500
