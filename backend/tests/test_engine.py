"""pytest tests for the Orbit backend engine + API endpoints."""
from __future__ import annotations

import os
import sys
from datetime import datetime, timezone, timedelta

import pytest

# Make sure backend is on the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import engine
from engine import parse_csv, generate_demo_records, compute_insights, ask


# ---------------------------------------------------------------------------
# 1. parse_csv – column aliases and conversions
# ---------------------------------------------------------------------------

def _csv(header: str, rows: list[str]) -> bytes:
    lines = [header] + rows
    return "\n".join(lines).encode()


class TestParseCSV:
    def test_steps_alias_step_count(self):
        data = _csv("date,step_count", ["2024-01-01,9000"])
        rows, skipped = parse_csv(data, "test.csv")
        assert len(rows) == 1
        assert rows[0]["steps"] == 9000
        assert skipped == 0

    def test_sleep_alias_sleep_hours(self):
        data = _csv("date,sleep_hours", ["2024-01-01,7.5"])
        rows, skipped = parse_csv(data, "test.csv")
        assert len(rows) == 1
        assert rows[0]["sleep_h"] == pytest.approx(7.5, abs=0.01)

    def test_sleep_minutes_conversion(self):
        # 480 minutes → 8.0 hours
        data = _csv("date,sleep_duration", ["2024-01-01,480"])
        rows, skipped = parse_csv(data, "test.csv")
        assert len(rows) == 1
        assert rows[0]["sleep_h"] == pytest.approx(8.0, abs=0.01)

    def test_dd_mm_yyyy_date(self):
        data = _csv("date,steps", ["25/12/2024,5000"])
        rows, skipped = parse_csv(data, "test.csv")
        assert len(rows) == 1
        assert rows[0]["date"] == "2024-12-25"

    def test_bom_stripping(self):
        raw = "\ufeffdate,steps\n2024-01-01,7000"
        data = raw.encode("utf-8-sig")
        rows, skipped = parse_csv(data, "test.csv")
        assert len(rows) == 1
        assert rows[0]["steps"] == 7000

    def test_bad_rows_skipped(self):
        data = _csv("date,steps", ["not-a-date,5000", "2024-01-02,bad", "2024-01-03,8000"])
        rows, skipped = parse_csv(data, "test.csv")
        # first row: bad date → skipped
        # second row: bad steps int → skipped
        # third row: good
        assert skipped >= 1
        good = [r for r in rows if r["date"] == "2024-01-03"]
        assert len(good) == 1

    def test_rhr_alias_heart_rate(self):
        data = _csv("date,heart_rate", ["2024-01-01,65"])
        rows, skipped = parse_csv(data, "test.csv")
        assert len(rows) == 1
        assert rows[0]["rhr"] == 65

    def test_water_alias(self):
        data = _csv("date,water", ["2024-01-01,2.5"])
        rows, skipped = parse_csv(data, "test.csv")
        assert rows[0]["water_l"] == pytest.approx(2.5, abs=0.01)


# ---------------------------------------------------------------------------
# Helpers to build synthetic record sets
# ---------------------------------------------------------------------------

def _make_records(n: int, steps=9000, sleep_h=7.5, rhr=62, mood=4.0, water_l=2.0) -> list[dict]:
    today = datetime.now(timezone.utc).date()
    return [
        {
            "date": (today - timedelta(days=n - 1 - i)).isoformat(),
            "steps": steps,
            "sleep_h": sleep_h,
            "rhr": rhr,
            "mood": mood,
            "water_l": water_l,
            "sources": "test",
        }
        for i in range(n)
    ]


# ---------------------------------------------------------------------------
# 2. Insight rules fire correctly
# ---------------------------------------------------------------------------

class TestInsightRules:
    def test_steps_trend_fires(self):
        # Build 14 records: last 7 have higher steps than prior 7
        today = datetime.now(timezone.utc).date()
        recs = []
        for i in range(13, 6, -1):   # prior 7: low steps
            recs.append({"date": (today - timedelta(days=i)).isoformat(),
                         "steps": 5000, "sleep_h": 7.0, "rhr": 62, "mood": 4.0, "water_l": 2.0})
        for i in range(6, -1, -1):   # last 7: high steps
            recs.append({"date": (today - timedelta(days=i)).isoformat(),
                         "steps": 10000, "sleep_h": 7.0, "rhr": 62, "mood": 4.0, "water_l": 2.0})
        result = compute_insights(recs)
        ids = [ins["id"] for ins in result["insights"]]
        assert "steps_trend" in ids

    def test_sleep_avg_fires(self):
        recs = _make_records(7, sleep_h=5.5)
        result = compute_insights(recs)
        ids = [ins["id"] for ins in result["insights"]]
        assert "sleep_avg" in ids

    def test_goal_streak_fires(self):
        recs = _make_records(7, steps=9000)  # above default goal 8000
        result = compute_insights(recs, step_goal=8000)
        ids = [ins["id"] for ins in result["insights"]]
        assert "goal_streak" in ids
        streak_insight = next(i for i in result["insights"] if i["id"] == "goal_streak")
        assert streak_insight["evidence"]["streak"] > 0

    def test_short_sleep_nights_fires(self):
        recs = _make_records(7, sleep_h=5.0)  # all nights under 6h
        result = compute_insights(recs)
        ids = [ins["id"] for ins in result["insights"]]
        assert "short_sleep_nights" in ids
        ins = next(i for i in result["insights"] if i["id"] == "short_sleep_nights")
        assert ins["evidence"]["short_nights"] == 7

    def test_hr_rise_fires(self):
        today = datetime.now(timezone.utc).date()
        recs = []
        for i in range(13, 6, -1):   # prior 7: low HR
            recs.append({"date": (today - timedelta(days=i)).isoformat(),
                         "steps": 8000, "sleep_h": 7.0, "rhr": 60, "mood": 4.0, "water_l": 2.0})
        for i in range(6, -1, -1):   # last 7: high HR (+8)
            recs.append({"date": (today - timedelta(days=i)).isoformat(),
                         "steps": 8000, "sleep_h": 7.0, "rhr": 68, "mood": 4.0, "water_l": 2.0})
        result = compute_insights(recs)
        ids = [ins["id"] for ins in result["insights"]]
        assert "hr_rise" in ids
        hr_ins = next(i for i in result["insights"] if i["id"] == "hr_rise")
        assert hr_ins["evidence"]["delta"] == pytest.approx(8, abs=1)

    def test_mood_dip_fires(self):
        today = datetime.now(timezone.utc).date()
        recs = []
        for i in range(13, 6, -1):
            recs.append({"date": (today - timedelta(days=i)).isoformat(),
                         "steps": 8000, "sleep_h": 7.0, "rhr": 62, "mood": 4.5, "water_l": 2.0})
        for i in range(6, -1, -1):
            recs.append({"date": (today - timedelta(days=i)).isoformat(),
                         "steps": 8000, "sleep_h": 7.0, "rhr": 62, "mood": 2.5, "water_l": 2.0})
        result = compute_insights(recs)
        ids = [ins["id"] for ins in result["insights"]]
        assert "mood_dip" in ids

    def test_best_day_fires(self):
        recs = _make_records(7)
        result = compute_insights(recs)
        ids = [ins["id"] for ins in result["insights"]]
        assert "best_day" in ids

    def test_need_more_data_with_few_records(self):
        recs = _make_records(2)
        result = compute_insights(recs)
        ids = [ins["id"] for ins in result["insights"]]
        assert "need_more_data" in ids
        assert result["has_data"] is True

    def test_need_more_data_with_zero_records(self):
        result = compute_insights([])
        assert result["has_data"] is False


# ---------------------------------------------------------------------------
# 3. Score always 0-100
# ---------------------------------------------------------------------------

class TestScoreBounds:
    def test_score_in_range_normal(self):
        recs = _make_records(10)
        result = compute_insights(recs)
        assert 0 <= result["score"] <= 100

    def test_score_in_range_extreme_low(self):
        recs = _make_records(10, steps=0, sleep_h=0, rhr=120, mood=1.0, water_l=0)
        result = compute_insights(recs)
        assert 0 <= result["score"] <= 100

    def test_score_in_range_extreme_high(self):
        recs = _make_records(10, steps=20000, sleep_h=10.0, rhr=40, mood=5.0, water_l=5.0)
        result = compute_insights(recs)
        assert 0 <= result["score"] <= 100

    def test_score_in_range_demo_data(self):
        recs = generate_demo_records()
        result = compute_insights(recs)
        assert 0 <= result["score"] <= 100


# ---------------------------------------------------------------------------
# 4. Privacy payload has no raw keys
# ---------------------------------------------------------------------------

class TestPrivacyPayload:
    def test_no_forbidden_keys(self):
        recs = generate_demo_records()
        result = compute_insights(recs)
        payload = result["payload"]
        forbidden = {"date", "dates", "rows", "records"}
        assert forbidden.isdisjoint(set(payload.keys())), (
            f"Forbidden keys found in payload: {forbidden & set(payload.keys())}"
        )

    def test_payload_has_aggregate_keys(self):
        recs = generate_demo_records()
        result = compute_insights(recs)
        payload = result["payload"]
        assert "avg_steps" in payload
        assert "orbit_score" in payload
        assert "num_days" in payload


# ---------------------------------------------------------------------------
# 5. ask() fallback returns non-empty answer
# ---------------------------------------------------------------------------

class TestAsk:
    def test_fallback_non_empty(self):
        recs = _make_records(7)
        result = ask("xyzzy magic unicorn", recs)
        assert result["intent"] == "fallback"
        assert len(result["answer"]) > 10

    def test_known_intent_sleep(self):
        recs = _make_records(7, sleep_h=6.0)
        result = ask("How is my sleep?", recs)
        assert result["intent"] == "sleep"
        assert "sleep" in result["answer"].lower()

    def test_known_intent_steps(self):
        recs = _make_records(7, steps=10000)
        result = ask("How many steps am I getting?", recs)
        assert result["intent"] == "steps"

    def test_followups_non_empty(self):
        recs = _make_records(7)
        result = ask("What is my score?", recs)
        assert len(result["followups"]) > 0

    def test_empty_records_fallback(self):
        result = ask("How am I doing?", [])
        assert result["answer"]  # non-empty


# ---------------------------------------------------------------------------
# 6. API endpoint tests (httpx TestClient)
# ---------------------------------------------------------------------------

class TestAPIEndpoints:
    @pytest.fixture(autouse=True)
    def fresh_db(self, tmp_path, monkeypatch):
        """Point DB at a temp file so tests are isolated."""
        import db as db_module
        test_db = tmp_path / "test_orbit.db"
        monkeypatch.setattr(db_module, "DB_PATH", test_db)
        db_module.init_db()
        yield

    @pytest.fixture
    def client(self):
        from fastapi.testclient import TestClient
        import main
        with TestClient(main.app) as c:
            yield c

    def test_health(self, client):
        r = client.get("/api/health")
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_records_empty(self, client):
        r = client.get("/api/records")
        assert r.status_code == 200
        data = r.json()
        assert data["records"] == []
        assert data["has_data"] is False

    def test_insights_empty(self, client):
        r = client.get("/api/insights")
        assert r.status_code == 200
        data = r.json()
        # With no data, has_data=False
        assert data["has_data"] is False

    def test_nudges_empty(self, client):
        r = client.get("/api/nudges")
        assert r.status_code == 200
        assert r.json() == []

    def test_demo_loads_data(self, client):
        r = client.post("/api/demo")
        assert r.status_code == 200
        data = r.json()
        assert data["days_added"] == 30

    def test_records_after_demo(self, client):
        client.post("/api/demo")
        r = client.get("/api/records?days=30")
        assert r.status_code == 200
        data = r.json()
        assert data["has_data"] is True
        assert len(data["records"]) > 0

    def test_insights_after_demo(self, client):
        client.post("/api/demo")
        r = client.get("/api/insights")
        assert r.status_code == 200
        data = r.json()
        assert 0 <= data["score"] <= 100

    def test_trends_empty(self, client):
        r = client.get("/api/trends?metric=steps&days=30")
        assert r.status_code == 200
        data = r.json()
        assert data["points"] == []

    def test_trends_bad_metric(self, client):
        r = client.get("/api/trends?metric=nonsense")
        assert r.status_code == 400

    def test_ask_endpoint(self, client):
        r = client.post("/api/ask", json={"question": "how are my steps?"})
        assert r.status_code == 200
        data = r.json()
        assert "answer" in data
        assert "intent" in data

    def test_settings_defaults(self, client):
        r = client.get("/api/settings")
        assert r.status_code == 200
        s = r.json()
        assert s["step_goal"] == 8000
        assert s["sleep_goal"] == pytest.approx(7.0, abs=0.01)

    def test_settings_update(self, client):
        r = client.put("/api/settings", json={"step_goal": 10000, "dark_theme": True})
        assert r.status_code == 200
        s = r.json()
        assert s["step_goal"] == 10000
        assert s["dark_theme"] is True

    def test_export(self, client):
        client.post("/api/demo")
        r = client.get("/api/export")
        assert r.status_code == 200
        assert "attachment" in r.headers.get("content-disposition", "")

    def test_delete_all(self, client):
        client.post("/api/demo")
        r = client.delete("/api/all")
        assert r.status_code == 200
        assert r.json()["ok"] is True
        # Records should be empty
        r2 = client.get("/api/records")
        assert r2.json()["records"] == []

    def test_privacy_payload_no_raw_keys(self, client):
        client.post("/api/demo")
        r = client.get("/api/privacy/payload")
        assert r.status_code == 200
        payload = r.json()
        forbidden = {"date", "dates", "rows", "records"}
        assert forbidden.isdisjoint(set(payload.keys()))

    def test_ai_summary_not_approved(self, client):
        r = client.post("/api/ai/summary", json={"approved": False})
        assert r.status_code == 403

    def test_ledger_empty(self, client):
        r = client.get("/api/ledger")
        assert r.status_code == 200
        assert r.json() == []

    def test_import_csv(self, client):
        csv_bytes = b"date,steps,sleep_hours\n2024-06-01,8500,7.2\n2024-06-02,9000,6.8\n"
        r = client.post(
            "/api/import",
            files=[("files", ("test.csv", csv_bytes, "text/csv"))],
        )
        assert r.status_code == 200
        data = r.json()
        assert data["days_added"] == 2
