"""FastAPI application entry point."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from db import init_db
from routers import health, records, demo, import_csv, insights, trends, ask, nudges, privacy, data


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Orbit API", version="1.0.0", lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
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
