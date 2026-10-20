import os
import threading

import mysql.connector
from dotenv import load_dotenv
from flask import g

load_dotenv()

DB_CONFIG = {
    "host": os.getenv("DB_HOST") or os.getenv("MYSQLHOST") or "localhost",
    "port": int(os.getenv("DB_PORT") or os.getenv("MYSQLPORT") or "3306"),
    "user": os.getenv("DB_USER") or os.getenv("MYSQLUSER") or "root",
    "password": os.getenv("DB_PASSWORD") or os.getenv("MYSQLPASSWORD") or "",
    "database": os.getenv("DB_NAME") or os.getenv("MYSQLDATABASE") or "ai_chat_system",
}

_attachment_schema_ready = False
_attachment_schema_lock = threading.Lock()


def connect_db():
    """Create a standalone MySQL connection."""
    return mysql.connector.connect(**DB_CONFIG)


def get_db():
    """Return one MySQL connection for the current Flask request."""
    if "db" not in g:
        g.db = connect_db()
    return g.db


def ensure_attachment_schema():
    """Create the attachment table for databases created by older app versions."""
    global _attachment_schema_ready
    if _attachment_schema_ready:
        return

    with _attachment_schema_lock:
        if _attachment_schema_ready:
            return
        db = get_db()
        cursor = db.cursor()
        try:
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS message_attachments (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    message_id INT NOT NULL,
                    filename VARCHAR(255) NOT NULL,
                    content_type VARCHAR(100) NOT NULL,
                    byte_size INT NOT NULL DEFAULT 0,
                    extracted_text MEDIUMTEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT fk_attachments_message FOREIGN KEY (message_id)
                        REFERENCES messages(id) ON DELETE CASCADE,
                    INDEX idx_attachments_message (message_id)
                )
                """
            )
            db.commit()
            _attachment_schema_ready = True
        finally:
            cursor.close()


def close_db(_error=None):
    db = g.pop("db", None)
    if db is not None and db.is_connected():
        db.close()
