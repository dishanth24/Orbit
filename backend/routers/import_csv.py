from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List

import db
import engine

router = APIRouter()


@router.post("/import")
async def import_csv(files: List[UploadFile] = File(...)):
    total_added = 0
    total_skipped = 0
    sources: list[str] = []

    for f in files:
        content = await f.read()
        rows, skipped = engine.parse_csv(content, f.filename or "upload.csv")
        total_skipped += skipped
        source_name = (f.filename or "upload").replace(".csv", "")
        for row in rows:
            fields = {k: v for k, v in row.items() if k != "date"}
            # Tag the source
            existing_sources: list[str] = []
            with db.get_db() as conn:
                ex = conn.execute("SELECT sources FROM records WHERE date=?", (row["date"],)).fetchone()
                if ex and ex["sources"]:
                    existing_sources = ex["sources"].split(",")
            if source_name not in existing_sources:
                existing_sources.append(source_name)
            fields["sources"] = ",".join(existing_sources)
            db.upsert_record(row["date"], fields)
            total_added += 1
        if rows:
            sources.append(source_name)

    all_records = db.get_all_records()

    return {
        "days_added": total_added,
        "days_total": len(all_records),
        "sources": sources,
        "skipped_rows": total_skipped,
    }
