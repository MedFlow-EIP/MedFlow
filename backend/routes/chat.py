import base64
import binascii
import logging
import uuid

from flask import Blueprint, current_app, g, jsonify, request

from middleware.auth import require_auth

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
        files.append({"name": item.get("name") or "fichier", "mime_type": mime_type, "data": data})
    return files, None, None


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
        if not message:
            message = DEFAULT_ATTACHMENT_PROMPT

        db = current_app.db
        ai_provider = current_app.ai
        if ai_provider is None:
            return jsonify({"error": "Assistant IA indisponible"}), 503

        # Une conversation inconnue ou appartenant à quelqu'un d'autre
        # repart de zéro : on ne mélange jamais les historiques.
        if not conversation_id or db.get_chat_conversation_owner(conversation_id) != uid:
            conversation_id = str(uuid.uuid4())
            title = message[:30] + "..." if len(message) > 30 else message
            db.create_chat_conversation(uid=uid, title=title, conversation_id=conversation_id)

        # Historique AVANT le nouveau message (sinon il serait envoyé deux fois au modèle).
        history = [
            {"role": "user" if msg["sender"] == "user" else "assistant", "content": msg["content"]}
            for msg in db.fetch_chat_messages(conversation_id)
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
