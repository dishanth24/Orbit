from fastapi import APIRouter, Query, HTTPException
from statistics import mean

import db

router = APIRouter()

VALID_METRICS = {"steps", "sleep_h", "rhr", "mood", "water_l"}


@router.get("/trends")
def get_trends(
    metric: str = Query("steps"),
    days:   int  = Query(30, ge=1, le=3650),
):
    if metric not in VALID_METRICS:
        raise HTTPException(status_code=400, detail=f"metric must be one of {sorted(VALID_METRICS)}")

    records = db.get_records(days=days)
    points = []
    for r in records:
        val = r.get(metric)
        if val is not None:
            points.append({"label": r["date"], "value": val})

    if not points:
        return {"points": [], "avg": None, "min": None, "max": None, "best": None, "best_label": None}

    values = [p["value"] for p in points]
    best_pt = max(points, key=lambda p: p["value"])

    return {
        "points":      points,
        "avg":         round(mean(values), 2),
        "min":         min(values),
        "max":         max(values),
        "best":        best_pt["value"],
        "best_label":  best_pt["label"],
    }
