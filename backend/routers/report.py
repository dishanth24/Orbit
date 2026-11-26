"""Report download endpoints for Orbit (PDF and Excel)."""
from __future__ import annotations

from datetime import date
from fastapi import APIRouter, Response

import db
import engine
import reports

router = APIRouter()


@router.get("/report/pdf")
def get_pdf_report():
    records = db.get_all_records()
    step_goal = int(db.get_setting("step_goal", engine.STEP_GOAL_DEFAULT))
    sleep_goal = float(db.get_setting("sleep_goal", engine.SLEEP_GOAL_DEFAULT))

    with db.get_db() as conn:
        ledger_rows = [dict(r) for r in conn.execute("SELECT * FROM ledger ORDER BY id DESC").fetchall()]

    pdf_bytes = reports.generate_pdf_report(
        records=records,
        step_goal=step_goal,
        sleep_goal=sleep_goal,
        ledger_rows=ledger_rows,
    )

    filename = f"orbit-report-{date.today().isoformat()}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.get("/report/xlsx")
def get_xlsx_report():
    records = db.get_all_records()
    step_goal = int(db.get_setting("step_goal", engine.STEP_GOAL_DEFAULT))
    sleep_goal = float(db.get_setting("sleep_goal", engine.SLEEP_GOAL_DEFAULT))

    with db.get_db() as conn:
        ledger_rows = [dict(r) for r in conn.execute("SELECT * FROM ledger ORDER BY id DESC").fetchall()]

    xlsx_bytes = reports.generate_xlsx_report(
        records=records,
        step_goal=step_goal,
        sleep_goal=sleep_goal,
        ledger_rows=ledger_rows,
    )

    filename = f"orbit-report-{date.today().isoformat()}.xlsx"
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )
