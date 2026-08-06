from flask import Blueprint, request, jsonify, current_app
import uuid
import logging

logger = logging.getLogger(__name__)

chat_bp = Blueprint("chat", __name__)


@chat_bp.route("/chat", methods=["POST"])
def medical_chat():

    try:

        data = request.get_json()

        if not data:
            return jsonify({
                "error": "Body JSON invalide"
            }), 400

        uid = data.get("uid", "anonymous")
        conversation_id = data.get("conversation_id")
        message = data.get("message")
        attachments = data.get("attachments", [])

        # ---------------------------------------------------
        # Validation
        # ---------------------------------------------------

        if not message or not message.strip():
            return jsonify({
                "error": "Le message est vide"
            }), 400

        db = current_app.db
        ai_provider = current_app.ai

        # ---------------------------------------------------
        # Create conversation
        # ---------------------------------------------------

        if not conversation_id:

            conversation_id = str(uuid.uuid4())

            title = (
                message[:30] + "..."
                if len(message) > 30
                else message
            )

            db.create_chat_conversation(
                uid=uid,
                title=title,
                conversation_id=conversation_id,
            )

        # ---------------------------------------------------
        # Save user message
        # ---------------------------------------------------

        user_message_id = str(uuid.uuid4())

        db.save_chat_message(
            message_id=user_message_id,
            conversation_id=conversation_id,
            sender="user",
            content=message,
            attachments=attachments,
        )

        # ---------------------------------------------------
        # Fetch history
        # ---------------------------------------------------

        messages = db.fetch_chat_messages(conversation_id)

        history = []

        for msg in messages:

            role = (
                "user"
                if msg["sender"] == "user"
                else "assistant"
            )

            history.append({
                "role": role,
                "content": msg["content"]
            })

        # ---------------------------------------------------
        # Generate AI response
        # ---------------------------------------------------

        ai_response = ai_provider.medical_chat(
            user_message=message,
            history=history,
        )

        # ---------------------------------------------------
        # Save AI response
        # ---------------------------------------------------

        ai_message_id = str(uuid.uuid4())

        db.save_chat_message(
            message_id=ai_message_id,
            conversation_id=conversation_id,
            sender="ai",
            content=ai_response,
        )

        # ---------------------------------------------------
        # Response
        # ---------------------------------------------------

        return jsonify({
            "conversation_id": conversation_id,
            "response": ai_response,
        })

    except Exception as e:

        logger.exception("Erreur chat médical")

        return jsonify({
            "error": str(e)
        }), 500