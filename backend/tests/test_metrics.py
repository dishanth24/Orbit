"""Hand-computed test suite for backend/metrics.py and engine integration.

Every test specifies exact mathematical hand-computed values in comments
to prove accuracy, robustness against edge cases, and cross-endpoint consistency.
"""
import pytest
from datetime import date, timedelta
from typing import Any

import metrics
import engine
from engine import parse_csv


# ---------------------------------------------------------------------------
# Test 1: 30-day realistic dataset with hand-computed values
# ---------------------------------------------------------------------------
def test_30_day_dataset_hand_computed():
    """Hand calculation:
    Dates: 2026-11-01 to 2026-11-30 (30 days total).
    Anchor: 2026-11-30.
    Window A (7 calendar days): 2026-11-24 to 2026-11-30.
      steps: 10,000 every day -> avg = 10,000
      sleep: 8.0 every day -> avg = 8.0
      heart: 64 bpm every day -> avg = 64
      mood: 4.5 every day -> avg = 4.5
      water: 2.5 L every day -> avg = 2.5
    Window B (7 calendar days prior): 2026-11-17 to 2026-11-23.
      steps: 8,000 every day -> avg = 8,000
      sleep: 7.0 every day -> avg = 7.0
      heart: 60 bpm every day -> avg = 60
      mood: 4.0 every day -> avg = 4.0
      water: 2.0 L every day -> avg = 2.0
    Expected changes:
      steps: (10000 - 8000) / 8000 * 100 = +25%
      sleep: (8.0 - 7.0) / 7.0 * 100 = +14% (14.28% -> 14)
      sleep diff_minutes: (8.0 - 7.0) * 60 = +60 minutes
      heart: 64 - 60 = +4 bpm (difference in bpm, not percent)
      mood: (4.5 - 4.0) / 4.0 * 100 = +12% or +13% (12.5% -> 12)
      water: (2.5 - 2.0) / 2.0 * 100 = +25%
      streak: 30 consecutive days >= 8000 -> 30
      short_sleep_nights: 0 (all nights 8.0h)
    """
    records = []
    base = date(2026, 11, 1)
    for i in range(30):
        d = base + timedelta(days=i)
        is_window_a = d >= date(2026, 11, 24)
        records.append({
            "date": d.isoformat(),
            "steps": 10000 if is_window_a else 8000,
            "sleep_h": 8.0 if is_window_a else 7.0,
            "rhr": 64 if is_window_a else 60,
            "mood": 4.5 if is_window_a else 4.0,
            "water_l": 2.5 if is_window_a else 2.0,
        })

    m = metrics.compute_metrics(records, step_goal=8000, sleep_goal=7.0)

    assert m["anchor_date"] == "2026-11-30"
    assert m["window_a"]["start"] == "2026-11-24"
    assert m["window_a"]["end"] == "2026-11-30"
    assert m["window_a"]["days_with_data"] == 7

    assert m["metrics"]["steps"]["avg"] == 10000
    assert m["metrics"]["steps"]["prior_avg"] == 8000
    assert m["metrics"]["steps"]["change"] == 25
    assert m["metrics"]["steps"]["goal_pct"] == 125

    assert m["metrics"]["sleep"]["avg"] == 8.0
    assert m["metrics"]["sleep"]["prior_avg"] == 7.0
    assert m["metrics"]["sleep"]["change"] == 14
    assert m["metrics"]["sleep"]["diff_minutes"] == 60

    assert m["metrics"]["heart"]["avg"] == 64
    assert m["metrics"]["heart"]["prior_avg"] == 60
    assert m["metrics"]["heart"]["change"] == 4
    assert m["metrics"]["heart"]["change_kind"] == "bpm"

    assert m["metrics"]["water"]["avg"] == 2.5
    assert m["metrics"]["water"]["prior_avg"] == 2.0
    assert m["metrics"]["water"]["change"] == 25

    assert m["streak"] == 30
    assert m["short_sleep_nights"] == 0
    assert m["orbit_score"] >= 80


# ---------------------------------------------------------------------------
# Test 2: 10-day set (prior window insufficient)
# ---------------------------------------------------------------------------
def test_10_day_prior_window_insufficient():
    """Hand calculation:
    Dates: 2026-11-01 to 2026-11-09 (9 consecutive days).
    Anchor: 2026-11-09.
    Window A (7 calendar days): 2026-11-03 to 2026-11-09 (7 days with data >= 3).
    Window B (7 calendar days prior): 2026-10-27 to 2026-11-02.
      Only 2026-11-01 and 2026-11-02 fall in Window B (2 days).
      Since 2 < 3, Window B is INSUFFICIENT.
    Expected:
      Window A avg is computed (e.g. 9000 steps).
      Window B prior_avg is None.
      change is None.
      prior_insufficient is True.
    """
    records = []
    base = date(2026, 11, 1)
    for i in range(9):
        d = base + timedelta(days=i)
        records.append({
            "date": d.isoformat(),
            "steps": 9000,
            "sleep_h": 7.5,
            "rhr": 62,
            "mood": 4.0,
            "water_l": 2.0,
        })

    m = metrics.compute_metrics(records)

    assert m["metrics"]["steps"]["insufficient"] is False
    assert m["metrics"]["steps"]["prior_insufficient"] is True
    assert m["metrics"]["steps"]["avg"] == 9000
    assert m["metrics"]["steps"]["prior_avg"] is None
    assert m["metrics"]["steps"]["change"] is None


# ---------------------------------------------------------------------------
# Test 3: Data with gaps (never treat missing days as 0)
# ---------------------------------------------------------------------------
def test_data_with_gaps_skips_missing_not_zero():
    """Hand calculation:
    Anchor: 2026-11-07.
    Window A (7 days: 2026-11-01 to 2026-11-07).
    Only 3 days have data:
      2026-11-01: 6,000 steps
      2026-11-04: 9,000 steps
      2026-11-07: 12,000 steps
    Missing days: 02, 03, 05, 06 (4 days missing).
    Averages MUST skip missing values, never treat as 0:
      Correct average = (6000 + 9000 + 12000) / 3 = 9,000 steps.
      (If missing were 0, average would be 27000 / 7 = 3857, which is WRONG).
    Streak:
      Anchor day (2026-11-07) has 12,000 >= 8000 goal.
      Previous day (2026-11-06) is missing -> streak BREAKS at 1!
    """
    records = [
        {"date": "2026-11-01", "steps": 6000, "sleep_h": 7.0, "rhr": 60, "mood": 4.0, "water_l": 2.0},
        {"date": "2026-11-04", "steps": 9000, "sleep_h": 7.0, "rhr": 60, "mood": 4.0, "water_l": 2.0},
        {"date": "2026-11-07", "steps": 12000, "sleep_h": 7.0, "rhr": 60, "mood": 4.0, "water_l": 2.0},
    ]

    m = metrics.compute_metrics(records, step_goal=8000)

    assert m["metrics"]["steps"]["avg"] == 9000
    assert m["metrics"]["steps"]["n"] == 3
    assert m["window_a"]["days_with_data"] == 3
    assert m["streak"] == 1


# ---------------------------------------------------------------------------
# Test 4: Duplicate dates in CSV are merged
# ---------------------------------------------------------------------------
def test_duplicate_dates_merge():
    """CSV with duplicate dates:
    Row 1: 2026-11-01, steps = 5000
    Row 2: 2026-11-01, sleep = 7.5
    Should merge into a single record for 2026-11-01 with both fields.
    """
    csv_text = "date,steps,sleep\n2026-11-01,5000,\n2026-11-01,,7.5\n"
    records, report = parse_csv(csv_text.encode("utf-8"))

    assert len(records) == 1
    assert records[0]["date"] == "2026-11-01"
    assert records[0]["steps"] == 5000
    assert records[0]["sleep_h"] == 7.5
    assert report.rows_read == 2
    assert report.rows_used == 1


# ---------------------------------------------------------------------------
# Test 5: DD/MM/YYYY date detection and parsing
# ---------------------------------------------------------------------------
def test_dd_mm_yyyy_format_detection():
    csv_text = "date,steps\n25/11/2026,8500\n26/11/2026,9000\n"
    records, report = parse_csv(csv_text.encode("utf-8"))

    assert len(records) == 2
    assert records[0]["date"] == "2026-11-25"
    assert records[1]["date"] == "2026-11-26"
    assert report.skipped_count == 0


# ---------------------------------------------------------------------------
# Test 6: Sleep in minutes (> 24) converted to hours
# ---------------------------------------------------------------------------
def test_sleep_in_minutes_converted():
    """480 minutes -> 8.0 hours.
    510 minutes -> 8.5 hours.
    """
    csv_text = "date,sleep_duration\n2026-11-01,480\n2026-11-02,510\n"
    records, _ = parse_csv(csv_text.encode("utf-8"))

    assert len(records) == 2
    assert records[0]["sleep_h"] == 8.0
    assert records[1]["sleep_h"] == 8.5


# ---------------------------------------------------------------------------
# Test 7: Dataset that ends months ago anchors on data, not today
# ---------------------------------------------------------------------------
def test_dataset_ending_months_ago():
    """Anchor MUST be latest date in data (2024-05-14), not today.
    Window A: 2024-05-08 to 2024-05-14.
    Window B: 2024-05-01 to 2024-05-07.
    """
    records = []
    base = date(2024, 5, 1)
    for i in range(14):
        d = base + timedelta(days=i)
        records.append({
            "date": d.isoformat(),
            "steps": 7000 if i < 7 else 9100,
            "sleep_h": 7.0,
            "rhr": 62,
            "mood": 4.0,
            "water_l": 2.0,
        })

    m = metrics.compute_metrics(records)

    assert m["anchor_date"] == "2024-05-14"
    assert m["window_a"]["start"] == "2024-05-08"
    assert m["window_a"]["end"] == "2024-05-14"
    assert m["metrics"]["steps"]["avg"] == 9100
    assert m["metrics"]["steps"]["prior_avg"] == 7000
    # change = (9100 - 7000) / 7000 * 100 = +30%
    assert m["metrics"]["steps"]["change"] == 30


# ---------------------------------------------------------------------------
# Test 8: 365-day dataset scalability and streak
# ---------------------------------------------------------------------------
def test_365_day_dataset():
    records = []
    base = date(2025, 1, 1)
    for i in range(365):
        d = base + timedelta(days=i)
        records.append({
            "date": d.isoformat(),
            "steps": 8500,
            "sleep_h": 7.2,
            "rhr": 60,
            "mood": 4.0,
            "water_l": 2.2,
        })

    m = metrics.compute_metrics(records, step_goal=8000)

    assert m["total_records"] == 365
    assert m["anchor_date"] == "2025-12-31"
    assert m["streak"] == 365
    assert m["metrics"]["steps"]["avg"] == 8500


# ---------------------------------------------------------------------------
# Test 9: Goal changes recompute streak, goal % and score
# ---------------------------------------------------------------------------
def test_goal_change_recomputes_streak_and_score():
    records = [
        {"date": f"2026-11-0{i}", "steps": 9000, "sleep_h": 7.0, "rhr": 62, "mood": 4.0, "water_l": 2.0}
        for i in range(1, 8)
    ]

    m_low = metrics.compute_metrics(records, step_goal=8000)
    assert m_low["streak"] == 7
    assert m_low["metrics"]["steps"]["goal_pct"] == round(9000 / 8000 * 100)

    # Raise goal to 10,000 (steps 9000 < 10000) -> streak drops to 0!
    m_high = metrics.compute_metrics(records, step_goal=10000)
    assert m_high["streak"] == 0
    assert m_high["metrics"]["steps"]["goal_pct"] == round(9000 / 10000 * 100)
    assert m_high["orbit_score"] < m_low["orbit_score"]


# ---------------------------------------------------------------------------
# Test 10: Resting heart rate change in bpm (not percent)
# ---------------------------------------------------------------------------
def test_heart_rate_change_in_bpm():
    """Window A HR = 72 bpm. Window B HR = 66 bpm.
    Expected change: 72 - 66 = +6 bpm.
    """
    records = []
    base = date(2026, 11, 1)
    for i in range(14):
        d = base + timedelta(days=i)
        records.append({
            "date": d.isoformat(),
            "steps": 8000,
            "sleep_h": 7.0,
            "rhr": 66 if i < 7 else 72,
            "mood": 4.0,
            "water_l": 2.0,
        })

    m = metrics.compute_metrics(records)

    assert m["metrics"]["heart"]["avg"] == 72
    assert m["metrics"]["heart"]["prior_avg"] == 66
    assert m["metrics"]["heart"]["change"] == 6
    assert m["metrics"]["heart"]["change_kind"] == "bpm"


# ---------------------------------------------------------------------------
# Test 11: Cross-endpoint equality assertion
# Assert that /insights, /privacy/payload, and /ask return identical numbers
# ---------------------------------------------------------------------------
def test_cross_endpoint_identical_numbers():
    records = []
    base = date(2026, 11, 1)
    for i in range(14):
        d = base + timedelta(days=i)
        records.append({
            "date": d.isoformat(),
            "steps": 8000 if i < 7 else 10000,
            "sleep_h": 6.8 if i < 7 else 7.5,
            "rhr": 65 if i < 7 else 61,
            "mood": 3.8 if i < 7 else 4.2,
            "water_l": 2.0 if i < 7 else 2.5,
        })

    # 1. Canonical metrics
    m = metrics.compute_metrics(records)

    # 2. Insights output
    ins = engine.compute_insights(records)

    # 3. Privacy payload
    payload = ins["payload"]

    # 4. Ask response for steps
    ask_steps = engine.ask("how many steps did I take", records)

    # 5. Ask response for sleep
    ask_sleep = engine.ask("how is my sleep", records)

    # Assert 100% equality
    # Steps
    assert ins["metrics"]["metrics"]["steps"]["avg"] == m["metrics"]["steps"]["avg"]
    assert payload["avg_steps"] == m["metrics"]["steps"]["avg"]
    assert ask_steps["evidence"]["7d_avg_steps"] == m["metrics"]["steps"]["avg"]

    # Sleep
    assert ins["metrics"]["metrics"]["sleep"]["avg"] == m["metrics"]["sleep"]["avg"]
    assert payload["avg_sleep_h"] == m["metrics"]["sleep"]["avg"]
    assert ask_sleep["evidence"]["7d_avg_sleep"] == m["metrics"]["sleep"]["avg"]

    # Heart
    assert ins["metrics"]["metrics"]["heart"]["avg"] == m["metrics"]["heart"]["avg"]
    assert payload["avg_rhr"] == m["metrics"]["heart"]["avg"]

    # Streak & Score
    assert ins["streak"] == m["streak"]
    assert payload["streak"] == m["streak"]
    assert ins["score"] == m["orbit_score"]
    assert payload["orbit_score"] == m["orbit_score"]
