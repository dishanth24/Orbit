"""Comprehensive, deterministic metrics engine for Orbit.

This module is the SINGLE SOURCE OF TRUTH for all calculations across the app.
All numbers displayed on Today cards, orbs, hero, Insights, Ask answers,
Privacy payload, AI summary, Nudges, PDF and Excel reports MUST originate here.
"""
from __future__ import annotations

from datetime import datetime, timezone, date, timedelta
from statistics import mean
from typing import Any, Optional


def parse_date(d: str | date | datetime) -> date:
    """Parse string date (YYYY-MM-DD) to date object."""
    if isinstance(d, datetime):
        return d.date()
    if isinstance(d, date):
        return d
    return date.fromisoformat(d.strip())


def compute_metrics(
    records: list[dict[str, Any]],
    step_goal: int = 8000,
    sleep_goal: float = 7.0,
    heart_goal: int = 65,
    mood_goal: float = 4.0,
    water_goal: float = 2.5,
) -> dict[str, Any]:
    """Compute the single canonical metrics object for the app.
    
    Rules:
    - Anchor = the latest date that has data (not today's date), so old datasets work.
    - Window A = 7 calendar days ending at anchor (anchor - 6 to anchor).
    - Window B = 7 calendar days before Window A (anchor - 13 to anchor - 7).
    - Averages skip missing values (never treat missing as 0). Return n_days for each window.
    - If a window has fewer than 3 valid days for a metric, mark it 'insufficient'.
    - Change: steps, sleep, mood, water use percent change (A - B) / B * 100, rounded to whole number.
      (sleep also gives minute difference). Resting heart rate uses difference in bpm.
      If B is missing or 0, return no change.
    - Streak: consecutive calendar days ending at anchor with steps >= step_goal. Missing day breaks it.
    - Short sleep nights: nights under 6.0h inside Window A.
    - Orbit Score (0-100, clamped) from Window A values with score_parts using standard weights.
    """
    if not records:
        return _empty_metrics(step_goal, sleep_goal, heart_goal, mood_goal, water_goal)

    # Filter records with a valid date and map by date
    records_by_date: dict[date, dict[str, Any]] = {}
    for r in records:
        if not r.get("date"):
            continue
        try:
            d = parse_date(r["date"])
            records_by_date[d] = r
        except Exception:
            continue

    if not records_by_date:
        return _empty_metrics(step_goal, sleep_goal, heart_goal, mood_goal, water_goal)

    all_dates = sorted(records_by_date.keys())
    anchor_date = all_dates[-1]  # Latest date with data

    # Window A: 7 calendar days ending at anchor
    window_a_dates = [anchor_date - timedelta(days=6 - i) for i in range(7)]
    window_a_start = window_a_dates[0]
    window_a_end = window_a_dates[-1]

    # Window B: 7 calendar days prior to Window A
    window_b_dates = [anchor_date - timedelta(days=13 - i) for i in range(7)]
    window_b_start = window_b_dates[0]
    window_b_end = window_b_dates[-1]

    # Records in windows
    recs_a = [records_by_date[d] for d in window_a_dates if d in records_by_date]
    recs_b = [records_by_date[d] for d in window_b_dates if d in records_by_date]

    days_with_data_a = len(recs_a)
    days_with_data_b = len(recs_b)

    # 1. Metric: Steps
    steps_a = [r["steps"] for r in recs_a if r.get("steps") is not None]
    steps_b = [r["steps"] for r in recs_b if r.get("steps") is not None]
    m_steps = _calc_percent_metric(steps_a, steps_b, goal=step_goal, is_int=True)

    # 2. Metric: Sleep (hours)
    sleep_a = [r["sleep_h"] for r in recs_a if r.get("sleep_h") is not None]
    sleep_b = [r["sleep_h"] for r in recs_b if r.get("sleep_h") is not None]
    m_sleep = _calc_percent_metric(sleep_a, sleep_b, goal=sleep_goal, is_int=False, round_decimals=1)
    if m_sleep["avg"] is not None and m_sleep["prior_avg"] is not None:
        m_sleep["diff_minutes"] = round((m_sleep["avg"] - m_sleep["prior_avg"]) * 60)
    else:
        m_sleep["diff_minutes"] = None

    # 3. Metric: Resting Heart Rate (bpm)
    rhr_a = [r["rhr"] for r in recs_a if r.get("rhr") is not None]
    rhr_b = [r["rhr"] for r in recs_b if r.get("rhr") is not None]
    m_heart = _calc_bpm_metric(rhr_a, rhr_b, goal=heart_goal)

    # 4. Metric: Mood (1-5)
    mood_a = [r["mood"] for r in recs_a if r.get("mood") is not None]
    mood_b = [r["mood"] for r in recs_b if r.get("mood") is not None]
    m_mood = _calc_percent_metric(mood_a, mood_b, goal=mood_goal, is_int=False, round_decimals=1)

    # 5. Metric: Water (L)
    water_a = [r["water_l"] for r in recs_a if r.get("water_l") is not None]
    water_b = [r["water_l"] for r in recs_b if r.get("water_l") is not None]
    m_water = _calc_percent_metric(water_a, water_b, goal=water_goal, is_int=False, round_decimals=1)

    # Streak: consecutive days ending at anchor with steps >= step_goal. Missing day breaks it.
    streak = 0
    curr_d = anchor_date
    while True:
        r = records_by_date.get(curr_d)
        if r is None or r.get("steps") is None or r["steps"] < step_goal:
            break
        streak += 1
        curr_d = curr_d - timedelta(days=1)

    # Short sleep nights in Window A (< 6.0h)
    short_sleep_nights = sum(1 for r in recs_a if r.get("sleep_h") is not None and r["sleep_h"] < 6.0)

    # Orbit Score (0-100, clamped) computed from Window A values
    score_parts, orbit_score, band = _compute_score(
        m_steps=m_steps,
        m_sleep=m_sleep,
        m_heart=m_heart,
        m_mood=m_mood,
        streak=streak,
        short_sleep_nights=short_sleep_nights,
        step_goal=step_goal,
        sleep_goal=sleep_goal,
    )

    # Window A label (e.g. "19 to 25 Nov (7 of 7 days with data)")
    start_fmt = window_a_start.strftime("%d %b")
    end_fmt = window_a_end.strftime("%d %b")
    window_label = f"Based on 7 days: {start_fmt} to {end_fmt} ({days_with_data_a} of 7 days with data)"

    return {
        "has_data": True,
        "anchor_date": anchor_date.isoformat(),
        "window_a": {
            "start": window_a_start.isoformat(),
            "end": window_a_end.isoformat(),
            "days": 7,
            "days_with_data": days_with_data_a,
            "label": window_label,
            "formatted_range": f"{start_fmt} - {end_fmt}",
        },
        "window_b": {
            "start": window_b_start.isoformat(),
            "end": window_b_end.isoformat(),
            "days": 7,
            "days_with_data": days_with_data_b,
            "formatted_range": f"{window_b_start.strftime('%d %b')} - {window_b_end.strftime('%d %b')}",
        },
        "metrics": {
            "steps": m_steps,
            "sleep": m_sleep,
            "heart": m_heart,
            "mood": m_mood,
            "water": m_water,
        },
        "streak": streak,
        "short_sleep_nights": short_sleep_nights,
        "orbit_score": orbit_score,
        "score_parts": score_parts,
        "band": band,
        "total_records": len(records_by_date),
    }


def _calc_percent_metric(
    vals_a: list[float | int],
    vals_b: list[float | int],
    goal: float | int,
    is_int: bool = False,
    round_decimals: int = 1,
) -> dict[str, Any]:
    """Calculate metric with percentage change: (A - B) / B * 100."""
    n_a = len(vals_a)
    n_b = len(vals_b)
    insufficient = n_a < 3
    prior_insufficient = n_b < 3

    avg_a: Optional[float | int] = None
    if not insufficient:
        raw_avg = mean(vals_a)
        avg_a = round(raw_avg) if is_int else round(raw_avg, round_decimals)

    avg_b: Optional[float | int] = None
    if not prior_insufficient:
        raw_b = mean(vals_b)
        avg_b = round(raw_b) if is_int else round(raw_b, round_decimals)

    change: Optional[int] = None
    if avg_a is not None and avg_b is not None and avg_b != 0:
        change = round(((avg_a - avg_b) / avg_b) * 100)

    # Goal percentage
    goal_pct: Optional[int] = None
    if avg_a is not None and goal:
        goal_pct = round((avg_a / goal) * 100)

    return {
        "avg": avg_a,
        "prior_avg": avg_b,
        "change": change,
        "change_kind": "percent",
        "n": n_a,
        "n_prior": n_b,
        "insufficient": insufficient,
        "prior_insufficient": prior_insufficient,
        "goal": goal,
        "goal_pct": goal_pct,
    }


def _calc_bpm_metric(
    vals_a: list[int],
    vals_b: list[int],
    goal: int = 65,
) -> dict[str, Any]:
    """Calculate resting heart rate with difference in bpm (A - B)."""
    n_a = len(vals_a)
    n_b = len(vals_b)
    insufficient = n_a < 3
    prior_insufficient = n_b < 3

    avg_a: Optional[int] = None
    if not insufficient:
        avg_a = round(mean(vals_a))

    avg_b: Optional[int] = None
    if not prior_insufficient:
        avg_b = round(mean(vals_b))

    change: Optional[int] = None
    if avg_a is not None and avg_b is not None:
        change = round(avg_a - avg_b)

    goal_pct: Optional[int] = None
    if avg_a is not None and goal:
        goal_pct = round((avg_a / goal) * 100)

    return {
        "avg": avg_a,
        "prior_avg": avg_b,
        "change": change,
        "change_kind": "bpm",
        "n": n_a,
        "n_prior": n_b,
        "insufficient": insufficient,
        "prior_insufficient": prior_insufficient,
        "goal": goal,
        "goal_pct": goal_pct,
    }


def _compute_score(
    m_steps: dict[str, Any],
    m_sleep: dict[str, Any],
    m_heart: dict[str, Any],
    m_mood: dict[str, Any],
    streak: int,
    short_sleep_nights: int,
    step_goal: int,
    sleep_goal: float,
) -> tuple[dict[str, int], int, str]:
    """Calculate Orbit Score (0-100) and component weights:
    - Steps: 30 pts
    - Sleep: 30 pts (-5% per short sleep night)
    - Heart: 15 pts
    - Mood: 15 pts
    - Consistency: 10 pts
    """
    # 1. Steps (max 30)
    steps_avg = m_steps["avg"]
    if steps_avg is not None and step_goal > 0:
        score_steps_ratio = min(1.0, steps_avg / step_goal)
    else:
        score_steps_ratio = 0.0
    pts_steps = round(score_steps_ratio * 30)

    # 2. Sleep (max 30)
    sleep_avg = m_sleep["avg"]
    if sleep_avg is not None and sleep_goal > 0:
        score_sleep_ratio = min(1.0, sleep_avg / sleep_goal)
        # penalty: 0.05 per short sleep night (<6h in Window A)
        score_sleep_ratio = max(0.0, score_sleep_ratio - 0.05 * short_sleep_nights)
    else:
        score_sleep_ratio = 0.0
    pts_sleep = round(score_sleep_ratio * 30)

    # 3. Heart (max 15)
    heart_avg = m_heart["avg"]
    heart_change = m_heart["change"]
    if heart_avg is not None:
        if heart_change is not None:
            # HR delta = A - B; if HR went up, score decreases
            if heart_change > 0:
                pts_heart = round(max(0.0, 1.0 - (heart_change / 10.0)) * 15)
            else:
                pts_heart = 15
        else:
            # default baseline when prior week insufficient
            pts_heart = round(0.75 * 15)
    else:
        pts_heart = 0

    # 4. Mood (max 15)
    mood_avg = m_mood["avg"]
    if mood_avg is not None:
        pts_mood = round(min(1.0, mood_avg / 5.0) * 15)
    else:
        pts_mood = round(0.75 * 15)

    # 5. Consistency (max 10)
    pts_consistency = round((min(streak, 7) / 7.0) * 10)

    total_score = max(0, min(100, pts_steps + pts_sleep + pts_heart + pts_mood + pts_consistency))

    if total_score >= 80:
        band = "In great orbit"
    elif total_score >= 60:
        band = "Steady orbit"
    else:
        band = "Drifting — gentle reset needed"

    score_parts = {
        "steps": pts_steps,
        "sleep": pts_sleep,
        "heart": pts_heart,
        "mood": pts_mood,
        "consistency": pts_consistency,
    }

    return score_parts, total_score, band


def _empty_metrics(step_goal: int, sleep_goal: float, heart_goal: int, mood_goal: float, water_goal: float) -> dict[str, Any]:
    """Safe fallback when zero records exist."""
    empty_metric = {
        "avg": None,
        "prior_avg": None,
        "change": None,
        "change_kind": "percent",
        "n": 0,
        "n_prior": 0,
        "insufficient": True,
        "prior_insufficient": True,
        "goal": None,
        "goal_pct": None,
    }
    return {
        "has_data": False,
        "anchor_date": None,
        "window_a": {
            "start": None,
            "end": None,
            "days": 7,
            "days_with_data": 0,
            "label": "No data yet",
            "formatted_range": "No data",
        },
        "window_b": {
            "start": None,
            "end": None,
            "days": 7,
            "days_with_data": 0,
            "formatted_range": "No data",
        },
        "metrics": {
            "steps": dict(empty_metric, goal=step_goal),
            "sleep": dict(empty_metric, goal=sleep_goal, diff_minutes=None),
            "heart": dict(empty_metric, goal=heart_goal, change_kind="bpm"),
            "mood": dict(empty_metric, goal=mood_goal),
            "water": dict(empty_metric, goal=water_goal),
        },
        "streak": 0,
        "short_sleep_nights": 0,
        "orbit_score": 0,
        "score_parts": {
            "steps": 0,
            "sleep": 0,
            "heart": 0,
            "mood": 0,
            "consistency": 0,
        },
        "band": "Drifting — gentle reset needed",
        "total_records": 0,
    }
