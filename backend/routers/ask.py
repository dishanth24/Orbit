from fastapi import APIRouter
from pydantic import BaseModel

import db
import engine

router = APIRouter()


class AskRequest(BaseModel):
    question: str


@router.post("/ask")
def ask_question(body: AskRequest):
    step_goal  = int(db.get_setting("step_goal",  engine.STEP_GOAL_DEFAULT))
    sleep_goal = float(db.get_setting("sleep_goal", engine.SLEEP_GOAL_DEFAULT))
    records = db.get_all_records()
    return engine.ask(body.question, records, step_goal=step_goal, sleep_goal=sleep_goal)
