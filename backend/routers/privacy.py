from __future__ import annotations

import os
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import db
import engine

router = APIRouter()


class AISummaryRequest(BaseModel):
    approved: bool


@router.get("/privacy/payload")
def get_privacy_payload():
    records = db.get_all_records()
    step_goal  = int(db.get_setting("step_goal",  engine.STEP_GOAL_DEFAULT))
    sleep_goal = float(db.get_setting("sleep_goal", engine.SLEEP_GOAL_DEFAULT))
    result = engine.compute_insights(records, step_goal=step_goal, sleep_goal=sleep_goal)
    return result["payload"]


@router.post("/ai/summary")
def ai_summary(body: AISummaryRequest):
    if not body.approved:
        raise HTTPException(status_code=403, detail="User did not approve data sharing.")

    records = db.get_all_records()
    step_goal  = int(db.get_setting("step_goal",  engine.STEP_GOAL_DEFAULT))
    sleep_goal = float(db.get_setting("sleep_goal", engine.SLEEP_GOAL_DEFAULT))
    result = engine.compute_insights(records, step_goal=step_goal, sleep_goal=sleep_goal)
    payload = result["payload"]

    gemini_key = os.environ.get("GEMINI_API_KEY", "")
    source = "local"
    summary = ""

    if gemini_key:
        try:
            from google import genai  # type: ignore
            client = genai.Client(api_key=gemini_key)
            prompt = (
                "You are a friendly health coach. Summarise this anonymised health data in 3 short, "
                "encouraging sentences. Data: " + str(payload)
            )
            response = client.models.generate_content(model="gemini-2.0-flash", contents=prompt)
            summary = response.text.strip()
            source = "gemini"
        except Exception as exc:
            summary = _local_summary(payload, result)
            source = "local"
    else:
        summary = _local_summary(payload, result)

    # Write ledger row
    with db.get_db() as conn:
        conn.execute(
            "INSERT INTO ledger (ts, what, destination, approved) VALUES (?, ?, ?, ?)",
            (datetime.now(timezone.utc).isoformat(), "ai_summary", source, 1),
        )

    return {"summary": summary, "source": source}


def _local_summary(payload: dict, result: dict) -> str:
    score = payload.get("orbit_score", 0)
    band  = payload.get("band", "")
    avg_steps = payload.get("avg_steps")
    avg_steps_str = f"{avg_steps:,}" if avg_steps is not None else "N/A"
    avg_sleep = payload.get("avg_sleep_h")
    avg_sleep_str = f"{avg_sleep:.1f}h" if avg_sleep is not None else "N/A"
    streak    = payload.get("streak", 0)
    return (
        f"Your Orbit Score is {score}/100 ({band}). "
        f"You're averaging {avg_steps_str} steps and {avg_sleep_str} of sleep per day. "
        f"Keep up your {streak}-day streak — every step counts!"
    )


@router.get("/ledger")
def get_ledger():
    with db.get_db() as conn:
        rows = conn.execute("SELECT * FROM ledger ORDER BY id DESC").fetchall()
    return [dict(r) for r in rows]
