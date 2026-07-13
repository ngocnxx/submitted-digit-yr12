"""Auth routes; signup, login, me, logout.
"""

from __future__ import annotations

import sqlite3

from flask import Blueprint, g, jsonify, request

from auth import encode_token, hash_password, require_auth, verify_password
from db import get_db
from errors import ApiError, require_str

bp = Blueprint("auth", __name__, url_prefix="/api/auth")

MIN_PASSWORD_LEN = 6

#repackages safe public info to send bak
def user_public(row: sqlite3.Row) -> dict:
    """The user fields safe to return to the client (never the password hash)."""
    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "yearLevel": row["year_level"],
        "onboarding_done": row["onboarding_done"],
    }


def _fetch_user(db: sqlite3.Connection, user_id: int) -> sqlite3.Row | None:
    return db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()

#sign up 
@bp.post("/signup")
def signup():
    """Create an account → 201 { token, user }, logging the new user straight in.

    Validation: name/email required andÅ length-bounded (require_str); password
    >= MIN_PASSWORD_LEN. A duplicate email trips the UNIQUE constraint and is
    reported as a friendly 400 (see the IntegrityError branch below).
    """
    data = request.get_json(silent=True) or {}
    name = require_str(data.get("name"), "name")
    email = require_str(data.get("email"), "email")
    password = data.get("password") or ""
    print(f"[trace] POST /api/auth/signup email={email!r}", flush=True)  # debug
    if len(password) < MIN_PASSWORD_LEN:
        raise ApiError(f"Password must be at least {MIN_PASSWORD_LEN} characters.")
    try:
        year_level = int(data.get("yearLevel", 12))
    except (TypeError, ValueError):
        year_level = 12

    db = get_db()
    try:
        cur = db.execute(
            "INSERT INTO users (name, email, password_hash, year_level) VALUES (?, ?, ?, ?)",
            (name, email, hash_password(password), year_level),
        )
        db.commit()
    except sqlite3.IntegrityError as err:
        # users.email has a UNIQUE constraint which mean this email is already registered.
        raise ApiError("An account with that email already exists.") from err

    row = _fetch_user(db, cur.lastrowid)
    print("[trace] signup -> 201 created + logged in", flush=True)  # debug
    return jsonify(token=encode_token(row["id"]), user=user_public(row)), 201

#log in

@bp.post("/login")
def login():
    """Authenticate → 200 { token, user }.

    Returns one 401 "Incorrect email or password." whether the email is unknown
    or the password is wrong — never revealing which, so valid emails can't be
    enumerated. Email lookup is case-insensitive (COLLATE NOCASE).
    """
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip()
    password = data.get("password") or ""
    print(f"[trace] POST /api/auth/login email={email!r}", flush=True)  # debug; never log password
    if not email or not password:
        raise ApiError("Please enter your email and password.")

    db = get_db()
    row = db.execute("SELECT * FROM users WHERE email = ? COLLATE NOCASE", (email,)).fetchone()
    if row is None or not verify_password(row["password_hash"], password):
        print("[trace] login -> 401 bad credentials", flush=True)  # debug
        raise ApiError("Incorrect email or password.", status=401)

    print("[trace] login -> 200 OK", flush=True)  # debug
    return jsonify(token=encode_token(row["id"]), user=user_public(row))


@bp.get("/me")
@require_auth
def me():
    """Rehydrate a session from a Bearer token → 200 { user }.

    The SPA calls this on load when it has a stored token but no user in memory
    (e.g. after a page refresh). @require_auth has already verified the token and
    set g.user_id; a 401 here means the account no longer exists.
    """
    print(f"[trace] GET /api/auth/me user_id={g.user_id}", flush=True)  # debug
    row = _fetch_user(get_db(), g.user_id)
    if row is None:
        raise ApiError("Account not found.", status=401)
    return jsonify(user=user_public(row))


@bp.post("/logout")
@require_auth
def logout():
    # Stateless JWTs: the client discards the token. Endpoint exists for symmetry.
    return jsonify(ok=True)
