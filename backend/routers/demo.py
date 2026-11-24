from fastapi import APIRouter
from datetime import datetime, timezone

import db
import engine

router = APIRouter()


@router.post("/demo")
def load_demo():
    records = engine.generate_demo_records()
    for rec in records:
        db.upsert_record(rec["date"], rec)

    # Generate and persist nudges
    all_records = db.get_all_records()
    result = engine.compute_insights(all_records)
    _save_nudges(result["nudges"])

    return {"days_added": len(records), "message": "Demo data loaded successfully."}


def _save_nudges(nudges: list[dict]) -> None:
    with db.get_db() as conn:
        for n in nudges:
            conn.execute(
                """INSERT INTO nudges (id, text, kind, status, snooze_until, created_at)
                   VALUES (?, ?, ?, ?, ?, ?)
                   ON CONFLICT(id) DO UPDATE SET
                     text=excluded.text,
                     kind=excluded.kind,
                     created_at=excluded.created_at""",
                (n["id"], n["text"], n["kind"], n.get("status", "pending"),
                 n.get("snooze_until"), n.get("created_at")),
            )
