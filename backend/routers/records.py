from fastapi import APIRouter, Query
from db import get_records as db_get_records

router = APIRouter()


@router.get("/records")
def get_records(days: int = Query(30, ge=1, le=3650)):
    rows = db_get_records(days=days)
    return {"records": rows, "has_data": len(rows) > 0}
