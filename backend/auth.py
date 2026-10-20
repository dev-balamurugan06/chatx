import os
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from flask import Blueprint, g, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

from db import get_db

auth = Blueprint("auth", __name__)
JWT_SECRET = os.getenv("JWT_SECRET", "").strip()
if not JWT_SECRET:
    if os.getenv("APP_ENV") == "production":
        raise RuntimeError("Set JWT_SECRET before starting the production server.")
    JWT_SECRET = "change-this-secret-in-development"
JWT_ALGORITHM = "HS256"


def create_token(user):
    payload = {
        "sub": str(user["id"]),
        "email": user["email"],
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def token_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return jsonify({"error": "Authentication required"}), 401

        try:
            payload = jwt.decode(
                header.removeprefix("Bearer ").strip(),
                JWT_SECRET,
                algorithms=[JWT_ALGORITHM],
            )
            g.user_id = int(payload["sub"])
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, KeyError, ValueError):
            return jsonify({"error": "Invalid or expired token"}), 401

        return view(*args, **kwargs)

    return wrapped


@auth.post("/signup")
def signup():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not username or not email or not password:
        return jsonify({"error": "All fields are required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    try:
        db = get_db()
        cursor = db.cursor(dictionary=True)
        cursor.execute("SELECT id FROM users WHERE email=%s", (email,))
        if cursor.fetchone():
            cursor.close()
            return jsonify({"error": "User already exists"}), 409

        cursor.execute(
            "INSERT INTO users (username, email, password) VALUES (%s, %s, %s)",
            (username, email, generate_password_hash(password)),
        )
        db.commit()
        user_id = cursor.lastrowid
        cursor.close()
        return jsonify({"message": "Signup successful", "user": {"id": user_id, "username": username, "email": email}}), 201
    except Exception as error:
        print("SIGNUP ERROR:", error)
        return jsonify({"error": "Server error"}), 500


@auth.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    try:
        cursor = get_db().cursor(dictionary=True)
        cursor.execute("SELECT id, username, email, password FROM users WHERE email=%s", (email,))
        user = cursor.fetchone()
        cursor.close()

        if not user or not check_password_hash(user["password"], password):
            return jsonify({"error": "Invalid email or password"}), 401

        safe_user = {"id": user["id"], "username": user["username"], "email": user["email"]}
        return jsonify({"message": "Login successful", "user": safe_user, "token": create_token(user)})
    except Exception as error:
        print("LOGIN ERROR:", error)
        return jsonify({"error": "Server error"}), 500
