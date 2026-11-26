import json
from typing import List
from fastapi import APIRouter, UploadFile, File

import db
import engine

router = APIRouter()


@router.post("/import")
async def import_csv(files: List[UploadFile] = File(...)):
    # Rule 2: A real CSV upload must delete all demo rows.
    # Rule 3: Never delete real uploaded rows.
    had_only_demo = not db.has_real_records()
    db.delete_demo_records()
    if had_only_demo:
        with db.get_db() as conn:
            conn.execute("DELETE FROM nudges")
    db.upsert_setting("is_demo_data", "false")

    total_added = 0
    total_read = 0
    all_skipped_rows: list[dict] = []
    sources: list[str] = []
    earliest_date = None
    latest_date = None

    for f in files:
        content = await f.read()
        rows, report = engine.parse_csv(content, f.filename or "upload.csv")
        total_read += report.rows_read
        all_skipped_rows.extend(report.skipped_rows)
        source_name = (f.filename or "upload").replace(".csv", "")
        if source_name == "demo":
            source_name = "upload_demo"

        for row in rows:
            fields = {k: v for k, v in row.items() if k != "date"}
            existing_sources: list[str] = []
            with db.get_db() as conn:
                ex = conn.execute("SELECT sources FROM records WHERE date=?", (row["date"],)).fetchone()
                if ex and ex["sources"]:
                    existing_sources = [s for s in ex["sources"].split(",") if s != "demo"]
            if source_name not in existing_sources:
                existing_sources.append(source_name)
            fields["sources"] = ",".join(existing_sources)
            db.upsert_record(row["date"], fields)
            total_added += 1

            d = row["date"]
            if earliest_date is None or d < earliest_date:
                earliest_date = d
            if latest_date is None or d > latest_date:
                latest_date = d

        if rows:
            sources.append(source_name)

    all_records = db.get_all_records()
    date_range = {"start": earliest_date, "end": latest_date} if earliest_date else None

    import_summary = {
        "rows_read": total_read,
        "rows_used": total_added,
        "skipped_rows": all_skipped_rows,
        "skipped_count": len(all_skipped_rows),
        "date_range": date_range,
        "num_days": len(all_records),
        "days_added": total_added,
        "days_total": len(all_records),
        "sources": sources,
    }

    # Store last import report in settings for Settings page display
    try:
        db.upsert_setting("last_import_report", json.dumps(import_summary))
    except Exception:
        pass

    return import_summary


@router.get("/import/last-report")
def get_last_import_report():
    raw = db.get_setting("last_import_report")
    if raw:
        try:
            return json.loads(raw)
        except Exception:
            pass
    return None
