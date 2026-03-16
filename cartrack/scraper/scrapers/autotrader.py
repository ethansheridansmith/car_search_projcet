"""
AutoTrader UK scraper for CarTrack.

Navigates autotrader.co.uk search results using Playwright and extracts
listing data from up to 3 pages of results.
"""

import json
import logging
import re
from typing import Any, Optional
from urllib.parse import urlencode

from .base import BaseScraper

logger = logging.getLogger(__name__)

AUTOTRADER_BASE = "https://www.autotrader.co.uk/car-search"

# Current DOM: listing cards are <li data-testid="id-XXXXXXXXX">
# AutoTrader uses CSS modules so class names are hashed — we rely on
# data-testid prefixes and plain tag names instead.
CARD_SELECTOR = "li[data-testid^='id-']"
LINK_SELECTOR = "a[href*='/car-details/']"
NEXT_PAGE_SELECTOR = (
    "a[data-testid='pagination-next'], "
    "button[data-testid='pagination-next'], "
    "[aria-label='Next page'], "
    "a[aria-label='Next']"
)

# Known makes for title extraction
_KNOWN_MAKES_UPPER = [
    "BMW", "AUDI", "CUPRA", "SEAT", "MERCEDES-BENZ", "MERCEDES",
    "SKODA", "TOYOTA", "HONDA", "FORD", "VOLKSWAGEN", "VW",
    "VAUXHALL", "PEUGEOT", "RENAULT", "NISSAN", "HYUNDAI", "KIA",
    "MAZDA", "VOLVO", "LAND ROVER", "RANGE ROVER", "JAGUAR", "MINI",
]

# Lines to discard when parsing inner text
_NOISE_LINES = {
    "ad", "loading...", "save", "featured", "lower price",
    "great price", "good price", "fair price", "high price",
}


def _build_url(params: dict, page: int = 1) -> str:
    """Construct an AutoTrader search URL from the given parameters."""
    qs: dict[str, Any] = {
        "sort": "relevance",
        "page": page,
    }

    if params.get("make"):
        qs["make"] = params["make"].upper()
    if params.get("model"):
        qs["model"] = params["model"].upper()
    if params.get("price_min"):
        qs["price-from"] = params["price_min"]
    if params.get("price_max"):
        qs["price-to"] = params["price_max"]
    if params.get("year_from"):
        qs["year-from"] = params["year_from"]
    if params.get("year_to"):
        qs["year-to"] = params["year_to"]
    if params.get("transmission"):
        tx = params["transmission"].lower()
        qs["transmission"] = "automatic" if "auto" in tx else "manual"
    if params.get("fuel_type"):
        fuel_map = {
            "petrol": "Petrol",
            "diesel": "Diesel",
            "hybrid": "Hybrid - Petrol/Electric",
            "electric": "Electric",
        }
        qs["fuel-type"] = fuel_map.get(params["fuel_type"].lower(), params["fuel_type"])
    if params.get("postcode"):
        qs["postcode"] = params["postcode"]
    if params.get("radius"):
        qs["radius"] = params["radius"]
    else:
        qs["radius"] = 100

    return f"{AUTOTRADER_BASE}?{urlencode(qs)}"


class AutoTraderScraper(BaseScraper):
    """Scrapes car listings from autotrader.co.uk."""

    source = "autotrader"

    async def scrape(self, search_params: dict) -> list[dict]:
        """
        Execute a search on AutoTrader UK and return a list of listing dicts.
        Handles up to max_pages pages of results.
        """
        results: list[dict] = []
        max_pages = search_params.get("max_pages", 3)

        async with self.get_browser() as (browser, context):
            page = await self.new_page(context)

            first_url = _build_url(search_params, page=1)
            self.logger.info("AutoTrader: fetching page 1 — %s", first_url)
            ok = await self.safe_goto(page, first_url)
            if not ok:
                return results

            await self._dismiss_overlays(page)
            # Give JS time to hydrate the listing cards
            await page.wait_for_timeout(2000)

            for page_num in range(1, max_pages + 1):
                if page_num > 1:
                    url = _build_url(search_params, page=page_num)
                    self.logger.info("AutoTrader: fetching page %d — %s", page_num, url)
                    ok = await self.safe_goto(page, url)
                    if not ok:
                        break
                    await self._dismiss_overlays(page)
                    await page.wait_for_timeout(2000)

                page_listings = await self._extract_listings(page, search_params)
                self.logger.info(
                    "AutoTrader page %d: extracted %d listings",
                    page_num,
                    len(page_listings),
                )
                results.extend(page_listings)

                has_next = await self._has_next_page(page)
                if not has_next:
                    break

                await self.polite_delay(1.5, 3.5)

            await page.close()

        self.logger.info("AutoTrader scrape complete: %d total listings", len(results))
        return results

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    async def _dismiss_overlays(self, page) -> None:
        """Try to dismiss cookie banners and GDPR overlays."""
        cookie_selectors = [
            "button#onetrust-accept-btn-handler",
            "button[data-testid='cookie-accept-all']",
            "[aria-label='Accept cookies']",
            "button.cookie-consent-accept",
            "#consent-accept",
        ]
        for sel in cookie_selectors:
            try:
                btn = await page.query_selector(sel)
                if btn and await btn.is_visible():
                    await btn.click()
                    await page.wait_for_timeout(800)
                    break
            except Exception:
                pass

    async def _extract_listings(self, page, search_params: dict = {}) -> list[dict]:
        """Extract all listing cards from the current page."""
        listings: list[dict] = []

        cards = await page.query_selector_all(CARD_SELECTOR)

        if not cards:
            self.logger.debug("No cards found with primary selector — trying fallback")
            cards = await page.query_selector_all("li[data-testid]")

        self.logger.debug("Found %d card elements on page", len(cards))

        for card in cards:
            try:
                listing = await self._parse_card(card, page, search_params)
                if listing and listing.get("listingUrl") and listing.get("price", 0) > 0:
                    listings.append(listing)
            except Exception as exc:
                self.logger.debug("Failed to parse card: %s", exc)
                continue

        return listings

    async def _parse_card(self, card, page, search_params: dict = {}) -> Optional[dict]:
        """Parse a single listing card element into a dict using text-based parsing."""
        listing: dict = {"source": self.source}

        # --- URL ---
        link_el = await card.query_selector(LINK_SELECTOR)
        if not link_el:
            link_el = await card.query_selector("a[href*='car-details']")
        if not link_el:
            return None

        href = await link_el.get_attribute("href") or ""
        if href.startswith("/"):
            href = f"https://www.autotrader.co.uk{href}"
        # Strip tracking query params — keep just the canonical listing URL
        listing["listingUrl"] = href.split("?")[0] if "?" in href else href

        # --- Image ---
        img_el = await card.query_selector("img[src]")
        if img_el:
            src = await img_el.get_attribute("src") or ""
            # Upgrade thumbnail to a larger size
            src = re.sub(r"/w\d+/", "/w800/", src)
            listing["imageUrls"] = json.dumps([src]) if src else json.dumps([])
        else:
            listing["imageUrls"] = json.dumps([])

        # --- Seller type ---
        card_html = await card.inner_html()
        listing["sellerType"] = "private" if "private seller" in card_html.lower() else "dealer"

        # --- Parse all text lines from the card ---
        full_text = await card.inner_text()
        lines = [ln.strip() for ln in full_text.split("\n") if ln.strip()]
        # Remove noise lines and image counter patterns like "1/37"
        lines = [
            ln for ln in lines
            if ln.lower() not in _NOISE_LINES
            and not re.match(r"^\d+/\d+$", ln)
        ]

        # Title: first line that contains a known make
        title = ""
        for ln in lines:
            if any(mk in ln.upper() for mk in _KNOWN_MAKES_UPPER):
                title = ln
                break
        if not title and lines:
            title = lines[0]
        listing["title"] = title

        # Price: find a £N,NNN pattern (min 3 digits) — avoid picking up
        # engine sizes like "1.5" that appear before a £ sign in subtitle lines
        listing["price"] = 0
        for ln in lines:
            m = re.search(r"£([\d,]+)", ln)
            if m:
                try:
                    price = int(m.group(1).replace(",", ""))
                    if price >= 500:
                        listing["price"] = price
                        break
                except ValueError:
                    pass

        # Specs: iterate all lines
        listing["year"] = None
        listing["mileage"] = None
        listing["fuelType"] = None
        listing["transmission"] = None
        listing["engineSize"] = None
        listing["colour"] = None
        listing["location"] = ""

        for ln in lines:
            ln_lower = ln.lower()

            # Year — "2021 (21 reg)" or bare "2021"
            if listing["year"] is None:
                yr = self.parse_year(ln)
                if yr:
                    listing["year"] = yr

            # Mileage
            if listing["mileage"] is None and re.search(r"\d[\d,]*\s*miles?", ln_lower):
                listing["mileage"] = self.parse_mileage(ln)

            # Fuel type
            if listing["fuelType"] is None:
                for fuel in ("petrol", "diesel", "hybrid", "electric", "plug-in"):
                    if fuel in ln_lower:
                        listing["fuelType"] = fuel.replace("plug-in", "Plug-In Hybrid").title()
                        break

            # Transmission
            if listing["transmission"] is None:
                if "automatic" in ln_lower:
                    listing["transmission"] = "Automatic"
                elif "manual" in ln_lower and "miles" not in ln_lower:
                    listing["transmission"] = "Manual"

            # Engine size  e.g. "1.5L" or "2.0 L"
            if listing["engineSize"] is None:
                m = re.search(r"\d\.\d\s*l\b", ln_lower)
                if m:
                    listing["engineSize"] = m.group().replace(" ", "").upper()

            # Location — "Can be moved to X miles away" or "X miles away"
            if not listing["location"]:
                dist_m = re.search(r"(\d+)\s*miles\s*away", ln_lower)
                if dist_m:
                    listing["location"] = ln
                    listing["distance"] = int(dist_m.group(1))

        # Fall back to search-param values for specs not on the card
        if listing["fuelType"] is None and search_params.get("fuel_type"):
            fuel = search_params["fuel_type"].lower()
            listing["fuelType"] = {
                "petrol": "Petrol", "diesel": "Diesel",
                "hybrid": "Hybrid", "electric": "Electric",
            }.get(fuel, search_params["fuel_type"].title())
        if listing["transmission"] is None and search_params.get("transmission"):
            listing["transmission"] = search_params["transmission"].title()

        # Make / model from title
        make, model = self._parse_make_model(listing.get("title", ""))
        listing["make"] = make
        listing["model"] = model

        return listing

    @staticmethod
    def _parse_make_model(title: str) -> tuple[str, str]:
        """
        Attempt to extract make and model from the listing title.
        Returns ("", "") if extraction fails.
        """
        known_makes = [
            "BMW", "Audi", "CUPRA", "SEAT", "Mercedes-Benz", "Mercedes",
            "Skoda", "Toyota", "Honda", "Ford", "Volkswagen", "VW",
            "Vauxhall", "Peugeot", "Renault", "Nissan", "Hyundai", "Kia",
            "Mazda", "Volvo", "Land Rover", "Range Rover", "Mini", "Jaguar",
        ]
        title_upper = title.upper()
        for make in known_makes:
            if make.upper() in title_upper:
                idx = title_upper.index(make.upper()) + len(make)
                rest = title[idx:].strip()
                parts = rest.split()
                model = parts[0].upper() if parts else ""
                canonical = "Mercedes-Benz" if make in ("Mercedes", "Mercedes-Benz") else make
                return canonical, model
        parts = title.split()
        if len(parts) >= 2:
            return parts[0], parts[1].upper()
        return title, ""

    async def _has_next_page(self, page) -> bool:
        """Return True if there is a visible next-page link/button."""
        next_el = await page.query_selector(NEXT_PAGE_SELECTOR)
        if next_el:
            try:
                visible = await next_el.is_visible()
                disabled = await next_el.get_attribute("disabled") or ""
                aria_disabled = await next_el.get_attribute("aria-disabled") or ""
                return visible and not disabled and aria_disabled != "true"
            except Exception:
                pass
        return False
