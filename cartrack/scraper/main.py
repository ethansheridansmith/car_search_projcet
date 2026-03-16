"""
CarTrack Scraper API — FastAPI application.

Provides endpoints for controlling the scrape scheduler and managing settings.
Runs on port 8001 by default.
"""

import asyncio
import logging
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Optional

from dotenv import load_dotenv
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session, sessionmaker

from models import Settings, create_tables, engine, get_db
from scheduler import ScrapeScheduler, upsert_listing

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("cartrack.api")

# ---------------------------------------------------------------------------
# Global state
# ---------------------------------------------------------------------------

scheduler = ScrapeScheduler()

# Tracks the state of manually triggered scrape jobs
scrape_jobs: dict[str, dict[str, Any]] = {}


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: initialise DB and start the scheduler. Shutdown: stop it."""
    logger.info("CarTrack Scraper API starting up...")

    # Ensure tables exist
    create_tables()

    # Load (or create) default settings
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db: Session = SessionLocal()
    try:
        settings = db.query(Settings).filter(Settings.id == 1).first()
        if not settings:
            settings = Settings(
                id=1,
                postcode=os.getenv("DEFAULT_POSTCODE", "BS7 8NE"),
                scrapeIntervalMinutes=30,
                maxResultsPerSource=50,
            )
            db.add(settings)
            db.commit()
            db.refresh(settings)
            logger.info("Created default settings row.")

        interval = settings.scrapeIntervalMinutes or 30
        scheduler.start(interval)
        logger.info("Scheduler started with %d-minute interval.", interval)
    except Exception as exc:
        logger.exception("Startup error: %s", exc)
    finally:
        db.close()

    yield

    logger.info("CarTrack Scraper API shutting down...")
    scheduler.stop()


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="CarTrack Scraper",
    version="1.0.0",
    description="Background scraper and scheduler for the CarTrack dashboard.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class SettingsUpdate(BaseModel):
    postcode: Optional[str] = None
    scrapeIntervalMinutes: Optional[int] = None
    maxResultsPerSource: Optional[int] = None
    autotraderEnabled: Optional[bool] = None
    motorsEnabled: Optional[bool] = None
    gumtreeEnabled: Optional[bool] = None
    ebayEnabled: Optional[bool] = None
    emailEnabled: Optional[bool] = None
    smtpHost: Optional[str] = None
    smtpPort: Optional[int] = None
    smtpUser: Optional[str] = None
    smtpPass: Optional[str] = None
    alertEmail: Optional[str] = None


class SettingsResponse(BaseModel):
    id: int
    postcode: str
    scrapeIntervalMinutes: int
    maxResultsPerSource: int
    autotraderEnabled: bool
    motorsEnabled: bool
    gumtreeEnabled: bool
    ebayEnabled: bool
    emailEnabled: bool
    smtpHost: Optional[str]
    smtpPort: Optional[int]
    smtpUser: Optional[str]
    smtpPass: Optional[str]
    alertEmail: Optional[str]

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/health", tags=["System"])
async def health_check():
    """Simple health probe."""
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.get("/status", tags=["Scraper"])
async def get_status(db: Session = Depends(get_db)):
    """
    Return the current scraper state including listing counts.
    """
    from models import Listing

    total = db.query(Listing).count()
    active = db.query(Listing).filter(Listing.isActive == True).count()

    return {
        "isRunning": scheduler.is_running,
        "lastRun": scheduler.last_run.isoformat() if scheduler.last_run else None,
        "nextRun": scheduler.next_run.isoformat() if scheduler.next_run else None,
        "totalListings": total,
        "activeListings": active,
    }


async def _run_manual_scrape(job_id: str) -> None:
    """Background task that runs a full scrape and updates the job status dict."""
    scrape_jobs[job_id]["status"] = "running"
    scrape_jobs[job_id]["startedAt"] = datetime.now(timezone.utc).isoformat()

    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db: Session = SessionLocal()
    try:
        await scheduler.run_all_scrapers(db)
        scrape_jobs[job_id]["status"] = "completed"
        scrape_jobs[job_id]["completedAt"] = datetime.now(timezone.utc).isoformat()
        logger.info("Manual scrape job %s completed.", job_id)
    except asyncio.CancelledError:
        scrape_jobs[job_id]["status"] = "cancelled"
        logger.info("Manual scrape job %s was cancelled.", job_id)
    except Exception as exc:
        scrape_jobs[job_id]["status"] = "error"
        scrape_jobs[job_id]["error"] = str(exc)
        logger.exception("Manual scrape job %s failed: %s", job_id, exc)
    finally:
        db.close()


@app.post("/scrape", tags=["Scraper"])
async def trigger_scrape(background_tasks: BackgroundTasks):
    """
    Trigger an immediate scrape in the background.
    Returns a job ID that can be polled via GET /scrape/{job_id}.
    """
    if scheduler.is_running:
        raise HTTPException(
            status_code=409,
            detail="A scrape is already in progress.",
        )

    job_id = str(uuid.uuid4())
    scrape_jobs[job_id] = {
        "jobId": job_id,
        "status": "queued",
        "queuedAt": datetime.now(timezone.utc).isoformat(),
        "startedAt": None,
        "completedAt": None,
        "error": None,
    }
    background_tasks.add_task(_run_manual_scrape, job_id)
    return {"message": "Scrape started", "jobId": job_id}


@app.get("/scrape/{job_id}", tags=["Scraper"])
async def get_scrape_status(job_id: str):
    """Return the status of a previously triggered scrape job."""
    job = scrape_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    return job


@app.post("/scrape/stop", tags=["Scraper"])
async def stop_scrape():
    """
    Stop any currently running scrape.
    Note: Due to the nature of async scraping, this sends a cancellation
    signal; in-progress page requests may complete before stopping.
    """
    if not scheduler.is_running:
        return {"message": "No scrape is currently running."}
    scheduler.stop()
    # Restart the scheduler (without re-running immediately)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db: Session = SessionLocal()
    try:
        settings = db.query(Settings).filter(Settings.id == 1).first()
        interval = settings.scrapeIntervalMinutes if settings else 30
    finally:
        db.close()
    scheduler.start(interval)
    return {"message": "Scrape stopped. Scheduler restarted."}


@app.get("/settings", response_model=SettingsResponse, tags=["Settings"])
async def get_settings(db: Session = Depends(get_db)):
    """Return the current application settings."""
    settings = db.query(Settings).filter(Settings.id == 1).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found.")
    return settings


@app.put("/settings", response_model=SettingsResponse, tags=["Settings"])
async def update_settings(payload: SettingsUpdate, db: Session = Depends(get_db)):
    """
    Update application settings.
    If scrapeIntervalMinutes is changed, the scheduler is restarted with the new interval.
    """
    settings = db.query(Settings).filter(Settings.id == 1).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found.")

    interval_changed = False
    for field, value in payload.model_dump(exclude_none=True).items():
        if field == "scrapeIntervalMinutes" and value != settings.scrapeIntervalMinutes:
            interval_changed = True
        setattr(settings, field, value)

    db.commit()
    db.refresh(settings)

    if interval_changed:
        logger.info(
            "Scrape interval changed to %d minutes — restarting scheduler.",
            settings.scrapeIntervalMinutes,
        )
        scheduler.restart(settings.scrapeIntervalMinutes)

    return settings


# ---------------------------------------------------------------------------
# Entry point (for direct execution)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("SCRAPER_PORT", "8001"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
