from fastapi import APIRouter
import db
import engine

router = APIRouter()


def _save_nudges(nudges: list[dict]) -> None:
    with db.get_db() as conn:
        for n in nudges:
            conn.execute(
                """INSERT INTO nudges (id, text, kind, status, snooze_until, created_at)
                   VALUES (?, ?, ?, ?, ?, ?)
                   ON CONFLICT(id) DO UPDATE SET
                     text=excluded.text,
                     kind=excluded.kind,
                     created_at=excluded.created_at""",
                (n["id"], n["text"], n["kind"], n.get("status", "pending"),
                 n.get("snooze_until"), n.get("created_at")),
            )


@router.get("/insights")
def get_insights():
    step_goal  = int(db.get_setting("step_goal",  engine.STEP_GOAL_DEFAULT))
    sleep_goal = float(db.get_setting("sleep_goal", engine.SLEEP_GOAL_DEFAULT))
    records = db.get_all_records()
    result = engine.compute_insights(records, step_goal=step_goal, sleep_goal=sleep_goal)
    _save_nudges(result["nudges"])
    return result
