from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Response
from pydantic import BaseModel
import json

import db
import engine

router = APIRouter()


@router.get("/export")
def export_all():
    records = db.get_all_records()
    payload = json.dumps({"records": records, "exported_at": datetime.now(timezone.utc).isoformat()},
                         indent=2)
    return Response(
        content=payload,
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=orbit_export.json"},
    )


@router.delete("/all")
def delete_all():
    with db.get_db() as conn:
        conn.execute("DELETE FROM records")
        conn.execute("DELETE FROM nudges")
        conn.execute("DELETE FROM ledger")
    return {"ok": True}


class SettingsUpdate(BaseModel):
    step_goal:               Optional[int]   = None
    sleep_goal:              Optional[float] = None
    voice_enabled:           Optional[bool]  = None
    notifications_enabled:   Optional[bool]  = None
    dark_theme:              Optional[bool]  = None


_DEFAULTS: dict[str, Any] = {
    "step_goal":             engine.STEP_GOAL_DEFAULT,
    "sleep_goal":            engine.SLEEP_GOAL_DEFAULT,
    "voice_enabled":         False,
    "notifications_enabled": True,
    "dark_theme":            False,
}


def _coerce(key: str, raw: str) -> Any:
    default = _DEFAULTS.get(key)
    if isinstance(default, bool):
        return raw.lower() in ("true", "1", "yes")
    if isinstance(default, int):
        return int(raw)
    if isinstance(default, float):
        return float(raw)
    return raw


@router.get("/settings")
def get_settings():
    result: dict[str, Any] = {}
    for key, default in _DEFAULTS.items():
        raw = db.get_setting(key)
        result[key] = _coerce(key, raw) if raw is not None else default
    return result


@router.put("/settings")
def update_settings(body: SettingsUpdate):
    updates = body.model_dump(exclude_none=True)
    for key, val in updates.items():
        db.upsert_setting(key, str(val))
    # Return full settings
    result: dict[str, Any] = {}
    for key, default in _DEFAULTS.items():
        raw = db.get_setting(key)
        result[key] = _coerce(key, raw) if raw is not None else default
    return result
