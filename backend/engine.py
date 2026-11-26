"""Deterministic rules engine for Orbit.

Powered by backend.metrics — the single canonical calculation engine.
"""
from __future__ import annotations

import csv
import io
import re
from datetime import datetime, timezone, date, timedelta
from typing import Any, Optional

import metrics

STEP_GOAL_DEFAULT = 8000
SLEEP_GOAL_DEFAULT = 7.0
HEART_GOAL_DEFAULT = 65
MOOD_GOAL_DEFAULT = 4.0
WATER_GOAL_DEFAULT = 2.5

# ---------------------------------------------------------------------------
# CSV parsing & Import cleaning
# ---------------------------------------------------------------------------

_COL_ALIASES: dict[str, list[str]] = {
    "date":    ["date", "day", "timestamp"],
    "steps":   ["steps", "step_count"],
    "sleep_h": ["sleep", "sleep_hours", "hours_slept", "sleep_duration"],
    "rhr":     ["hr", "resting_hr", "rhr", "heart_rate"],
    "mood":    ["mood", "mood_score"],
    "water_l": ["water", "water_l"],
}


class ImportReport(dict):
    """Import report dict with integer comparison compatibility."""

    def __init__(
        self,
        skipped_count: int,
        rows_read: int,
        rows_used: int,
        skipped_reasons: list[dict],
        date_range: dict | None,
        num_days: int,
    ):
        super().__init__({
            "skipped_count": skipped_count,
            "rows_read": rows_read,
            "rows_used": rows_used,
            "skipped_rows": skipped_reasons,
            "date_range": date_range,
            "num_days": num_days,
        })
        self.skipped_count = skipped_count
        self.rows_read = rows_read
        self.rows_used = rows_used
        self.skipped_rows = skipped_reasons
        self.date_range = date_range
        self.num_days = num_days

    def __int__(self) -> int:
        return self.skipped_count

    def __index__(self) -> int:
        return self.skipped_count

    def __eq__(self, other: Any) -> bool:
        if isinstance(other, int):
            return self.skipped_count == other
        return super().__eq__(other)

    def __ge__(self, other: Any) -> bool:
        if isinstance(other, int):
            return self.skipped_count >= other
        return super().__ge__(other)

    def __le__(self, other: Any) -> bool:
        if isinstance(other, int):
            return self.skipped_count <= other
        return super().__le__(other)

    def __gt__(self, other: Any) -> bool:
        if isinstance(other, int):
            return self.skipped_count > other
        return super().__gt__(other)

    def __lt__(self, other: Any) -> bool:
        if isinstance(other, int):
            return self.skipped_count < other
        return super().__lt__(other)


def _map_header(raw_headers: list[str]) -> dict[str, str]:
    """Return {canonical_col: raw_header} for recognised columns."""
    normalised = [h.strip().lower().lstrip("\ufeff") for h in raw_headers]
    mapping: dict[str, str] = {}
    for canon, aliases in _COL_ALIASES.items():
        for idx, norm in enumerate(normalised):
            if norm in aliases:
                mapping[canon] = raw_headers[idx]
                break
    return mapping


def _detect_file_date_format(sample_dates: list[str]) -> str:
    """Detect whether dates in the file are YYYY-MM-DD or DD/MM/YYYY."""
    slash_count = 0
    hyphen_count = 0
    for s in sample_dates:
        s = s.strip()
        if re.match(r"^\d{4}-\d{1,2}-\d{1,2}$", s):
            hyphen_count += 1
        elif re.match(r"^\d{1,2}/\d{1,2}/\d{4}$", s):
            slash_count += 1
    return "DD/MM/YYYY" if slash_count > hyphen_count else "YYYY-MM-DD"


def _parse_date_with_format(val: str, file_fmt: str) -> str | None:
    """Parse date string into standard ISO YYYY-MM-DD."""
    val = val.strip()
    if not val:
        return None

    # Check ISO format YYYY-MM-DD
    m_iso = re.match(r"^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$", val)
    if m_iso:
        y, m, d = int(m_iso.group(1)), int(m_iso.group(2)), int(m_iso.group(3))
        try:
            return date(y, m, d).isoformat()
        except ValueError:
            return None

    # Check DD/MM/YYYY or DD-MM-YYYY
    m_dmy = re.match(r"^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$", val)
    if m_dmy:
        d, m, y = int(m_dmy.group(1)), int(m_dmy.group(2)), int(m_dmy.group(3))
        try:
            return date(y, m, d).isoformat()
        except ValueError:
            return None

    return None


def parse_csv(content: bytes, filename: str = "upload.csv") -> tuple[list[dict], ImportReport]:
    """Parse CSV with full import cleaning:
    - Strips BOM
    - Detects DD/MM/YYYY vs YYYY-MM-DD
    - Converts sleep minutes to hours
    - Skips out-of-range rows with reasons:
        steps: 0 - 100,000
        sleep_h: 0 - 24 h
        heart rate (rhr): 30 - 220 bpm
        mood: 1.0 - 5.0
        water_l: 0 - 10.0 L
    - Merges duplicate dates within the file
    - Returns (merged_records, ImportReport)
    """
    if content.startswith(b"\xef\xbb\xbf"):
        content = content[3:]
    text = content.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        report = ImportReport(0, 0, 0, [], None, 0)
        return [], report

    mapping = _map_header(list(reader.fieldnames))
    raw_rows = list(reader)
    rows_read = len(raw_rows)

    if "date" not in mapping:
        report = ImportReport(rows_read, rows_read, 0, [{"row": 0, "reason": "No date column found"}], None, 0)
        return [], report

    # Sample date format detection
    sample_dates = [r.get(mapping["date"], "") for r in raw_rows[:50] if r.get(mapping["date"])]
    file_fmt = _detect_file_date_format(sample_dates)

    valid_rows: list[dict[str, Any]] = []
    skipped_reasons: list[dict[str, Any]] = []

    for idx, raw in enumerate(raw_rows, start=1):
        date_raw = raw.get(mapping.get("date", ""), "").strip()
        parsed_d = _parse_date_with_format(date_raw, file_fmt)
        if not parsed_d:
            skipped_reasons.append({"row": idx, "reason": f"Invalid date: '{date_raw}'"})
            continue

        row_data: dict[str, Any] = {"date": parsed_d}
        row_invalid = False

        # Steps: 0 to 100,000
        if "steps" in mapping:
            v_str = raw.get(mapping["steps"], "").strip()
            if v_str:
                try:
                    v_int = int(float(v_str))
                    if not (0 <= v_int <= 100_000):
                        skipped_reasons.append({
                            "row": idx,
                            "reason": f"Steps {v_int} out of range (0 to 100,000)",
                        })
                        row_invalid = True
                    else:
                        row_data["steps"] = v_int
                except ValueError:
                    skipped_reasons.append({"row": idx, "reason": f"Invalid steps value: '{v_str}'"})
                    row_invalid = True

        # Sleep: 0 to 24h (convert minutes to hours if > 24)
        if not row_invalid and "sleep_h" in mapping:
            v_str = raw.get(mapping["sleep_h"], "").strip()
            if v_str:
                try:
                    v_float = float(v_str)
                    if v_float > 24.0:
                        v_float = v_float / 60.0  # converted minutes to hours
                    if not (0.0 <= v_float <= 24.0):
                        skipped_reasons.append({
                            "row": idx,
                            "reason": f"Sleep {v_float:.1f}h out of range (0 to 24h)",
                        })
                        row_invalid = True
                    else:
                        row_data["sleep_h"] = round(v_float, 2)
                except ValueError:
                    skipped_reasons.append({"row": idx, "reason": f"Invalid sleep value: '{v_str}'"})
                    row_invalid = True

        # Resting HR: 30 to 220 bpm
        if not row_invalid and "rhr" in mapping:
            v_str = raw.get(mapping["rhr"], "").strip()
            if v_str:
                try:
                    v_int = int(float(v_str))
                    if not (30 <= v_int <= 220):
                        skipped_reasons.append({
                            "row": idx,
                            "reason": f"Heart rate {v_int} bpm out of range (30 to 220)",
                        })
                        row_invalid = True
                    else:
                        row_data["rhr"] = v_int
                except ValueError:
                    skipped_reasons.append({"row": idx, "reason": f"Invalid heart rate value: '{v_str}'"})
                    row_invalid = True

        # Mood: 1.0 to 5.0
        if not row_invalid and "mood" in mapping:
            v_str = raw.get(mapping["mood"], "").strip()
            if v_str:
                try:
                    v_float = float(v_str)
                    if not (1.0 <= v_float <= 5.0):
                        skipped_reasons.append({
                            "row": idx,
                            "reason": f"Mood {v_float} out of range (1.0 to 5.0)",
                        })
                        row_invalid = True
                    else:
                        row_data["mood"] = round(v_float, 1)
                except ValueError:
                    skipped_reasons.append({"row": idx, "reason": f"Invalid mood value: '{v_str}'"})
                    row_invalid = True

        # Water: 0.0 to 10.0 L
        if not row_invalid and "water_l" in mapping:
            v_str = raw.get(mapping["water_l"], "").strip()
            if v_str:
                try:
                    v_float = float(v_str)
                    if not (0.0 <= v_float <= 10.0):
                        skipped_reasons.append({
                            "row": idx,
                            "reason": f"Water {v_float}L out of range (0 to 10L)",
                        })
                        row_invalid = True
                    else:
                        row_data["water_l"] = round(v_float, 2)
                except ValueError:
                    skipped_reasons.append({"row": idx, "reason": f"Invalid water value: '{v_str}'"})
                    row_invalid = True

        if not row_invalid:
            valid_rows.append(row_data)

    # Merge duplicate dates
    merged_by_date: dict[str, dict[str, Any]] = {}
    for r in valid_rows:
        d = r["date"]
        if d not in merged_by_date:
            merged_by_date[d] = dict(r)
        else:
            for k, val in r.items():
                if val is not None:
                    merged_by_date[d][k] = val

    merged_rows = sorted(merged_by_date.values(), key=lambda x: x["date"])
    rows_used = len(merged_rows)

    date_range = None
    if merged_rows:
        date_range = {"start": merged_rows[0]["date"], "end": merged_rows[-1]["date"]}

    report = ImportReport(
        skipped_count=len(skipped_reasons),
        rows_read=rows_read,
        rows_used=rows_used,
        skipped_reasons=skipped_reasons,
        date_range=date_range,
        num_days=rows_used,
    )
    return merged_rows, report


# ---------------------------------------------------------------------------
# Demo data
# ---------------------------------------------------------------------------

def generate_demo_records() -> list[dict]:
    """Return 30 deterministic demo records ending today (seed=42)."""
    import random
    rng = random.Random(42)
    today = datetime.now(timezone.utc).date()
    records = []
    for i in range(29, -1, -1):
        d = today - timedelta(days=i)
        if i >= 9:  # first 21 days: healthy
            steps   = rng.randint(7500, 11000)
            sleep_h = round(rng.uniform(6.5, 8.5), 2)
            rhr     = rng.randint(58, 68)
            mood    = round(rng.uniform(3.5, 5.0), 1)
            water_l = round(rng.uniform(1.8, 2.8), 2)
        else:  # last 9 days: rough
            steps   = rng.randint(4000, 7000)
            sleep_h = round(rng.uniform(4.5, 6.5), 2)
            rhr     = rng.randint(68, 78)
            mood    = round(rng.uniform(2.0, 3.5), 1)
            water_l = round(rng.uniform(1.0, 2.0), 2)
        records.append({
            "date":    d.isoformat(),
            "steps":   steps,
            "sleep_h": sleep_h,
            "rhr":     rhr,
            "mood":    mood,
            "water_l": water_l,
            "sources": "demo",
        })
    return records


# ---------------------------------------------------------------------------
# Main Engine: compute_insights
# ---------------------------------------------------------------------------

def compute_insights(
    records: list[dict],
    step_goal: int = STEP_GOAL_DEFAULT,
    sleep_goal: float = SLEEP_GOAL_DEFAULT,
    heart_goal: int = HEART_GOAL_DEFAULT,
    mood_goal: float = MOOD_GOAL_DEFAULT,
    water_goal: float = WATER_GOAL_DEFAULT,
) -> dict:
    """Compute Orbit Score, Insights, Nudges, and Privacy Payload.
    
    All calculations delegated directly to metrics.compute_metrics for 100% consistency.
    """
    has_data = len(records) > 0
    if len(records) < 4:
        return {
            "score": 0,
            "score_parts": {"steps": 0, "sleep": 0, "heart": 0, "mood": 0, "consistency": 0},
            "band": "Drifting — gentle reset needed",
            "summary": "Not enough data yet. Keep tracking!",
            "insights": [{
                "id": "need_more_data",
                "category": "good_to_know",
                "metric": "steps",
                "icon": "Footprints",
                "severity": "info",
                "title": "Keep tracking to unlock insights",
                "body": "Add at least 4 days of data to generate insights.",
                "key_number": 0,
                "change": None,
                "change_kind": "percent",
                "evidence": {},
                "rule": "min_data",
            }],
            "nudges": [],
            "streak": 0,
            "headline": "Keep tracking to unlock your Orbit Score",
            "has_data": has_data,
            "metrics": metrics.compute_metrics(records, step_goal=step_goal, sleep_goal=sleep_goal),
            "payload": {},
        }

    m = metrics.compute_metrics(
        records=records,
        step_goal=step_goal,
        sleep_goal=sleep_goal,
        heart_goal=heart_goal,
        mood_goal=mood_goal,
        water_goal=water_goal,
    )

    # Generate structured insights
    insights = _build_structured_insights(m, records, step_goal, sleep_goal)

    # Generate nudges
    nudges = _build_nudges(m, step_goal, sleep_goal)

    # Privacy payload (aggregates only, no dates or raw rows)
    payload = {
        "avg_steps": m["metrics"]["steps"]["avg"],
        "avg_sleep_h": m["metrics"]["sleep"]["avg"],
        "avg_rhr": m["metrics"]["heart"]["avg"],
        "avg_mood": m["metrics"]["mood"]["avg"],
        "avg_water_l": m["metrics"]["water"]["avg"],
        "streak": m["streak"],
        "orbit_score": m["orbit_score"],
        "band": m["band"],
        "num_days": m["total_records"],
        "step_goal": step_goal,
        "sleep_goal": sleep_goal,
        "short_sleep_nights_last7": m["short_sleep_nights"],
        "hr_delta_7d": m["metrics"]["heart"]["change"],
        "steps_change_pct": m["metrics"]["steps"]["change"],
        "sleep_change_pct": m["metrics"]["sleep"]["change"],
    }

    # Headline and summary
    final_score = m["orbit_score"]
    band = m["band"]
    steps_avg_str = f"{m['metrics']['steps']['avg']:,}" if m['metrics']['steps']['avg'] is not None else "N/A"
    sleep_avg_str = f"{m['metrics']['sleep']['avg']}h" if m['metrics']['sleep']['avg'] is not None else "N/A"

    summary = (
        f"Orbit Score: {final_score}/100 ({band}). "
        f"Avg steps: {steps_avg_str}. Avg sleep: {sleep_avg_str}. "
        f"Streak: {m['streak']} days."
    )

    if final_score >= 80:
        headline = "You're crushing it — keep the momentum!"
    elif final_score >= 60:
        headline = "You're in a steady rhythm — small tweaks can boost you higher."
    else:
        headline = "Let's get back on track — one step at a time."

    return {
        "score": final_score,
        "score_parts": m["score_parts"],
        "band": band,
        "summary": summary,
        "headline": headline,
        "streak": m["streak"],
        "has_data": True,
        "window_a": m["window_a"],
        "window_b": m["window_b"],
        "metrics": m,
        "insights": insights,
        "nudges": nudges,
        "payload": payload,
    }


def _build_structured_insights(m: dict[str, Any], records: list[dict], step_goal: int, sleep_goal: float) -> list[dict[str, Any]]:
    """Build clear, grouped insights adhering to Phase 4 spec."""
    items: list[dict[str, Any]] = []

    m_steps = m["metrics"]["steps"]
    m_sleep = m["metrics"]["sleep"]
    m_heart = m["metrics"]["heart"]
    m_mood = m["metrics"]["mood"]
    m_water = m["metrics"]["water"]

    # 1. Steps insight
    if m_steps["avg"] is not None:
        chg = m_steps["change"]
        curr_str = f"{m_steps['avg']:,}"
        prior_str = f"{m_steps['prior_avg']:,}" if m_steps["prior_avg"] is not None else "N/A"
        category = "needs_attention" if (chg is not None and chg < 0) else "going_well"
        severity = "warn" if (chg is not None and chg < 0) else "good"
        direction = f"down {abs(chg)}%" if (chg is not None and chg < 0) else (f"up {chg}%" if chg else "steady")
        items.append({
            "id": "steps_trend",
            "category": category,
            "metric": "steps",
            "icon": "Footprints",
            "severity": severity,
            "title": f"Steps are {direction}",
            "body": f"{curr_str} a day, compared to {prior_str} last week.",
            "key_number": m_steps["avg"],
            "change": chg,
            "change_kind": "percent",
            "evidence": {
                "this_week_avg": m_steps["avg"],
                "prior_week_avg": m_steps["prior_avg"],
                "change_pct": f"{chg}%" if chg is not None else "0%",
                "goal": step_goal,
            },
            "rule": "steps_trend_7d",
        })

    # 2. Resting Heart Rate insight
    if m_heart["avg"] is not None:
        hr_chg = m_heart["change"]
        if hr_chg is not None and hr_chg >= 3:
            items.append({
                "id": "hr_rise",
                "category": "needs_attention",
                "metric": "heart",
                "icon": "Heart",
                "severity": "warn",
                "title": f"Resting heart rate is up {hr_chg} bpm",
                "body": f"{m_heart['avg']} now, {m_heart['prior_avg']} before. An easier day may help.",
                "key_number": m_heart["avg"],
                "change": hr_chg,
                "change_kind": "bpm",
                "evidence": {
                    "this_week_bpm": m_heart["avg"],
                    "prior_week_bpm": m_heart["prior_avg"],
                    "delta": hr_chg,
                },
                "rule": "hr_7d_rise",
            })
        elif hr_chg is not None and hr_chg <= -2:
            items.append({
                "id": "hr_rise",
                "category": "going_well",
                "metric": "heart",
                "icon": "Heart",
                "severity": "good",
                "title": f"Resting heart rate improved {abs(hr_chg)} bpm",
                "body": f"{m_heart['avg']} bpm this week vs {m_heart['prior_avg']} bpm previously.",
                "key_number": m_heart["avg"],
                "change": hr_chg,
                "change_kind": "bpm",
                "evidence": {
                    "this_week_bpm": m_heart["avg"],
                    "prior_week_bpm": m_heart["prior_avg"],
                    "delta": hr_chg,
                },
                "rule": "hr_7d_rise",
            })

    # 3. Sleep insight
    if m_sleep["avg"] is not None:
        short_nights = m["short_sleep_nights"]
        if short_nights >= 2:
            items.append({
                "id": "short_sleep_nights",
                "category": "needs_attention",
                "metric": "sleep",
                "icon": "Moon",
                "severity": "warn",
                "title": f"{short_nights} short sleep nights this week",
                "body": f"Averaging {m_sleep['avg']}h sleep with nights under 6h.",
                "key_number": m_sleep["avg"],
                "change": m_sleep["change"],
                "change_kind": "percent",
                "evidence": {
                    "short_nights": short_nights,
                    "avg_sleep": m_sleep["avg"],
                    "goal": sleep_goal,
                },
                "rule": "short_sleep_7d",
            })
        items.append({
            "id": "sleep_avg",
            "category": "going_well" if m_sleep["avg"] >= sleep_goal else "needs_attention",
            "metric": "sleep",
            "icon": "Moon",
            "severity": "good" if m_sleep["avg"] >= sleep_goal else "warn",
            "title": f"Average sleep is {m_sleep['avg']}h",
            "body": f"Target is {sleep_goal}h per night.",
            "key_number": m_sleep["avg"],
            "change": m_sleep["change"],
            "change_kind": "percent",
            "evidence": {
                "avg_sleep": m_sleep["avg"],
                "goal": sleep_goal,
            },
            "rule": "sleep_avg_vs_goal",
        })

    # 4. Streak insight
    items.append({
        "id": "goal_streak",
        "category": "going_well" if m["streak"] >= 3 else "good_to_know",
        "metric": "steps",
        "icon": "Flame",
        "severity": "good" if m["streak"] >= 3 else "info",
        "title": f"{m['streak']}-day goal streak active",
        "body": f"Consecutive days hitting your {step_goal:,} steps goal.",
        "key_number": m["streak"],
        "change": None,
        "change_kind": "none",
        "evidence": {
            "streak": m["streak"],
            "step_goal": step_goal,
        },
        "rule": "streak_consec",
    })

    # 5. Best day insight
    valid_step_recs = [r for r in records if r.get("steps") is not None]
    if valid_step_recs:
        best_r = max(valid_step_recs, key=lambda x: x["steps"])
        items.append({
            "id": "best_day",
            "category": "going_well",
            "metric": "steps",
            "icon": "Footprints",
            "severity": "good",
            "title": f"Best day: {best_r['date']}",
            "body": f"Your peak step count was {best_r['steps']:,} steps.",
            "key_number": best_r["steps"],
            "change": None,
            "change_kind": "none",
            "evidence": {
                "date": best_r["date"],
                "steps": best_r["steps"],
            },
            "rule": "best_day_steps",
        })

    # 6. Mood dip insight
    if m_mood["avg"] is not None and m_mood["change"] is not None and m_mood["change"] <= -10:
        items.append({
            "id": "mood_dip",
            "category": "needs_attention",
            "metric": "mood",
            "icon": "Smile",
            "severity": "warn",
            "title": f"Mood score dipped {abs(m_mood['change'])}%",
            "body": f"Averaging {m_mood['avg']}/5 compared to {m_mood['prior_avg']}/5 prior week.",
            "key_number": m_mood["avg"],
            "change": m_mood["change"],
            "change_kind": "percent",
            "evidence": {
                "this_week": m_mood["avg"],
                "prior_week": m_mood["prior_avg"],
            },
            "rule": "mood_7d_dip",
        })

    # 7. Orbit Score insight
    items.append({
        "id": "orbit_status",
        "category": "good_to_know",
        "metric": "steps",
        "icon": "Sparkles",
        "severity": "info",
        "title": f"Orbit Score is {m['orbit_score']}/100",
        "body": f"Status: '{m['band']}' across your 5 biomarkers.",
        "key_number": m["orbit_score"],
        "change": None,
        "change_kind": "none",
        "evidence": m["score_parts"],
        "rule": "orbit_score_parts",
    })

    # Group order: needs_attention (0), going_well (1), good_to_know (2)
    order = {"needs_attention": 0, "going_well": 1, "good_to_know": 2}
    items.sort(key=lambda x: order.get(x["category"], 3))
    return items[:6]


def _build_nudges(m: dict[str, Any], step_goal: int, sleep_goal: float) -> list[dict[str, Any]]:
    """Build timely, concrete, time-anchored nudges using metrics."""
    nudges = []
    anchor = m["anchor_date"] or datetime.now(timezone.utc).date().isoformat()

    steps_avg = m["metrics"]["steps"]["avg"]
    if steps_avg is not None and steps_avg < step_goal * 0.95:
        nudges.append({
            "id": f"steps_short_{anchor}",
            "text": f"Take a 10-minute walk at lunch to reach your {step_goal:,}-step goal.",
            "kind": "steps_short",
            "status": "pending",
            "snooze_until": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    sleep_avg = m["metrics"]["sleep"]["avg"]
    sleep_prior = m["metrics"]["sleep"]["prior_avg"]
    if m["short_sleep_nights"] >= 2 or (sleep_avg is not None and sleep_avg < sleep_goal):
        prior_str = f" vs {sleep_prior:.1f}h last week" if sleep_prior else ""
        avg_str = f"sleep has averaged {sleep_avg:.1f}h this week{prior_str}" if sleep_avg else f"{m['short_sleep_nights']} short sleep nights"
        nudges.append({
            "id": f"sleep_winddown_{anchor}",
            "text": f"Wind down 30 minutes earlier tonight ({avg_str}).",
            "kind": "sleep_winddown",
            "status": "pending",
            "snooze_until": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    hr_change = m["metrics"]["heart"]["change"]
    if hr_change is not None and hr_change >= 3:
        nudges.append({
            "id": f"hr_rest_{anchor}",
            "text": f"Take an easy recovery day today (resting heart rate is up {hr_change} bpm vs last week).",
            "kind": "hr_rest",
            "status": "pending",
            "snooze_until": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    water_avg = m["metrics"]["water"]["avg"]
    if water_avg is not None and water_avg < 2.5:
        nudges.append({
            "id": f"water_{anchor}",
            "text": f"Drink a glass of water now (you are at {water_avg:.1f} L vs 2.5 L goal).",
            "kind": "water",
            "status": "pending",
            "snooze_until": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    return nudges


# ---------------------------------------------------------------------------
# Ask / Intent Engine
# ---------------------------------------------------------------------------

_INTENT_PATTERNS: list[tuple[str, list[str]]] = [
    ("sleep",    [r"sleep", r"rest", r"insomnia", r"bed"]),
    ("steps",    [r"step", r"walk", r"active"]),
    ("heart",    [r"heart", r"\bhr\b", r"bpm", r"rhr", r"pulse"]),
    ("mood",     [r"mood", r"feel", r"emotion", r"happy", r"sad"]),
    ("water",    [r"water", r"hydrat", r"drink"]),
    ("best_day", [r"best day", r"most steps", r"peak"]),
    ("worst_day",[r"worst day", r"least steps", r"lowest"]),
    ("streak",   [r"streak", r"consecutive", r"row"]),
    ("goal",     [r"goal", r"target"]),
    ("compare",  [r"compar", r"vs", r"versus", r"week"]),
    ("score",    [r"score", r"orbit score", r"rating"]),
    ("privacy",  [r"privac", r"data", r"share", r"store"]),
    ("nudge",    [r"nudge", r"tip", r"suggestion", r"remind"]),
    ("help",     [r"help", r"what can", r"how", r"\?"]),
]


def _detect_intent(question: str) -> str:
    q = question.lower()
    for intent, patterns in _INTENT_PATTERNS:
        for pat in patterns:
            if re.search(pat, q):
                return intent
    return "fallback"


def ask(
    question: str,
    records: list[dict],
    step_goal: int = STEP_GOAL_DEFAULT,
    sleep_goal: float = SLEEP_GOAL_DEFAULT,
) -> dict:
    """Answer user questions using numbers computed by canonical metrics."""
    m = metrics.compute_metrics(records, step_goal=step_goal, sleep_goal=sleep_goal)
    intent = _detect_intent(question)

    followups = [
        "How is my sleep?",
        "How many steps today?",
        "What is my Orbit Score?",
        "Compare this week vs last week",
    ]

    if not m["has_data"]:
        return {
            "answer": "You don't have any health data loaded yet. Upload a CSV or load demo data in Settings to get started.",
            "intent": intent,
            "evidence": {},
            "rule": "no_data",
            "followups": followups,
        }

    m_steps = m["metrics"]["steps"]
    m_sleep = m["metrics"]["sleep"]
    m_heart = m["metrics"]["heart"]
    m_mood  = m["metrics"]["mood"]
    m_water = m["metrics"]["water"]

    if intent == "steps":
        avg_s = m_steps["avg"]
        chg_s = m_steps["change"]
        chg_text = f" ({chg_s:+}% vs prior week)" if chg_s is not None else ""
        return {
            "answer": f"Your 7-day average is {avg_s:,} steps per day{chg_text}. Your daily goal is {step_goal:,} steps ({m_steps['goal_pct']}% of goal).",
            "intent": "steps",
            "evidence": {
                "7d_avg_steps": avg_s,
                "prior_7d_avg": m_steps["prior_avg"],
                "change": f"{chg_s}%" if chg_s is not None else "N/A",
                "goal": step_goal,
            },
            "rule": "steps_7d_avg",
            "followups": followups,
        }

    if intent == "sleep":
        avg_sl = m_sleep["avg"]
        diff_min = m_sleep["diff_minutes"]
        diff_text = f" ({diff_min:+} minutes vs prior week)" if diff_min is not None else ""
        return {
            "answer": f"Your 7-day average sleep duration is {avg_sl:.1f} hours per night{diff_text}. You had {m['short_sleep_nights']} night(s) under 6 hours this week.",
            "intent": "sleep",
            "evidence": {
                "7d_avg_sleep": avg_sl,
                "prior_7d_avg": m_sleep["prior_avg"],
                "diff_minutes": diff_min,
                "short_nights": m["short_sleep_nights"],
                "goal": sleep_goal,
            },
            "rule": "sleep_7d_avg",
            "followups": followups,
        }

    if intent == "heart":
        avg_hr = m_heart["avg"]
        chg_hr = m_heart["change"]
        chg_text = f" ({chg_hr:+} bpm vs prior week)" if chg_hr is not None else ""
        return {
            "answer": f"Your 7-day resting heart rate is {avg_hr} bpm{chg_text}. Target resting baseline is {m_heart['goal']} bpm.",
            "intent": "heart",
            "evidence": {
                "7d_avg_rhr": avg_hr,
                "prior_7d_avg": m_heart["prior_avg"],
                "delta_bpm": chg_hr,
            },
            "rule": "rhr_7d_avg",
            "followups": followups,
        }

    if intent == "mood":
        avg_m = m_mood["avg"]
        chg_m = m_mood["change"]
        chg_text = f" ({chg_m:+}% vs prior week)" if chg_m is not None else ""
        return {
            "answer": f"Your 7-day average mood is {avg_m:.1f} out of 5{chg_text}.",
            "intent": "mood",
            "evidence": {
                "7d_avg_mood": avg_m,
                "prior_7d_avg": m_mood["prior_avg"],
                "change": chg_m,
            },
            "rule": "mood_7d_avg",
            "followups": followups,
        }

    if intent == "water":
        avg_w = m_water["avg"]
        chg_w = m_water["change"]
        chg_text = f" ({chg_w:+}% vs prior week)" if chg_w is not None else ""
        return {
            "answer": f"Your 7-day average water intake is {avg_w:.1f}L per day{chg_text}. Your target is {m_water['goal']}L.",
            "intent": "water",
            "evidence": {
                "7d_avg_water": avg_w,
                "prior_7d_avg": m_water["prior_avg"],
                "change": chg_w,
            },
            "rule": "water_7d_avg",
            "followups": followups,
        }

    if intent == "streak":
        return {
            "answer": f"You currently have a {m['streak']}-day goal streak reaching at least {step_goal:,} steps each day.",
            "intent": "streak",
            "evidence": {"streak": m["streak"], "step_goal": step_goal},
            "rule": "streak_consec",
            "followups": followups,
        }

    if intent == "score":
        return {
            "answer": f"Your Orbit Score is {m['orbit_score']}/100 ({m['band']}). {m['window_a']['label']}.",
            "intent": "score",
            "evidence": m["score_parts"],
            "rule": "orbit_score_parts",
            "followups": followups,
        }

    if intent == "compare":
        s_chg = m_steps["change"]
        sl_chg = m_sleep["change"]
        return {
            "answer": f"Week-over-week: steps are {'up' if s_chg and s_chg > 0 else 'down'} {abs(s_chg or 0)}% and sleep is {'up' if sl_chg and sl_chg > 0 else 'down'} {abs(sl_chg or 0)}%.",
            "intent": "compare",
            "evidence": {
                "steps_change": s_chg,
                "sleep_change": sl_chg,
                "heart_change": m_heart["change"],
            },
            "rule": "week_over_week_comparison",
            "followups": followups,
        }

    if intent == "privacy":
        return {
            "answer": "Privacy you can see: all data is stored exclusively on your device in SQLite. No raw biometric records ever leave without explicit preview and approval.",
            "intent": "privacy",
            "evidence": {"records_count": m["total_records"]},
            "rule": "privacy_guarantee",
            "followups": followups,
        }

    # Fallback response
    return {
        "answer": f"Orbit Score: {m['orbit_score']}/100 ({m['band']}). Steps: {m_steps['avg']:,} avg. Sleep: {m_sleep['avg']}h avg. Streak: {m['streak']} days.",
        "intent": "fallback",
        "evidence": {
            "score": m["orbit_score"],
            "steps_avg": m_steps["avg"],
            "sleep_avg": m_sleep["avg"],
            "streak": m["streak"],
        },
        "rule": "general_summary",
        "followups": followups,
    }
