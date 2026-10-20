import json
import os
from pathlib import Path

from flask import Flask, Response, g, jsonify, request, send_from_directory, stream_with_context
from flask_cors import CORS

from auth import auth, token_required
from attachments import AttachmentError, MAX_FILES_PER_MESSAGE, extract_attachment
from chatbot import stream_response
from db import close_db, connect_db, ensure_attachment_schema, get_db

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 26 * 1024 * 1024
FRONTEND_DIST = Path(os.getenv("FRONTEND_DIST", Path(__file__).resolve().parent / "frontend_dist"))
CORS(app, resources={r"/*": {"origins": "*"}})
app.teardown_appcontext(close_db)
app.register_blueprint(auth, url_prefix="/auth")


def chat_belongs_to_user(cursor, chat_id):
    cursor.execute("SELECT id FROM chats WHERE id=%s AND user_id=%s", (chat_id, g.user_id))
    return cursor.fetchone() is not None


def isoformat(value):
    return value.isoformat() if value else None


def serialize_chat(cursor, chat):
    ensure_attachment_schema()
    cursor.execute(
        "SELECT id, sender, text, created_at FROM messages WHERE chat_id=%s ORDER BY created_at, id",
        (chat["id"],),
    )
    messages = cursor.fetchall()
    attachment_map = {}
    message_ids = [message["id"] for message in messages]
    if message_ids:
        placeholders = ",".join(["%s"] * len(message_ids))
        cursor.execute(
            "SELECT message_id, filename, content_type, byte_size "
            f"FROM message_attachments WHERE message_id IN ({placeholders}) ORDER BY id",
            tuple(message_ids),
        )
        for attachment in cursor.fetchall():
            attachment_map.setdefault(attachment["message_id"], []).append({
                "filename": attachment["filename"],
                "content_type": attachment["content_type"],
                "byte_size": attachment["byte_size"],
            })

    return {
        "id": chat["id"],
        "title": chat["title"],
        "pinned": bool(chat["pinned"]),
        "archived": bool(chat["archived"]),
        "created_at": isoformat(chat.get("created_at")),
        "updated_at": isoformat(chat.get("updated_at")),
        "messages": [
            {
                **message,
                "created_at": isoformat(message.get("created_at")),
                "attachments": attachment_map.get(message["id"], []),
            }
            for message in messages
        ],
    }


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/chats")
@token_required
def list_chats():
    ensure_attachment_schema()
    cursor = get_db().cursor(dictionary=True)
    cursor.execute(
        "SELECT id, title, pinned, archived, created_at, updated_at FROM chats "
        "WHERE user_id=%s ORDER BY pinned DESC, updated_at DESC",
        (g.user_id,),
    )
    chats = [serialize_chat(cursor, row) for row in cursor.fetchall()]
    cursor.close()
    return jsonify({"chats": chats})


@app.post("/chats")
@token_required
def create_chat():
    ensure_attachment_schema()
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "New Chat").strip()[:255] or "New Chat"
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute("INSERT INTO chats (user_id, title) VALUES (%s, %s)", (g.user_id, title))
    db.commit()
    chat_id = cursor.lastrowid
    cursor.execute("SELECT id, title, pinned, archived, created_at, updated_at FROM chats WHERE id=%s", (chat_id,))
    chat = serialize_chat(cursor, cursor.fetchone())
    cursor.close()
    return jsonify(chat), 201


@app.patch("/chats/<int:chat_id>")
@token_required
def update_chat(chat_id):
    data = request.get_json(silent=True) or {}
    allowed = {key: data[key] for key in ("title", "pinned", "archived") if key in data}
    if "title" in allowed:
        allowed["title"] = str(allowed["title"]).strip()[:255] or "New Chat"
    if not allowed:
        return jsonify({"error": "No changes supplied"}), 400

    db = get_db()
    cursor = db.cursor(dictionary=True)
    if not chat_belongs_to_user(cursor, chat_id):
        cursor.close()
        return jsonify({"error": "Chat not found"}), 404
    assignments = ", ".join(f"{key}=%s" for key in allowed)
    cursor.execute(f"UPDATE chats SET {assignments} WHERE id=%s", (*allowed.values(), chat_id))
    db.commit()
    cursor.execute("SELECT id, title, pinned, archived, created_at, updated_at FROM chats WHERE id=%s", (chat_id,))
    chat = serialize_chat(cursor, cursor.fetchone())
    cursor.close()
    return jsonify(chat)


@app.delete("/chats/<int:chat_id>")
@token_required
def delete_chat(chat_id):
    db = get_db()
    cursor = db.cursor()
    cursor.execute("DELETE FROM chats WHERE id=%s AND user_id=%s", (chat_id, g.user_id))
    db.commit()
    deleted = cursor.rowcount
    cursor.close()
    if not deleted:
        return jsonify({"error": "Chat not found"}), 404
    return jsonify({"message": "Chat deleted"})


@app.post("/chat")
@token_required
def chat():
    if request.is_json:
        data = request.get_json(silent=True) or {}
        uploads = []
    else:
        data = request.form
        uploads = [file for file in request.files.getlist("files") if file and file.filename]

    message = (data.get("message") or "").strip()
    try:
        chat_id = int(data.get("chat_id") or 0)
    except (TypeError, ValueError):
        chat_id = 0

    if not chat_id or (not message and not uploads):
        return jsonify({"error": "A chat and a message or file are required."}), 400
    if len(uploads) > MAX_FILES_PER_MESSAGE:
        return jsonify({"error": f"You can attach up to {MAX_FILES_PER_MESSAGE} files per message."}), 400

    try:
        attachments = [extract_attachment(file) for file in uploads]
    except AttachmentError as error:
        return jsonify({"error": str(error)}), 400

    total_text_size = sum(len(item["extracted_text"]) for item in attachments)
    if total_text_size > 100_000:
        return jsonify({"error": "Combined extracted file text must be under 100,000 characters per message."}), 400

    message = message or "Please review and summarize the attached file(s)."
    db = get_db()
    ensure_attachment_schema()
    cursor = db.cursor(dictionary=True)
    if not chat_belongs_to_user(cursor, chat_id):
        cursor.close()
        return jsonify({"error": "Chat not found"}), 404

    cursor.execute("SELECT id, sender, text FROM messages WHERE chat_id=%s ORDER BY created_at, id", (chat_id,))
    previous_messages = cursor.fetchall()
    previous_ids = [item["id"] for item in previous_messages]
    attachment_history = {}
    if previous_ids:
        placeholders = ",".join(["%s"] * len(previous_ids))
        cursor.execute(
            "SELECT message_id, filename, extracted_text FROM message_attachments "
            f"WHERE message_id IN ({placeholders}) ORDER BY id",
            tuple(previous_ids),
        )
        for attachment in cursor.fetchall():
            attachment_history.setdefault(attachment["message_id"], []).append(attachment)

    history = []
    for item in previous_messages:
        text = item["text"]
        linked_files = attachment_history.get(item["id"], [])
        if linked_files:
            text += "\n\n" + "\n\n".join(
                f"[Attached file: {file['filename']}]\n{file['extracted_text']}"
                for file in linked_files
            )
        history.append({"sender": item["sender"], "text": text})

    cursor.execute("INSERT INTO messages (chat_id, sender, text) VALUES (%s, 'user', %s)", (chat_id, message))
    user_message_id = cursor.lastrowid
    for attachment in attachments:
        cursor.execute(
            "INSERT INTO message_attachments "
            "(message_id, filename, content_type, byte_size, extracted_text) VALUES (%s, %s, %s, %s, %s)",
            (
                user_message_id,
                attachment["filename"],
                attachment["content_type"],
                attachment["byte_size"],
                attachment["extracted_text"],
            ),
        )

    prompt = message
    if attachments:
        file_context = "\n\n".join(
            f"--- Attached file: {item['filename']} ---\n{item['extracted_text']}"
            for item in attachments
        )
        prompt += "\n\nUse the following uploaded file content as context:\n" + file_context

    cursor.execute(
        "UPDATE chats SET title=CASE WHEN title='New Chat' THEN %s ELSE title END, "
        "updated_at=CURRENT_TIMESTAMP WHERE id=%s",
        (" ".join(message.split()[:4])[:255], chat_id),
    )
    db.commit()
    cursor.close()

    def stream_events():
        reply_parts = []
        try:
            for token in stream_response(prompt, history):
                reply_parts.append(token)
                yield "data: " + json.dumps({"type": "token", "content": token}, ensure_ascii=False) + "\n\n"

            reply = "".join(reply_parts).strip()
            if reply:
                save_db = connect_db()
                save_cursor = None
                try:
                    save_cursor = save_db.cursor()
                    save_cursor.execute(
                        "INSERT INTO messages (chat_id, sender, text) VALUES (%s, 'bot', %s)",
                        (chat_id, reply),
                    )
                    save_db.commit()
                finally:
                    if save_cursor is not None:
                        save_cursor.close()
                    save_db.close()
            yield "data: " + json.dumps({"type": "done"}, ensure_ascii=False) + "\n\n"
        except GeneratorExit:
            raise
        except Exception as error:
            print("CHAT STREAM ERROR:", error)
            yield "data: " + json.dumps(
                {"type": "error", "message": "The response stream stopped. Please try again."},
                ensure_ascii=False,
            ) + "\n\n"

    return Response(
        stream_with_context(stream_events()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.errorhandler(413)
def file_too_large(_error):
    return jsonify({"error": "The upload is too large. Keep each file under 6 MB and attach up to four files."}), 413


def serve_frontend(asset_path=""):
    index_path = FRONTEND_DIST / "index.html"
    if not index_path.is_file():
        return jsonify({"error": "Frontend build not found"}), 404

    if asset_path:
        requested_path = (FRONTEND_DIST / asset_path).resolve()
        try:
            requested_path.relative_to(FRONTEND_DIST.resolve())
        except ValueError:
            return jsonify({"error": "Not found"}), 404
        if requested_path.is_file():
            return send_from_directory(FRONTEND_DIST, asset_path)

    return send_from_directory(FRONTEND_DIST, "index.html")


@app.get("/")
def frontend_index():
    return serve_frontend()


@app.get("/<path:asset_path>")
def frontend_assets(asset_path):
    return serve_frontend(asset_path)


if __name__ == "__main__":
    app.run(debug=os.getenv("APP_ENV") != "production", host="0.0.0.0", port=int(os.getenv("PORT", "5000")))
