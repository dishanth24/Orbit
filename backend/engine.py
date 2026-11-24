"""Deterministic rules engine for Orbit."""
from __future__ import annotations

import csv
import io
import re
import uuid
from datetime import datetime, timezone, date, timedelta
from statistics import mean
from typing import Any

STEP_GOAL_DEFAULT = 8000
SLEEP_GOAL_DEFAULT = 7.0

# ---------------------------------------------------------------------------
# CSV parsing
# ---------------------------------------------------------------------------

_COL_ALIASES: dict[str, list[str]] = {
    "date":    ["date", "day", "timestamp"],
    "steps":   ["steps", "step_count"],
    "sleep_h": ["sleep", "sleep_hours", "hours_slept", "sleep_duration"],
    "rhr":     ["hr", "resting_hr", "rhr", "heart_rate"],
    "mood":    ["mood", "mood_score"],
    "water_l": ["water", "water_l"],
}


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


def _parse_date(val: str) -> str | None:
    """Parse YYYY-MM-DD or DD/MM/YYYY → YYYY-MM-DD. Returns None on failure."""
    val = val.strip()
    if re.match(r"^\d{4}-\d{2}-\d{2}$", val):
        return val
    m = re.match(r"^(\d{2})/(\d{2})/(\d{4})$", val)
    if m:
        return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    return None


def parse_csv(content: bytes, filename: str) -> tuple[list[dict], int]:
    """
    Parse a CSV byte string.
    Returns (rows: list[dict], skipped_count: int).
    """
    # Strip BOM
    if content.startswith(b"\xef\xbb\xbf"):
        content = content[3:]
    text = content.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        return [], 0

    mapping = _map_header(list(reader.fieldnames))
    rows: list[dict] = []
    skipped = 0

    for raw in reader:
        try:
            date_raw = raw.get(mapping.get("date", ""), "").strip()
            parsed_date = _parse_date(date_raw)
            if not parsed_date:
                skipped += 1
                continue

            row: dict[str, Any] = {"date": parsed_date}

            if "steps" in mapping:
                v = raw[mapping["steps"]].strip()
                if v:
                    row["steps"] = int(float(v))

            if "sleep_h" in mapping:
                v = raw[mapping["sleep_h"]].strip()
                if v:
                    sleep_val = float(v)
                    # If value looks like minutes (>24), convert to hours
                    if sleep_val > 24:
                        sleep_val = sleep_val / 60.0
                    row["sleep_h"] = round(sleep_val, 2)

            if "rhr" in mapping:
                v = raw[mapping["rhr"]].strip()
                if v:
                    row["rhr"] = int(float(v))

            if "mood" in mapping:
                v = raw[mapping["mood"]].strip()
                if v:
                    row["mood"] = float(v)

            if "water_l" in mapping:
                v = raw[mapping["water_l"]].strip()
                if v:
                    row["water_l"] = float(v)

            rows.append(row)
        except (ValueError, KeyError):
            skipped += 1

    return rows, skipped


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
# Insight + Nudge helpers
# ---------------------------------------------------------------------------

def _avg(values: list[float | int]) -> float | None:
    vals = [v for v in values if v is not None]
    return mean(vals) if vals else None


def _insight(id_: str, metric: str, severity: str, title: str, body: str,
             evidence: dict, rule: str) -> dict:
    return {"id": id_, "metric": metric, "severity": severity,
            "title": title, "body": body, "evidence": evidence, "rule": rule}


def _nudge(kind: str, text: str) -> dict:
    today = datetime.now(timezone.utc).date().isoformat()
    return {
        "id": f"{kind}_{today}",
        "text": text,
        "kind": kind,
        "status": "pending",
        "snooze_until": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Main engine
# ---------------------------------------------------------------------------

def compute_insights(records: list[dict], step_goal: int = STEP_GOAL_DEFAULT,
                     sleep_goal: float = SLEEP_GOAL_DEFAULT) -> dict:
    """Compute Orbit Score, insights, nudges, streak and privacy payload."""

    has_data = len(records) >= 1

    if len(records) < 4:
        return {
            "score": 0,
            "score_parts": {"steps": 0, "sleep": 0, "heart": 0, "mood": 0, "consistency": 0},
            "band": "Drifting — gentle reset needed",
            "summary": "Not enough data yet. Keep tracking!",
            "insights": [_insight("need_more_data", "general", "info",
                                  "Keep tracking!", "We need at least 4 days of data to generate insights.",
                                  {}, "min_data")],
            "nudges": [],
            "streak": 0,
            "headline": "Keep tracking to unlock your Orbit Score",
            "has_data": has_data,
            "payload": {},
        }

    sorted_recs = sorted(records, key=lambda r: r["date"])
    today = datetime.now(timezone.utc).date()

    # Streak: consecutive days up to today with steps >= step_goal
    streak = 0
    for i in range(len(sorted_recs) - 1, -1, -1):
        r = sorted_recs[i]
        expected_date = today - timedelta(days=streak)
        if r["date"] == expected_date.isoformat() and (r.get("steps") or 0) >= step_goal:
            streak += 1
        else:
            break

    last7  = sorted_recs[-7:]
    prior7 = sorted_recs[-14:-7] if len(sorted_recs) >= 14 else []

    # --- Score components ---
    steps_vals = [r["steps"] for r in sorted_recs if r.get("steps") is not None]
    avg_steps = _avg(steps_vals) or 0
    score_steps = min(1.0, avg_steps / step_goal)

    sleep_vals = [r["sleep_h"] for r in sorted_recs if r.get("sleep_h") is not None]
    avg_sleep = _avg(sleep_vals) or 0
    score_sleep = min(1.0, avg_sleep / sleep_goal)
    # Penalty for short nights in last 7
    short_nights_last7 = sum(1 for r in last7 if (r.get("sleep_h") or 99) < 6)
    score_sleep = max(0.0, score_sleep - 0.05 * short_nights_last7)

    # Heart
    hr_last7  = [r["rhr"] for r in last7  if r.get("rhr") is not None]
    hr_prior7 = [r["rhr"] for r in prior7 if r.get("rhr") is not None]
    hr_delta = 0.0
    if hr_last7 and hr_prior7:
        hr_delta = (_avg(hr_last7) or 0) - (_avg(hr_prior7) or 0)
        score_heart = max(0.0, 1.0 - (hr_delta / 10)) if hr_delta > 0 else 1.0
    else:
        score_heart = 0.75

    # Mood
    mood_vals = [r["mood"] for r in sorted_recs if r.get("mood") is not None]
    avg_mood = _avg(mood_vals) or 0
    score_mood = (avg_mood / 5.0) if mood_vals else 0.75

    # Consistency
    score_consistency = min(streak, 7) / 7.0

    final_score = round(
        score_steps * 30 + score_sleep * 30 + score_heart * 15 + score_mood * 15 + score_consistency * 10
    )
    final_score = max(0, min(100, final_score))

    if final_score >= 80:
        band = "In great orbit"
    elif final_score >= 60:
        band = "Steady orbit"
    else:
        band = "Drifting — gentle reset needed"

    # --- Build insights ---
    insights: list[dict] = []

    # 1. steps_trend
    steps_last7  = _avg([r["steps"] for r in last7  if r.get("steps") is not None])
    steps_prior7 = _avg([r["steps"] for r in prior7 if r.get("steps") is not None])
    if steps_last7 is not None:
        if steps_prior7 and steps_prior7 > 0:
            pct = (steps_last7 - steps_prior7) / steps_prior7 * 100
            body_text = f"Your average steps last 7 days is {steps_last7:,.0f} vs {steps_prior7:,.0f} the week before ({pct:+.1f}%)."
        else:
            pct = 0.0
            body_text = f"Your average steps last 7 days is {steps_last7:,.0f}."
        sev = "positive" if pct >= 0 else "warning"
        direction = "up" if pct >= 0 else "down"
        insights.append(_insight(
            "steps_trend", "steps", sev,
            f"Steps trending {direction}",
            body_text,
            {"last7_avg": round(steps_last7), "prior7_avg": round(steps_prior7 or 0), "pct_change": round(pct, 1)},
            "steps_trend_7d",
        ))

    # 2. sleep_avg
    if sleep_vals:
        sev = "positive" if avg_sleep >= sleep_goal else ("warning" if avg_sleep >= sleep_goal * 0.8 else "critical")
        insights.append(_insight(
            "sleep_avg", "sleep_h", sev,
            "Average sleep",
            f"Your average sleep is {avg_sleep:.1f}h vs your goal of {sleep_goal:.1f}h.",
            {"avg_sleep": round(avg_sleep, 2), "goal": sleep_goal},
            "sleep_avg_vs_goal",
        ))

    # 3. goal_streak
    insights.append(_insight(
        "goal_streak", "steps", "info",
        f"Step goal streak: {streak} day{'s' if streak != 1 else ''}",
        f"You've hit your step goal ({step_goal:,} steps) for {streak} consecutive day{'s' if streak != 1 else ''}.",
        {"streak": streak, "step_goal": step_goal},
        "streak_consec",
    ))

    # 4. short_sleep_nights
    if sleep_vals:
        sev = "critical" if short_nights_last7 >= 3 else ("warning" if short_nights_last7 >= 2 else "positive")
        insights.append(_insight(
            "short_sleep_nights", "sleep_h", sev,
            f"{short_nights_last7} short sleep night{'s' if short_nights_last7 != 1 else ''} this week",
            f"You had {short_nights_last7} night(s) under 6h in the last 7 days.",
            {"short_nights": short_nights_last7},
            "short_sleep_7d",
        ))

    # 5. sleep_steps_link
    short_night_dates = {r["date"] for r in last7 if (r.get("sleep_h") or 99) < 6}
    all_dates = sorted([r["date"] for r in sorted_recs])
    steps_after_short, steps_after_normal = [], []
    for idx, d in enumerate(all_dates[:-1]):
        next_day = all_dates[idx + 1]
        next_rec = next(r for r in sorted_recs if r["date"] == next_day)
        if next_rec.get("steps") is not None:
            if d in short_night_dates:
                steps_after_short.append(next_rec["steps"])
            else:
                steps_after_normal.append(next_rec["steps"])
    if steps_after_short and steps_after_normal:
        avg_short = _avg(steps_after_short) or 0
        avg_normal = _avg(steps_after_normal) or 0
        diff = avg_normal - avg_short
        insights.append(_insight(
            "sleep_steps_link", "sleep_h", "info",
            "Short sleep affects your steps",
            f"On days after short sleep you average {avg_short:,.0f} steps vs {avg_normal:,.0f} on normal nights (diff: {diff:+,.0f}).",
            {"avg_steps_after_short": round(avg_short), "avg_steps_after_normal": round(avg_normal)},
            "sleep_steps_correlation",
        ))

    # 6. hr_rise
    if hr_last7 and hr_prior7:
        avg_hr_last7  = _avg(hr_last7)  or 0
        avg_hr_prior7 = _avg(hr_prior7) or 0
        sev = "warning" if hr_delta >= 4 else "positive"
        insights.append(_insight(
            "hr_rise", "rhr", sev,
            "Resting heart rate trend",
            f"Avg HR last 7 days: {avg_hr_last7:.0f} bpm vs {avg_hr_prior7:.0f} bpm prior week (Δ{hr_delta:+.0f}).",
            {"last7_avg_hr": round(avg_hr_last7), "prior7_avg_hr": round(avg_hr_prior7), "delta": round(hr_delta, 1)},
            "hr_7d_rise",
        ))

    # 7. mood_dip
    if mood_vals:
        mood_last7  = _avg([r["mood"] for r in last7  if r.get("mood") is not None])
        mood_prior7 = _avg([r["mood"] for r in prior7 if r.get("mood") is not None])
        if mood_last7 is not None:
            diff_mood = (mood_last7 - (mood_prior7 or mood_last7))
            sev = "warning" if diff_mood < -0.5 else "positive"
            insights.append(_insight(
                "mood_dip", "mood", sev,
                "Mood this week",
                f"Average mood this week: {mood_last7:.1f}/5 vs {mood_prior7:.1f}/5 prior week." if mood_prior7 else f"Average mood: {mood_last7:.1f}/5.",
                {"mood_last7": round(mood_last7, 2), "mood_prior7": round(mood_prior7, 2) if mood_prior7 else None},
                "mood_7d_dip",
            ))

    # 8. best_day
    best_rec = max(sorted_recs, key=lambda r: r.get("steps") or 0)
    insights.append(_insight(
        "best_day", "steps", "positive",
        f"Best day: {best_rec['date']}",
        f"Your best step count was {(best_rec.get('steps') or 0):,} on {best_rec['date']}.",
        {"date": best_rec["date"], "steps": best_rec.get("steps") or 0},
        "best_day_steps",
    ))

    # --- Nudges ---
    nudges: list[dict] = []
    water_vals = [r["water_l"] for r in sorted_recs if r.get("water_l") is not None]
    avg_water = _avg(water_vals) or 0

    if avg_steps < step_goal * 0.9:
        nudges.append(_nudge("steps_short",
            f"You're averaging {avg_steps:,.0f} steps — a short walk could get you closer to your {step_goal:,} goal!"))
    if short_nights_last7 >= 2:
        nudges.append(_nudge("sleep_winddown",
            f"You've had {short_nights_last7} short sleep nights this week. Try a wind-down routine 30 min before bed."))
    if hr_delta >= 4:
        nudges.append(_nudge("hr_rest",
            f"Your resting HR is up {hr_delta:.0f} bpm. Consider an extra rest day or lighter activity."))
    if water_vals and avg_water < 2.0:
        nudges.append(_nudge("water",
            f"You're averaging {avg_water:.1f}L of water. Aim for 2L+ daily to feel your best."))

    # --- Summary + headline ---
    summary = (
        f"Orbit Score: {final_score}/100 ({band}). "
        f"Avg steps: {avg_steps:,.0f}. Avg sleep: {avg_sleep:.1f}h. "
        f"Streak: {streak} days."
    )
    if final_score >= 80:
        headline = "You're crushing it — keep the momentum! 🚀"
    elif final_score >= 60:
        headline = "You're in a steady rhythm — small tweaks can boost you higher."
    else:
        headline = "Let's get back on track — one step at a time. 💪"

    # --- Privacy payload (aggregates only, no dates/raw rows) ---
    payload: dict[str, Any] = {
        "avg_steps": round(avg_steps),
        "avg_sleep_h": round(avg_sleep, 2),
        "avg_rhr": round(_avg([r["rhr"] for r in sorted_recs if r.get("rhr") is not None]) or 0),
        "avg_mood": round(avg_mood, 2) if mood_vals else None,
        "avg_water_l": round(avg_water, 2) if water_vals else None,
        "streak": streak,
        "orbit_score": final_score,
        "band": band,
        "num_days": len(sorted_recs),
        "step_goal": step_goal,
        "sleep_goal": sleep_goal,
        "short_sleep_nights_last7": short_nights_last7,
        "hr_delta_7d": round(hr_delta, 1) if (hr_last7 and hr_prior7) else None,
    }

    return {
        "score": final_score,
        "score_parts": {
            "steps": round(score_steps * 30),
            "sleep": round(score_sleep * 30),
            "heart": round(score_heart * 15),
            "mood": round(score_mood * 15),
            "consistency": round(score_consistency * 10),
        },
        "band": band,
        "summary": summary,
        "insights": insights,
        "nudges": nudges,
        "streak": streak,
        "headline": headline,
        "has_data": has_data,
        "payload": payload,
    }


# ---------------------------------------------------------------------------
# Ask / intent router
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


def ask(question: str, records: list[dict],
        step_goal: int = STEP_GOAL_DEFAULT,
        sleep_goal: float = SLEEP_GOAL_DEFAULT) -> dict:
    """Intent-based Q&A over local records."""

    intent = _detect_intent(question)
    sorted_recs = sorted(records, key=lambda r: r["date"])

    # Aggregate helpers
    steps_vals  = [r["steps"]   for r in sorted_recs if r.get("steps")   is not None]
    sleep_vals  = [r["sleep_h"] for r in sorted_recs if r.get("sleep_h") is not None]
    hr_vals     = [r["rhr"]     for r in sorted_recs if r.get("rhr")     is not None]
    mood_vals   = [r["mood"]    for r in sorted_recs if r.get("mood")     is not None]
    water_vals  = [r["water_l"] for r in sorted_recs if r.get("water_l") is not None]

    avg_steps = _avg(steps_vals) or 0
    avg_sleep = _avg(sleep_vals) or 0
    avg_hr    = _avg(hr_vals)
    avg_mood  = _avg(mood_vals)
    avg_water = _avg(water_vals)

    best_rec  = max(sorted_recs, key=lambda r: r.get("steps") or 0) if sorted_recs else {}
    worst_rec = min(sorted_recs, key=lambda r: r.get("steps") or 0) if sorted_recs else {}

    last7  = sorted_recs[-7:]
    prior7 = sorted_recs[-14:-7] if len(sorted_recs) >= 14 else []

    evidence: dict[str, Any] = {}

    if intent == "sleep":
        answer = (
            f"Your average sleep is {avg_sleep:.1f}h against your goal of {sleep_goal:.1f}h. "
            + ("You're hitting your sleep target — great!" if avg_sleep >= sleep_goal
               else f"You're {sleep_goal - avg_sleep:.1f}h short on average.")
        )
        evidence = {"avg_sleep_h": round(avg_sleep, 2), "goal": sleep_goal, "num_nights": len(sleep_vals)}
        followups = ["How does my sleep affect my steps?", "How many short sleep nights did I have?", "What is my Orbit Score?"]

    elif intent == "steps":
        answer = (
            f"You're averaging {avg_steps:,.0f} steps/day. "
            + ("Above your goal — keep it up!" if avg_steps >= step_goal
               else f"That's {step_goal - avg_steps:,.0f} short of your {step_goal:,} goal.")
        )
        evidence = {"avg_steps": round(avg_steps), "step_goal": step_goal}
        followups = ["What is my step streak?", "What was my best day?", "How is my sleep affecting my steps?"]

    elif intent == "heart":
        if avg_hr:
            last7_hr  = _avg([r["rhr"] for r in last7  if r.get("rhr") is not None])
            prior7_hr = _avg([r["rhr"] for r in prior7 if r.get("rhr") is not None])
            delta = (last7_hr - prior7_hr) if (last7_hr and prior7_hr) else 0
            answer = (
                f"Your average resting HR is {avg_hr:.0f} bpm. "
                + (f"It's up {delta:.0f} bpm vs last week — consider more rest." if delta >= 4
                   else "Your HR looks stable.")
            )
            evidence = {"avg_rhr": round(avg_hr), "last7_avg": round(last7_hr or 0), "prior7_avg": round(prior7_hr or 0)}
        else:
            answer = "No heart rate data recorded yet."
            evidence = {}
        followups = ["Is my HR affecting my score?", "What is my Orbit Score?"]

    elif intent == "mood":
        if avg_mood:
            answer = f"Your average mood is {avg_mood:.1f}/5 over the last {len(mood_vals)} days."
            evidence = {"avg_mood": round(avg_mood, 2), "num_days": len(mood_vals)}
        else:
            answer = "No mood data recorded yet."
            evidence = {}
        followups = ["How is my mood trending?", "What is my Orbit Score?"]

    elif intent == "water":
        if avg_water:
            answer = (
                f"You're averaging {avg_water:.1f}L of water/day. "
                + ("Above 2L — well hydrated!" if avg_water >= 2.0 else "Aim for 2L+ for optimal hydration.")
            )
            evidence = {"avg_water_l": round(avg_water, 2)}
        else:
            answer = "No water data recorded yet."
            evidence = {}
        followups = ["What else should I improve?", "What is my Orbit Score?"]

    elif intent == "best_day":
        if best_rec:
            answer = f"Your best day was {best_rec.get('date')} with {(best_rec.get('steps') or 0):,} steps."
            evidence = {"date": best_rec.get("date"), "steps": best_rec.get("steps")}
        else:
            answer = "No data yet."
            evidence = {}
        followups = ["What was my worst day?", "How is my streak?"]

    elif intent == "worst_day":
        if worst_rec:
            answer = f"Your lowest step day was {worst_rec.get('date')} with {(worst_rec.get('steps') or 0):,} steps."
            evidence = {"date": worst_rec.get("date"), "steps": worst_rec.get("steps")}
        else:
            answer = "No data yet."
            evidence = {}
        followups = ["What was my best day?", "How can I improve?"]

    elif intent == "streak":
        # Recompute streak
        today = datetime.now(timezone.utc).date()
        streak = 0
        for i in range(len(sorted_recs) - 1, -1, -1):
            r = sorted_recs[i]
            expected = today - timedelta(days=streak)
            if r["date"] == expected.isoformat() and (r.get("steps") or 0) >= step_goal:
                streak += 1
            else:
                break
        answer = (f"Your current step goal streak is {streak} day{'s' if streak != 1 else ''}."
                  if streak else "No current streak. Hit your step goal today to start one!")
        evidence = {"streak": streak, "step_goal": step_goal}
        followups = ["What is my Orbit Score?", "What is my step average?"]

    elif intent == "goal":
        answer = f"Your step goal is {step_goal:,} steps/day and sleep goal is {sleep_goal:.1f}h/night."
        evidence = {"step_goal": step_goal, "sleep_goal": sleep_goal}
        followups = ["Am I hitting my step goal?", "Am I hitting my sleep goal?"]

    elif intent == "compare":
        s_last7  = _avg([r["steps"] for r in last7  if r.get("steps") is not None])
        s_prior7 = _avg([r["steps"] for r in prior7 if r.get("steps") is not None])
        if s_last7 and s_prior7:
            diff = s_last7 - s_prior7
            answer = (f"This week you averaged {s_last7:,.0f} steps vs {s_prior7:,.0f} last week "
                      f"({diff:+,.0f} steps, {diff/s_prior7*100:+.1f}%).")
            evidence = {"last7_avg": round(s_last7), "prior7_avg": round(s_prior7)}
        else:
            answer = "Not enough data to compare weeks yet."
            evidence = {}
        followups = ["What is my Orbit Score?", "How is my sleep trending?"]

    elif intent == "score":
        result = compute_insights(records, step_goal, sleep_goal)
        answer = f"Your Orbit Score is {result['score']}/100 — {result['band']}. {result['headline']}"
        evidence = {"score": result["score"], "band": result["band"]}
        followups = ["What can I improve?", "What is my step streak?"]

    elif intent == "privacy":
        answer = ("Your data is stored locally on your device in an SQLite database. "
                  "It is never sent anywhere without your explicit approval. "
                  "You can view the exact anonymised payload before sharing.")
        evidence = {}
        followups = ["What does the payload contain?", "How do I delete my data?"]

    elif intent == "nudge":
        result = compute_insights(records, step_goal, sleep_goal)
        nudge_texts = [n["text"] for n in result["nudges"]]
        if nudge_texts:
            answer = "Here are your current nudges:\n" + "\n".join(f"• {t}" for t in nudge_texts)
        else:
            answer = "No active nudges right now — you're doing great!"
        evidence = {"num_nudges": len(nudge_texts)}
        followups = ["What is my Orbit Score?", "How can I improve?"]

    elif intent == "help":
        answer = ("I can answer questions about your sleep, steps, heart rate, mood, water intake, "
                  "streaks, goals, week-on-week comparisons, your Orbit Score, nudges, and privacy. "
                  "Just ask!")
        evidence = {}
        followups = ["What is my Orbit Score?", "How am I doing this week?", "What was my best day?"]

    else:  # fallback
        answer = (
            "I didn't catch that, but here is what I can tell you: "
            f"You've logged {len(sorted_recs)} days. "
            f"Avg steps: {avg_steps:,.0f}. Avg sleep: {avg_sleep:.1f}h. "
            + (f"Avg mood: {avg_mood:.1f}/5." if avg_mood else "")
        )
        evidence = {
            "num_days": len(sorted_recs),
            "avg_steps": round(avg_steps),
            "avg_sleep_h": round(avg_sleep, 2),
        }
        followups = ["What is my Orbit Score?", "How am I doing this week?", "What was my best day?", "Help"]

    return {"answer": answer, "evidence": evidence, "intent": intent, "followups": followups}
