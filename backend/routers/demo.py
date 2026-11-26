from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone

import db
import engine

router = APIRouter()


@router.post("/demo")
def load_demo():
    # Rule 4: If real data exists, block loading demo data so it cannot mix in
    if db.has_real_records():
        raise HTTPException(
            status_code=400,
            detail="Cannot load demo data: real health data exists. Clear your data first to load demo data.",
        )

    # Rule 1: Loading demo data must delete old demo rows first
    db.delete_demo_records()

    # Rule 3: Never delete real uploaded rows (already guaranteed above and by delete_demo_records)

    records = engine.generate_demo_records()
    for rec in records:
        db.upsert_record(rec["date"], rec)

    # Mark as demo data
    db.upsert_setting("is_demo_data", "true")

    # Clear stale nudges and persist fresh ones for the demo set
    with db.get_db() as conn:
        conn.execute("DELETE FROM nudges")
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
