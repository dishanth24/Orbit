"""Database layer – SQLite3 (stdlib)."""
from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from datetime import datetime, timezone, date, timedelta
from typing import Any

DB_PATH = Path(__file__).parent / "orbit.db"

DDL = """
CREATE TABLE IF NOT EXISTS records (
  date TEXT PRIMARY KEY,
  steps INTEGER,
  sleep_h REAL,
  rhr INTEGER,
  mood REAL,
  water_l REAL,
  sources TEXT
);
CREATE TABLE IF NOT EXISTS nudges (
  id TEXT PRIMARY KEY,
  text TEXT,
  kind TEXT,
  status TEXT DEFAULT 'pending',
  snooze_until TEXT,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT,
  what TEXT,
  destination TEXT,
  approved INTEGER
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
"""


def init_db() -> None:
    """Create all tables (idempotent)."""
    with get_db() as conn:
        conn.executescript(DDL)


@contextmanager
def get_db():
    """Context manager that yields an open SQLite connection with row_factory."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def upsert_record(date_str: str, fields: dict[str, Any]) -> None:
    """Insert or update a record row. Only provided fields are written."""
    columns = ["steps", "sleep_h", "rhr", "mood", "water_l", "sources"]
    with get_db() as conn:
        # Try to fetch existing row
        row = conn.execute("SELECT * FROM records WHERE date=?", (date_str,)).fetchone()
        if row is None:
            # Build INSERT
            all_fields = {"date": date_str}
            all_fields.update({k: fields.get(k) for k in columns})
            cols = ", ".join(all_fields.keys())
            placeholders = ", ".join("?" for _ in all_fields)
            conn.execute(f"INSERT INTO records ({cols}) VALUES ({placeholders})", list(all_fields.values()))
        else:
            # Merge: only overwrite non-None incoming values
            existing = dict(row)
            for col in columns:
                if col in fields and fields[col] is not None:
                    existing[col] = fields[col]
            conn.execute(
                """UPDATE records SET steps=?, sleep_h=?, rhr=?, mood=?, water_l=?, sources=?
                   WHERE date=?""",
                [existing.get("steps"), existing.get("sleep_h"), existing.get("rhr"),
                 existing.get("mood"), existing.get("water_l"), existing.get("sources"),
                 date_str],
            )


def get_records(days: int = 30) -> list[dict]:
    """Return records for the last `days` days relative to latest anchor date, sorted ascending."""
    with get_db() as conn:
        max_row = conn.execute("SELECT MAX(date) as max_date FROM records").fetchone()
        if not max_row or not max_row["max_date"]:
            return []
        try:
            anchor = date.fromisoformat(max_row["max_date"])
        except Exception:
            return []
        cutoff = (anchor - timedelta(days=days - 1)).isoformat()
        rows = conn.execute(
            "SELECT * FROM records WHERE date >= ? AND date <= ? ORDER BY date ASC",
            (cutoff, max_row["max_date"]),
        ).fetchall()
    return [dict(r) for r in rows]


def get_all_records() -> list[dict]:
    """Return every record, sorted ascending."""
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM records ORDER BY date ASC").fetchall()
    return [dict(r) for r in rows]


def delete_demo_records() -> int:
    """Delete all records where sources == 'demo'. Never touches real data."""
    with get_db() as conn:
        cursor = conn.execute("DELETE FROM records WHERE sources = 'demo'")
        return cursor.rowcount


def has_real_records() -> bool:
    """Return True if any records exist with sources other than 'demo'."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT COUNT(*) as cnt FROM records WHERE sources != 'demo' OR sources IS NULL"
        ).fetchone()
        return bool(row and row["cnt"] > 0)


def upsert_setting(key: str, value: str) -> None:
    with get_db() as conn:
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (key, str(value)),
        )


def get_setting(key: str, default: Any = None) -> Any:
    with get_db() as conn:
        row = conn.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
    return row["value"] if row else default
