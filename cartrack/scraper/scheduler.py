"""
CarTrack scrape scheduler.

Uses APScheduler to run all scrapers on a configurable interval.
Handles upsert logic, price-change tracking, and desktop alerts.
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.orm import Session

from models import (
    Alert,
    Listing,
    PriceHistory,
    SavedSearch,
    Settings,
    compute_fingerprint,
    engine,
)
from scrapers import AutoTraderScraper, EbayScraper, GumtreeScraper, MotorsScraper

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Hardcoded search matrix matching the user's target profile
# ---------------------------------------------------------------------------

SEARCH_MATRIX = [
    # BMW
    {"make": "BMW", "model": "1 SERIES", "fuel_type": "Petrol"},
    {"make": "BMW", "model": "1 SERIES", "fuel_type": "Diesel"},
    {"make": "BMW", "model": "3 SERIES", "fuel_type": "Petrol"},
    {"make": "BMW", "model": "3 SERIES", "fuel_type": "Diesel"},
    # Audi
    {"make": "Audi", "model": "A3", "fuel_type": "Petrol"},
    {"make": "Audi", "model": "A3", "fuel_type": "Diesel"},
    {"make": "Audi", "model": "A4", "fuel_type": "Petrol"},
    {"make": "Audi", "model": "A4", "fuel_type": "Diesel"},
    # CUPRA
    {"make": "CUPRA", "model": "FORMENTOR", "fuel_type": "Petrol"},
    {"make": "CUPRA", "model": "ATECA", "fuel_type": "Petrol"},
    # SEAT
    {"make": "SEAT", "model": "LEON", "fuel_type": "Petrol"},
    {"make": "SEAT", "model": "ATECA", "fuel_type": "Petrol"},
    # Mercedes-Benz
    {"make": "Mercedes-Benz", "model": "A CLASS", "fuel_type": "Petrol"},
    {"make": "Mercedes-Benz", "model": "C CLASS", "fuel_type": "Petrol"},
    {"make": "Mercedes-Benz", "model": "GLA CLASS", "fuel_type": "Petrol"},
    # Skoda
    {"make": "Skoda", "model": "OCTAVIA", "fuel_type": "Petrol"},
    {"make": "Skoda", "model": "OCTAVIA", "fuel_type": "Diesel"},
    # Toyota
    {"make": "Toyota", "model": "C-HR", "fuel_type": "Hybrid"},
    {"make": "Toyota", "model": "RAV4", "fuel_type": "Hybrid"},
    # Honda
    {"make": "Honda", "model": "CIVIC", "fuel_type": "Petrol"},
    {"make": "Honda", "model": "HR-V", "fuel_type": "Petrol"},
]

COMMON_FILTERS = {
    "price_min": 10000,
    "price_max": 20000,
    "year_from": 2018,
    "radius": 100,
    "max_pages": 3,
}


class ScrapeScheduler:
    """
    Manages the APScheduler job that periodically runs all scrapers.
    """

    def __init__(self):
        self._scheduler = AsyncIOScheduler(timezone="Europe/London")
        self._job = None
        self.last_run: Optional[datetime] = None
        self.next_run: Optional[datetime] = None
        self.is_running: bool = False
        self._current_task: Optional[asyncio.Task] = None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self, interval_minutes: int) -> None:
        """Start the scheduler with the given interval in minutes."""
        if self._job:
            self._job.remove()

        self._job = self._scheduler.add_job(
            self._run_job,
            trigger="interval",
            minutes=interval_minutes,
            id="scrape_all",
            next_run_time=datetime.now(timezone.utc),  # Run immediately on start
        )

        if not self._scheduler.running:
            self._scheduler.start()
            logger.info("Scheduler started — interval: %d minutes", interval_minutes)
        else:
            logger.info("Scheduler interval updated to %d minutes", interval_minutes)

        self._update_next_run()

    def stop(self) -> None:
        """Stop the scheduler and cancel any in-progress scrape."""
        if self._scheduler.running:
            self._scheduler.shutdown(wait=False)
        if self._current_task and not self._current_task.done():
            self._current_task.cancel()
        self.is_running = False
        logger.info("Scheduler stopped.")

    def restart(self, interval_minutes: int) -> None:
        """Restart the scheduler with a new interval."""
        self.stop()
        self._scheduler = AsyncIOScheduler(timezone="Europe/London")
        self.start(interval_minutes)

    # ------------------------------------------------------------------
    # Job execution
    # ------------------------------------------------------------------

    async def _run_job(self) -> None:
        """Wrapper called by APScheduler — delegates to run_all_scrapers."""
        if self.is_running:
            logger.warning("Previous scrape still running; skipping this tick.")
            return

        self.is_running = True
        self.last_run = datetime.now(timezone.utc)
        self._update_next_run()

        from sqlalchemy.orm import sessionmaker

        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        try:
            loop = asyncio.get_event_loop()
            self._current_task = loop.create_task(self.run_all_scrapers(db))
            await self._current_task
        except asyncio.CancelledError:
            logger.info("Scrape task was cancelled.")
        except Exception as exc:
            logger.exception("Scrape job failed: %s", exc)
        finally:
            db.close()
            self.is_running = False
            self._update_next_run()

    async def run_all_scrapers(self, db: Session) -> None:
        """
        Run all enabled scrapers for every search combination.
        """
        settings = db.query(Settings).filter(Settings.id == 1).first()
        if not settings:
            logger.error("No settings row found (id=1). Aborting scrape.")
            return

        postcode = settings.postcode or "BS7 8NE"
        max_results = settings.maxResultsPerSource or 50

        scrapers = []
        if settings.autotraderEnabled:
            scrapers.append(AutoTraderScraper())
        if settings.motorsEnabled:
            scrapers.append(MotorsScraper())
        if settings.gumtreeEnabled:
            scrapers.append(GumtreeScraper())
        if settings.ebayEnabled:
            scrapers.append(EbayScraper())

        if not scrapers:
            logger.info("All scrapers disabled; nothing to do.")
            return

        total_new = 0
        total_updated = 0

        for search in SEARCH_MATRIX:
            params = {
                **COMMON_FILTERS,
                **search,
                "postcode": postcode,
                "max_pages": max(1, min(3, max_results // 10)),
            }
            for scraper in scrapers:
                try:
                    logger.info(
                        "Running %s scraper for %s %s (%s)",
                        scraper.source,
                        search["make"],
                        search["model"],
                        search.get("fuel_type", "any"),
                    )
                    raw_listings = await scraper.scrape(params)
                    for raw in raw_listings:
                        is_new = upsert_listing(raw, db)
                        if is_new:
                            total_new += 1
                        else:
                            total_updated += 1
                    db.commit()
                except Exception as exc:
                    logger.exception(
                        "Error in %s scraper for %s %s: %s",
                        scraper.source,
                        search["make"],
                        search["model"],
                        exc,
                    )

        logger.info(
            "Scrape complete: %d new listings, %d updated", total_new, total_updated
        )

        # Check saved searches and fire alerts
        try:
            await check_alerts(db)
        except Exception as exc:
            logger.exception("Alert check failed: %s", exc)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _update_next_run(self) -> None:
        if self._job and self._scheduler.running:
            try:
                next_fire = self._job.next_run_time
                self.next_run = next_fire
            except Exception:
                self.next_run = None


# ---------------------------------------------------------------------------
# Upsert logic
# ---------------------------------------------------------------------------


def upsert_listing(listing_data: dict, db: Session) -> bool:
    """
    Insert or update a listing.

    Returns True if a new listing was created, False if an existing one was updated.
    """
    title = listing_data.get("title", "")
    year = listing_data.get("year") or 0
    mileage = listing_data.get("mileage")
    price = listing_data.get("price", 0)

    if not title or price <= 0:
        logger.debug("Skipping listing with empty title or zero price.")
        return False

    fingerprint = compute_fingerprint(title, year, mileage, price)
    now = datetime.now(timezone.utc)

    existing: Optional[Listing] = (
        db.query(Listing).filter(Listing.fingerprint == fingerprint).first()
    )

    if existing:
        # Update lastSeen
        existing.lastSeen = now  # type: ignore[assignment]
        existing.isActive = True  # type: ignore[assignment]

        # Check for price change
        if existing.price != price:
            logger.info(
                "Price change detected for '%s': £%d -> £%d",
                title,
                existing.price,
                price,
            )
            # Record the old price in history before updating
            history_entry = PriceHistory(
                id=str(uuid.uuid4()),
                listingId=existing.id,
                price=existing.price,  # record old price
                recordedAt=now,
            )
            db.add(history_entry)
            existing.price = price  # type: ignore[assignment]

        db.flush()
        return False

    else:
        # New listing
        listing_id = str(uuid.uuid4())
        new_listing = Listing(
            id=listing_id,
            title=title,
            make=listing_data.get("make", ""),
            model=listing_data.get("model", ""),
            trim=listing_data.get("trim"),
            year=year,
            price=price,
            mileage=mileage,
            fuelType=listing_data.get("fuelType"),
            transmission=listing_data.get("transmission"),
            colour=listing_data.get("colour"),
            engineSize=listing_data.get("engineSize"),
            sellerType=listing_data.get("sellerType", "dealer"),
            location=listing_data.get("location"),
            distance=listing_data.get("distance"),
            listingUrl=listing_data.get("listingUrl", ""),
            source=listing_data.get("source", ""),
            imageUrls=listing_data.get("imageUrls", "[]"),
            vin=listing_data.get("vin"),
            fingerprint=fingerprint,
            firstSeen=now,
            lastSeen=now,
            isActive=True,
        )

        # Validate required unique field
        if not new_listing.listingUrl:
            logger.debug("Skipping listing with no URL.")
            return False

        # Check URL uniqueness (belt-and-suspenders)
        url_exists = (
            db.query(Listing)
            .filter(Listing.listingUrl == new_listing.listingUrl)
            .first()
        )
        if url_exists:
            return False

        db.add(new_listing)

        # Initial price history entry
        history_entry = PriceHistory(
            id=str(uuid.uuid4()),
            listingId=listing_id,
            price=price,
            recordedAt=now,
        )
        db.add(history_entry)
        db.flush()

        logger.info("New listing: '%s' @ £%d from %s", title, price, new_listing.source)
        return True


# ---------------------------------------------------------------------------
# Alert checking
# ---------------------------------------------------------------------------


async def check_alerts(db: Session) -> None:
    """
    Match new listings against all SavedSearches and fire desktop notifications
    for any matches not yet alerted.
    """
    saved_searches = db.query(SavedSearch).filter(SavedSearch.desktopAlert == True).all()
    if not saved_searches:
        return

    # Get listings added in the last scrape window (last 2 hours as a safe window)
    from datetime import timedelta

    cutoff = datetime.now(timezone.utc) - timedelta(hours=2)
    recent_listings = (
        db.query(Listing)
        .filter(Listing.firstSeen >= cutoff, Listing.isActive == True)
        .all()
    )

    if not recent_listings:
        return

    for saved_search in saved_searches:
        try:
            filters = json.loads(saved_search.filters)
        except (json.JSONDecodeError, TypeError):
            continue

        for listing in recent_listings:
            if not _listing_matches_filters(listing, filters):
                continue

            # Check we haven't already alerted for this listing + search combo
            already_alerted = (
                db.query(Alert)
                .filter(
                    Alert.savedSearchId == saved_search.id,
                    Alert.listingId == listing.id,
                )
                .first()
            )
            if already_alerted:
                continue

            # Fire desktop notification
            _fire_desktop_notification(listing, saved_search)

            # Record alert
            alert = Alert(
                id=str(uuid.uuid4()),
                savedSearchId=saved_search.id,
                listingId=listing.id,
                sentAt=datetime.now(timezone.utc),
                type="desktop",
            )
            db.add(alert)

            # Increment newCount
            saved_search.newCount = (saved_search.newCount or 0) + 1

    db.commit()


def _listing_matches_filters(listing: Listing, filters: dict) -> bool:
    """Return True if a listing matches the given saved search filter dict."""
    if filters.get("make") and listing.make.upper() != filters["make"].upper():
        return False
    if filters.get("model") and listing.model.upper() != filters["model"].upper():
        return False
    if filters.get("transmission") and listing.transmission:
        if listing.transmission.lower() != filters["transmission"].lower():
            return False
    if filters.get("priceMax") and listing.price > filters["priceMax"]:
        return False
    if filters.get("priceMin") and listing.price < filters["priceMin"]:
        return False
    if filters.get("yearMin") and listing.year < filters["yearMin"]:
        return False
    if filters.get("yearMax") and listing.year > filters["yearMax"]:
        return False
    fuel_types = filters.get("fuelTypes") or filters.get("fuelType")
    if fuel_types:
        if isinstance(fuel_types, str):
            fuel_types = [fuel_types]
        if listing.fuelType:
            if not any(
                listing.fuelType.lower() == ft.lower() for ft in fuel_types
            ):
                return False
    return True


def _fire_desktop_notification(listing: Listing, saved_search: SavedSearch) -> None:
    """Attempt to show a desktop notification using plyer."""
    try:
        from plyer import notification

        notification.notify(
            title=f"CarTrack: New match for '{saved_search.name}'",
            message=f"{listing.title} — £{listing.price:,}\n{listing.location}",
            app_name="CarTrack",
            timeout=8,
        )
        logger.info(
            "Desktop notification fired for saved search '%s' — listing '%s'",
            saved_search.name,
            listing.title,
        )
    except Exception as exc:
        logger.debug("Desktop notification failed (plyer not available?): %s", exc)
