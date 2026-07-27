"""Routes for logging reviews and getting today's priority feed."""

from __future__ import annotations

from flask import Blueprint, g, jsonify, request

import scheduling
from auth import require_auth
from clock import today
from db import get_db
from errors import ApiError
from routes.subjects import load_subjects, topic_public

bp = Blueprint("reviews", __name__, url_prefix="/api")


def _review_public(row) -> dict:
    return {
        "id": row["id"],
        "topicId": row["topic_id"],
        "reviewedDate": row["reviewed_date"],
        "confidence": row["confidence"],
        "evidence": row["evidence"],
        "reflection": row["reflection"],
        "interval": row["interval"],
        "nextDue": row["next_due"],
    }


@bp.post("/log-review")
@require_auth
def log_review():
    """Log a review and update the topic's next due date."""
    data = request.get_json(silent=True) or {}
    topic_id = data.get("topicId")

    db = get_db()
    # Ownership: the topic must sit under a subject owned by this user.
    row = db.execute(
        """SELECT t.* FROM topics t
             JOIN subjects s ON s.id = t.subject_id
            WHERE t.id = ? AND s.user_id = ? AND t.archived = 0 AND s.archived = 0""",
        (topic_id, g.user_id),
    ).fetchone()
    if not row:
        raise ApiError("That topic could not be found.", status=404)

    changes = scheduling.log_review(topic_public(row), today())
    confidence = (data.get("confidence") or "").strip() or None
    evidence = (data.get("evidence") or "").strip() or None
    reflection = (data.get("reflection") or "").strip() or None

    db.execute(
        "UPDATE topics SET review_count = ?, next_due = ? WHERE id = ?",
        (changes["review_count"], changes["next_due"], topic_id),
    )
    cur = db.execute(
        """INSERT INTO reviews
             (topic_id, reviewed_date, confidence, interval, next_due, evidence, reflection)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (
            topic_id,
            changes["reviewed_date"],
            confidence,
            changes["interval"],
            changes["next_due"],
            evidence,
            reflection,
        ),
    )
    db.commit()

    updated = db.execute("SELECT * FROM topics WHERE id = ?", (topic_id,)).fetchone()
    review = db.execute("SELECT * FROM reviews WHERE id = ?", (cur.lastrowid,)).fetchone()
    return jsonify(topic=topic_public(updated), review=_review_public(review)), 201


@bp.get("/priorities")
@require_auth
def priorities():
    """Get today's review list for this user."""
    db = get_db()
    subjects = load_subjects(db, g.user_id)
    cap_row = db.execute("SELECT daily_cap FROM users WHERE id = ?", (g.user_id,)).fetchone()
    daily_cap = cap_row["daily_cap"] if cap_row else 5

    feed = scheduling.build_priorities(subjects, today(), daily_cap)

    all_topics = [t for s in subjects for t in s["topics"]]
    feed["coverage"] = scheduling.coverage(all_topics)
    feed["reviewedCount"] = sum(1 for t in all_topics if (t.get("reviewCount") or 0) >= 1)
    feed["totalTopics"] = len(all_topics)
    return jsonify(**feed)
