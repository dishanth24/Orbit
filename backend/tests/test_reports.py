"""Tests for PDF and Excel reports generation and endpoints."""
import io
import pytest
import openpyxl
from fastapi.testclient import TestClient

from main import app
import db
import engine
import metrics

client = TestClient(app)


@pytest.fixture(autouse=True)
def fresh_db(tmp_path, monkeypatch):
    """Isolate reports tests in a temporary database."""
    test_db = tmp_path / "test_orbit.db"
    monkeypatch.setattr(db, "DB_PATH", test_db)
    db.init_db()
    yield


def test_pdf_report_generation():
    """Verify GET /api/report/pdf returns 200, PDF content type, and valid non-empty PDF bytes."""
    # Ensure there is data
    client.post("/api/demo")
    response = client.get("/api/report/pdf")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert "attachment; filename=" in response.headers["content-disposition"]
    assert response.headers["content-disposition"].endswith('.pdf"')

    content = response.content
    assert len(content) > 1000
    # PDF starts with %PDF-
    assert content.startswith(b"%PDF-")


def test_xlsx_report_generation_and_numbers_match():
    """Verify GET /api/report/xlsx returns 200, Excel content type,
    opens with openpyxl, and its Summary numbers equal metrics.py.
    """
    client.post("/api/demo")
    response = client.get("/api/report/xlsx")

    assert response.status_code == 200
    assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in response.headers["content-type"]
    assert "attachment; filename=" in response.headers["content-disposition"]
    assert response.headers["content-disposition"].endswith('.xlsx"')

    content = response.content
    assert len(content) > 1000

    # Open with openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(content), data_only=False)
    sheet_names = wb.sheetnames
    assert "Summary" in sheet_names
    assert "Daily data" in sheet_names
    assert "Insights" in sheet_names
    assert "Privacy ledger" in sheet_names
    assert "Method" in sheet_names

    ws_summary = wb["Summary"]
    score_val = ws_summary["B4"].value
    records = db.get_all_records()
    step_goal = int(db.get_setting("step_goal", engine.STEP_GOAL_DEFAULT))
    sleep_goal = float(db.get_setting("sleep_goal", engine.SLEEP_GOAL_DEFAULT))
    m = metrics.compute_metrics(records, step_goal=step_goal, sleep_goal=sleep_goal)

    assert score_val == m["orbit_score"]

    # Daily data has records
    ws_daily = wb["Daily data"]
    assert ws_daily.max_row >= len(records)
