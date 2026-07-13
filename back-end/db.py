"""SQLite access that include connection helper, per-request lifecycle, and init_db().

"""

from __future__ import annotations

import os
import sqlite3
from pathlib import Path

from flask import current_app, g

SCHEMA_PATH = Path(__file__).with_name("schema.sql")

#finding the database path
def _database_path() -> str:

    if current_app:
        return current_app.config["DATABASE_PATH"]
    return os.environ.get("DATABASE_PATH", "navigator.db")

#open connection -> if connection is not present then create it
def get_db() -> sqlite3.Connection:

    if "db" not in g:
        conn = sqlite3.connect(_database_path())
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON") #turn on relational link
        g.db = conn
    return g.db

#pull the data then completely destroy it (close connection)
def close_db(_exception: BaseException | None = None) -> None:
    db = g.pop("db", None)
    if db is not None:
        db.close()

# build the tables
def init_db(database_path: str | None = None) -> None:
    """Create all tables from schema.sql. Safe to run repeatedly (IF NOT EXISTS)."""
    path = database_path or _database_path()
    conn = sqlite3.connect(path)
    try:
        conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
        conn.commit()
    finally:
        conn.close()


if __name__ == "__main__":
    # Allow:  python -c "import db; db.init_db()"  and  python db.py
    init_db()
    print(f"Initialised database at {_database_path()!r}")
