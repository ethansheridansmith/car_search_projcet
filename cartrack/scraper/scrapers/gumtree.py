"""
Gumtree.com cars scraper for CarTrack.

Navigates gumtree.com/cars search results using Playwright and extracts
listing data from up to 3 pages of results.
"""

import json
import logging
import re
from typing import Any, Optional
from urllib.parse import urlencode

from .base import BaseScraper

logger = logging.getLogger(__name__)

GUMTREE_BASE = "https://www.gumtree.com/search"

CARD_SELECTORS = [
    "article.listing-maxi",
    "li[class*='listing']",
    "[data-q='search-result']",
    ".listing-card",
    "article[class*='listing']",
]
TITLE_SELECTOR = (
    "a[class*='listing-title'], "
    "[data-q='listing-title'], "
    "h2[class*='title'], "
    ".listing-card__title"
)
PRICE_SELECTOR = (
    "[data-q='listing-adprice'], "
    ".listing-price, "
    "[class*='price']"
)
LINK_SELECTOR = (
    "a[href*='/cars/'], "
    "a[data-q='listing-title-link'], "
    "a[class*='listing-title']"
)
IMAGE_SELECTOR = (
    "img[class*='listing-thumbnail'], "
    "img[data-q='listing-photo'], "
    ".listing-card__image img, "
    "img"
)
LOCATION_SELECTOR = (
    "[data-q='listing-location'], "
    ".listing-location, "
    "[class*='location']"
)
NEXT_PAGE_SELECTOR = (
    "[data-q='pagination-forward'], "
    "a[aria-label='Next page'], "
    "a.pagination-next, "
    "li.pagination-next a"
)


def _build_url(params: dict, page: int = 1) -> str:
    """Construct a Gumtree search URL for cars."""
    qs: dict[str, Any] = {
        "search_category": "cars",
        "search_scope": "false",
    }

    # Build a keyword query from make + model
    keywords: list[str] = []
    if params.get("make"):
        keywords.append(params["make"])
    if params.get("model"):
        keywords.append(params["model"])
    if keywords:
        qs["q"] = " ".join(keywords)

    if params.get("price_max"):
        qs["max_price"] = params["price_max"]
    if params.get("price_min"):
        qs["min_price"] = params["price_min"]

    # Gumtree uses location by area name or postcode
    if params.get("postcode"):
        qs["search_location"] = params["postcode"]
    if params.get("radius"):
        qs["distance"] = params["radius"]

    if page > 1:
        qs["page"] = page

    return f"{GUMTREE_BASE}?{urlencode(qs)}"


class GumtreeScraper(BaseScraper):
    """Scrapes car listings from gumtree.com."""

    source = "gumtree"

    async def scrape(self, search_params: dict) -> list[dict]:
        """
        Execute a search on Gumtree and return a list of listing dicts.
        Handles up to 3 pages of results.
        """
        results: list[dict] = []
        max_pages = search_params.get("max_pages", 3)

        async with self.get_browser() as (browser, context):
            page = await self.new_page(context)

            first_url = _build_url(search_params, page=1)
            self.logger.info("Gumtree: fetching page 1 — %s", first_url)
            ok = await self.safe_goto(page, first_url)
            if not ok:
                return results

            await self._dismiss_overlays(page)

            for page_num in range(1, max_pages + 1):
                if page_num > 1:
                    url = _build_url(search_params, page=page_num)
                    self.logger.info("Gumtree: fetching page %d — %s", page_num, url)
                    ok = await self.safe_goto(page, url)
                    if not ok:
                        break
                    await self._dismiss_overlays(page)

                # Wait for listings
                try:
                    await page.wait_for_selector(
                        ", ".join(CARD_SELECTORS[:2]), timeout=12_000
                    )
                except Exception:
                    self.logger.warning("Gumtree: listings not found on page %d", page_num)

                page_listings = await self._extract_listings(page)
                self.logger.info(
                    "Gumtree page %d: extracted %d listings", page_num, len(page_listings)
                )
                results.extend(page_listings)

                has_next = await self._has_next_page(page)
                if not has_next:
                    break

                await self.polite_delay(1.5, 3.5)

            await page.close()

        self.logger.info("Gumtree scrape complete: %d total listings", len(results))
        return results

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    async def _dismiss_overlays(self, page) -> None:
        """Dismiss Gumtree's cookie consent and any other overlays."""
        selectors = [
            "button#onetrust-accept-btn-handler",
            "[data-testid='accept-all-cookies']",
            "button[class*='accept-all']",
            "button[title*='Accept']",
            ".cookie-consent-button",
        ]
        for sel in selectors:
            try:
                btn = await page.query_selector(sel)
                if btn and await btn.is_visible():
                    await btn.click()
                    await page.wait_for_timeout(700)
                    break
            except Exception:
                pass

    async def _extract_listings(self, page) -> list[dict]:
        """Extract all listing cards from the current page."""
        listings: list[dict] = []

        cards = []
        for sel in CARD_SELECTORS:
            cards = await page.query_selector_all(sel)
            if cards:
                self.logger.debug("Gumtree: card selector '%s' found %d", sel, len(cards))
                break

        for card in cards:
            try:
                listing = await self._parse_card(card)
                if listing and listing.get("listingUrl") and listing.get("price", 0) > 0:
                    listings.append(listing)
            except Exception as exc:
                self.logger.debug("Gumtree: failed to parse card: %s", exc)
                continue

        return listings

    async def _parse_card(self, card) -> Optional[dict]:
        """Parse a single Gumtree listing card into a dict."""
        listing: dict = {"source": self.source}

        # --- URL ---
        link_el = await card.query_selector(LINK_SELECTOR)
        if not link_el:
            link_el = await card.query_selector("a")
        if not link_el:
            return None

        href = await link_el.get_attribute("href") or ""
        if href.startswith("/"):
            href = f"https://www.gumtree.com{href}"
        if not href.startswith("http"):
            return None
        listing["listingUrl"] = href

        # --- Title ---
        title_el = await card.query_selector(TITLE_SELECTOR)
        if not title_el:
            title_el = link_el
        listing["title"] = (await title_el.inner_text()).strip() if title_el else ""

        # --- Price ---
        price_el = await card.query_selector(PRICE_SELECTOR)
        price_text = (await price_el.inner_text()).strip() if price_el else ""
        listing["price"] = self.parse_price(price_text)

        # --- Extract specs from description / attributes ---
        await self._parse_specs(card, listing)

        # --- Location ---
        loc_el = await card.query_selector(LOCATION_SELECTOR)
        location_text = (await loc_el.inner_text()).strip() if loc_el else ""
        listing["location"] = re.sub(r"\s*\([\d.]+ miles?\)", "", location_text).strip()

        # --- Image ---
        img_el = await card.query_selector(IMAGE_SELECTOR)
        if img_el:
            src = (
                await img_el.get_attribute("src")
                or await img_el.get_attribute("data-src")
                or ""
            )
            listing["imageUrls"] = json.dumps([src]) if src and src.startswith("http") else json.dumps([])
        else:
            listing["imageUrls"] = json.dumps([])

        # Gumtree is predominantly private sellers
        card_html = await card.inner_html()
        listing["sellerType"] = "dealer" if "trade" in card_html.lower() else "private"

        # --- Make / model ---
        make, model = self._parse_make_model(listing.get("title", ""))
        listing["make"] = make
        listing["model"] = model

        return listing

    async def _parse_specs(self, card, listing: dict) -> None:
        """
        Extract specs from Gumtree listing attributes/description.
        Gumtree typically shows year and mileage as separate attribute pills.
        """
        listing["year"] = None
        listing["mileage"] = None
        listing["fuelType"] = None
        listing["transmission"] = None
        listing["engineSize"] = None

        attr_selectors = [
            "[data-q='listing-attribute']",
            ".listing-attributes li",
            ".vehicle-attributes li",
            "[class*='attribute']",
        ]
        attr_items: list[str] = []
        for sel in attr_selectors:
            els = await card.query_selector_all(sel)
            if els:
                for el in els:
                    text = (await el.inner_text()).strip()
                    if text:
                        attr_items.append(text)
                break

        if not attr_items:
            card_text = (await card.inner_text()).strip()
            attr_items = [line.strip() for line in card_text.split("\n") if line.strip()]

        for item in attr_items:
            item_lower = item.strip().lower()

            if listing["year"] is None:
                year = self.parse_year(item)
                if year:
                    listing["year"] = year
                    continue

            if listing["mileage"] is None and re.search(r"\d[\d,]*\s*miles?", item_lower):
                listing["mileage"] = self.parse_mileage(item)
                continue

            if listing["fuelType"] is None:
                for fuel in ("petrol", "diesel", "hybrid", "electric"):
                    if fuel in item_lower:
                        listing["fuelType"] = item.strip().title()
                        break

            if listing["transmission"] is None:
                if "automatic" in item_lower or " auto" in item_lower:
                    listing["transmission"] = "Automatic"
                elif "manual" in item_lower:
                    listing["transmission"] = "Manual"

            if listing["engineSize"] is None and re.search(r"\d\.\d\s*[Ll]", item):
                match = re.search(r"\d\.\d\s*[Ll]", item)
                if match:
                    listing["engineSize"] = match.group().strip().upper().replace(" ", "")

    @staticmethod
    def _parse_make_model(title: str) -> tuple[str, str]:
        """Extract make and model from listing title."""
        known_makes = [
            "BMW", "Audi", "CUPRA", "SEAT", "Mercedes-Benz", "Mercedes",
            "Skoda", "Toyota", "Honda", "Ford", "Volkswagen", "VW",
            "Vauxhall", "Peugeot", "Renault", "Nissan", "Hyundai", "Kia",
            "Mazda", "Volvo",
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
        """Return True if a next-page navigation element exists and is active."""
        next_el = await page.query_selector(NEXT_PAGE_SELECTOR)
        if next_el:
            visible = await next_el.is_visible()
            disabled_attr = await next_el.get_attribute("disabled") or ""
            aria_disabled = await next_el.get_attribute("aria-disabled") or ""
            class_attr = await next_el.get_attribute("class") or ""
            is_disabled = bool(disabled_attr) or aria_disabled == "true" or "disabled" in class_attr
            return visible and not is_disabled
        return False
