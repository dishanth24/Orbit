"""FastAPI application entry point for Orbit."""
from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import db
import engine
from routers import health, records, demo, import_csv, insights, trends, ask, nudges, privacy, data, report


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    # Auto-seed demo data if DB is empty on startup, unless running unit tests (Phase 7 item 5)
    if not os.environ.get("PYTEST_CURRENT_TEST") and not os.environ.get("TESTING"):
        existing = db.get_all_records()
        if not existing:
            demo_recs = engine.generate_demo_records()
            for r in demo_recs:
                fields = {k: v for k, v in r.items() if k != "date"}
                db.upsert_record(r["date"], fields)
            db.upsert_setting("is_demo_data", "true")
    yield


app = FastAPI(title="Orbit API", version="3.0.0", lifespan=lifespan)

# CORS configuration supporting localhost, Vercel deployments, and environment overrides
origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
env_origins = os.environ.get("CORS_ORIGINS", "")
if env_origins:
    origins.extend([o.strip() for o in env_origins.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    from fastapi import HTTPException
    if isinstance(exc, HTTPException):
        return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})
    return JSONResponse(status_code=500, content={"error": "An unexpected error occurred. Please try again."})


# Routers
app.include_router(health.router,     prefix="/api")
app.include_router(records.router,    prefix="/api")
app.include_router(demo.router,       prefix="/api")
app.include_router(import_csv.router, prefix="/api")
app.include_router(insights.router,   prefix="/api")
app.include_router(trends.router,     prefix="/api")
app.include_router(ask.router,        prefix="/api")
app.include_router(nudges.router,     prefix="/api")
app.include_router(privacy.router,    prefix="/api")
app.include_router(data.router,       prefix="/api")
app.include_router(report.router,     prefix="/api")
