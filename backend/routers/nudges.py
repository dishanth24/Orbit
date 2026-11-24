from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Optional

import db

router = APIRouter()


class SnoozeRequest(BaseModel):
    until: str


@router.get("/nudges")
def list_nudges():
    with db.get_db() as conn:
        rows = conn.execute("SELECT * FROM nudges ORDER BY created_at DESC").fetchall()
    return [dict(r) for r in rows]


@router.post("/nudges/{nudge_id}/done")
def mark_done(nudge_id: str):
    with db.get_db() as conn:
        result = conn.execute(
            "UPDATE nudges SET status='done' WHERE id=?", (nudge_id,)
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Nudge not found")
    return {"ok": True}


@router.post("/nudges/{nudge_id}/snooze")
def snooze_nudge(nudge_id: str, body: SnoozeRequest):
    with db.get_db() as conn:
        result = conn.execute(
            "UPDATE nudges SET status='snoozed', snooze_until=? WHERE id=?",
            (body.until, nudge_id),
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Nudge not found")
    return {"ok": True}
