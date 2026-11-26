"""Unit tests for data replacement rules:
1. Loading demo data must delete old demo rows first.
2. A real CSV upload must delete all demo rows.
3. Never delete real uploaded rows when doing either.
4. If real data exists, 'Load demo data' must not mix demo rows into it: block it with a clear message.
"""
from __future__ import annotations

import io
import pytest
from fastapi.testclient import TestClient

from main import app
import db


@pytest.fixture(autouse=True)
def fresh_db(tmp_path, monkeypatch):
    """Isolate each test in a temporary database."""
    test_db = tmp_path / "test_orbit.db"
    monkeypatch.setattr(db, "DB_PATH", test_db)
    db.init_db()
    yield


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_load_demo_deletes_old_demo_rows_first(client):
    """Rule 1: Loading demo data must delete old demo rows first."""
    # 1. Load initial demo data (30 records)
    r1 = client.post("/api/demo")
    assert r1.status_code == 200
    assert len(db.get_all_records()) == 30

    # 2. Simulate an older stale demo record from a previous session
    db.upsert_record("2026-01-01", {"steps": 8500, "sources": "demo"})
    assert len(db.get_all_records()) == 31

    # 3. Reload demo data
    r2 = client.post("/api/demo")
    assert r2.status_code == 200

    # 4. Old demo record should be gone; exactly 30 fresh demo records remain
    all_recs = db.get_all_records()
    assert len(all_recs) == 30
    assert not any(r["date"] == "2026-01-01" for r in all_recs)
    assert all(r["sources"] == "demo" for r in all_recs)


def test_real_csv_upload_deletes_all_demo_rows(client):
    """Rule 2: A real CSV upload must delete all demo rows."""
    # 1. Load initial demo data (30 records)
    client.post("/api/demo")
    assert len(db.get_all_records()) == 30

    # 2. Upload a real CSV with 3 rows
    csv_content = (
        "date,steps\n"
        "2026-11-20,9500\n"
        "2026-11-21,10200\n"
        "2026-11-22,8800\n"
    )
    files = [("files", ("my_phone_steps.csv", io.BytesIO(csv_content.encode()), "text/csv"))]
    r = client.post("/api/import", files=files)
    assert r.status_code == 200

    # 3. All 30 demo rows must be deleted; only the 3 real uploaded rows remain
    all_recs = db.get_all_records()
    assert len(all_recs) == 3
    dates = {r["date"] for r in all_recs}
    assert dates == {"2026-11-20", "2026-11-21", "2026-11-22"}
    # Verify no demo sources exist
    assert all("demo" not in (r["sources"] or "") for r in all_recs)
    assert all(r["sources"] == "my_phone_steps" for r in all_recs)


def test_never_delete_real_uploaded_rows_on_subsequent_upload(client):
    """Rule 3: Never delete real uploaded rows when uploading another CSV."""
    # 1. First upload: steps data for 3 days
    steps_csv = (
        "date,steps\n"
        "2026-11-20,9500\n"
        "2026-11-21,10200\n"
        "2026-11-22,8800\n"
    )
    files1 = [("files", ("steps.csv", io.BytesIO(steps_csv.encode()), "text/csv"))]
    r1 = client.post("/api/import", files=files1)
    assert r1.status_code == 200
    assert len(db.get_all_records()) == 3

    # 2. Second upload: sleep data for 2 days (one overlapping, one new)
    sleep_csv = (
        "date,sleep_h\n"
        "2026-11-20,7.5\n"
        "2026-11-23,8.0\n"
    )
    files2 = [("files", ("sleep.csv", io.BytesIO(sleep_csv.encode()), "text/csv"))]
    r2 = client.post("/api/import", files=files2)
    assert r2.status_code == 200

    # 3. All real records are preserved and merged (4 total days)
    all_recs = db.get_all_records()
    assert len(all_recs) == 4
    by_date = {r["date"]: r for r in all_recs}

    # 2026-11-22 had only steps: must still exist!
    assert by_date["2026-11-22"]["steps"] == 8800
    assert by_date["2026-11-22"]["sources"] == "steps"

    # 2026-11-20 had both: must be merged!
    assert by_date["2026-11-20"]["steps"] == 9500
    assert by_date["2026-11-20"]["sleep_h"] == 7.5
    assert "steps" in by_date["2026-11-20"]["sources"]
    assert "sleep" in by_date["2026-11-20"]["sources"]

    # 2026-11-23 had only sleep: must exist!
    assert by_date["2026-11-23"]["sleep_h"] == 8.0


def test_load_demo_blocked_when_real_data_exists(client):
    """Rule 4: If real data exists, 'Load demo data' must not mix demo rows into it:
    block it with a clear message.
    """
    # 1. Upload a real CSV file
    csv_content = (
        "date,steps\n"
        "2026-11-25,11000\n"
        "2026-11-26,12000\n"
    )
    files = [("files", ("real_steps.csv", io.BytesIO(csv_content.encode()), "text/csv"))]
    r_upload = client.post("/api/import", files=files)
    assert r_upload.status_code == 200
    assert len(db.get_all_records()) == 2

    # 2. Attempt to call POST /api/demo
    r_demo = client.post("/api/demo")

    # 3. Must be blocked with 400 Bad Request and clear error message
    assert r_demo.status_code == 400
    detail = r_demo.json().get("detail", "")
    assert "real" in detail.lower()
    assert "cannot load demo" in detail.lower() or "clear" in detail.lower()

    # 4. Verify no demo rows were mixed in: only the 2 real records remain
    all_recs = db.get_all_records()
    assert len(all_recs) == 2
    assert all(r["sources"] == "real_steps" for r in all_recs)
