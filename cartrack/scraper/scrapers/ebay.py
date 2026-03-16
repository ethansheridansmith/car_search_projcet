"""
eBay Motors (ebay.co.uk) scraper for CarTrack.

Navigates eBay Motors Buy-It-Now listings using Playwright and extracts
listing data from up to 3 pages of results.

eBay Motors category ID for Cars, Vans & Trucks: 9801
"""

import json
import logging
import re
from typing import Any, Optional
from urllib.parse import urlencode

from .base import BaseScraper

logger = logging.getLogger(__name__)

EBAY_BASE = "https://www.ebay.co.uk/sch/i.html"

CARD_SELECTORS = [
    "li.s-item",
    ".srp-results li.s-item",
    "[data-view='mi:1686|iid:1']",
]
TITLE_SELECTOR = (
    ".s-item__title, "
    "[class*='s-item__title'], "
    "h3.s-item__title"
)
PRICE_SELECTOR = (
    ".s-item__price, "
    "[class*='s-item__price']"
)
LINK_SELECTOR = (
    "a.s-item__link, "
    "a[href*='ebay.co.uk/itm/']"
)
IMAGE_SELECTOR = (
    "img.s-item__image-img, "
    ".s-item__image img"
)
LOCATION_SELECTOR = (
    ".s-item__location, "
    "[class*='s-item__location'], "
    ".s-item__itemLocation"
)
NEXT_PAGE_SELECTOR = (
    "a[aria-label='Go to next search page'], "
    "a.pagination__next, "
    "[class*='pagination__next']"
)

# eBay listing format: title includes "(year)" or "Reg year"
YEAR_PATTERNS = [
    r"\((\d{4})\)",              # (2021)
    r"\b(20[012]\d)\s+reg\b",   # 2021 reg
    r"\b(20[012]\d)\b",         # any 4-digit year
]


def _build_url(params: dict, page: int = 1) -> str:
    """Construct an eBay Motors search URL with BIN (Buy It Now) filter."""
    keywords: list[str] = []
    if params.get("make"):
        keywords.append(params["make"])
    if params.get("model"):
        keywords.append(params["model"])

    qs: dict[str, Any] = {
        "_sacat": 9801,         # Cars, Vans & Trucks
        "_nkw": " ".join(keywords) if keywords else "car",
        "LH_BIN": 1,            # Buy It Now only
        "_sop": 12,             # Sort: Best Match
        "_pgn": page,
        "LH_ItemCondition": "3000",  # Used
    }

    if params.get("price_min"):
        qs["_udlo"] = params["price_min"]
    if params.get("price_max"):
        qs["_udhi"] = params["price_max"]

    # eBay UK doesn't support postcode filtering in URL params directly,
    # but distance search is available via _stpos and _sadis
    if params.get("postcode"):
        qs["_stpos"] = params["postcode"].replace(" ", "")
    if params.get("radius"):
        qs["_sadis"] = params["radius"]

    return f"{EBAY_BASE}?{urlencode(qs)}"


class EbayScraper(BaseScraper):
    """Scrapes Buy-It-Now car listings from ebay.co.uk/motors."""

    source = "ebay"

    async def scrape(self, search_params: dict) -> list[dict]:
        """
        Execute a search on eBay Motors and return a list of listing dicts.
        Handles up to 3 pages of results.
        """
        results: list[dict] = []
        max_pages = search_params.get("max_pages", 3)

        async with self.get_browser() as (browser, context):
            page = await self.new_page(context)

            first_url = _build_url(search_params, page=1)
            self.logger.info("eBay: fetching page 1 — %s", first_url)
            ok = await self.safe_goto(page, first_url, wait_until="networkidle")
            if not ok:
                ok = await self.safe_goto(page, first_url, wait_until="domcontentloaded")
            if not ok:
                return results

            await self._dismiss_overlays(page)

            for page_num in range(1, max_pages + 1):
                if page_num > 1:
                    url = _build_url(search_params, page=page_num)
                    self.logger.info("eBay: fetching page %d — %s", page_num, url)
                    ok = await self.safe_goto(page, url)
                    if not ok:
                        break

                # Wait for result items
                try:
                    await page.wait_for_selector("li.s-item", timeout=12_000)
                except Exception:
                    self.logger.warning("eBay: listing items not found on page %d", page_num)

                page_listings = await self._extract_listings(page)
                self.logger.info(
                    "eBay page %d: extracted %d listings", page_num, len(page_listings)
                )
                results.extend(page_listings)

                has_next = await self._has_next_page(page)
                if not has_next:
                    break

                await self.polite_delay(2.0, 4.0)

            await page.close()

        self.logger.info("eBay scrape complete: %d total listings", len(results))
        return results

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    async def _dismiss_overlays(self, page) -> None:
        """Dismiss eBay's GDPR consent dialog."""
        selectors = [
            "button#gdpr-banner-accept",
            "[data-testid='accept-all-cookies']",
            "button.btn--large[type='submit']",
            "#gh-cookie-accept",
        ]
        for sel in selectors:
            try:
                btn = await page.query_selector(sel)
                if btn and await btn.is_visible():
                    await btn.click()
                    await page.wait_for_timeout(800)
                    break
            except Exception:
                pass

    async def _extract_listings(self, page) -> list[dict]:
        """Extract all listing items from the current page."""
        listings: list[dict] = []

        cards = []
        for sel in CARD_SELECTORS:
            cards = await page.query_selector_all(sel)
            if cards:
                break

        # Filter out "ghost" cards that eBay inserts as ad placeholders
        real_cards = []
        for card in cards:
            title_el = await card.query_selector(TITLE_SELECTOR)
            if title_el:
                title_text = (await title_el.inner_text()).strip()
                if title_text and "Shop on eBay" not in title_text:
                    real_cards.append(card)

        for card in real_cards:
            try:
                listing = await self._parse_card(card)
                if listing and listing.get("listingUrl") and listing.get("price", 0) > 0:
                    listings.append(listing)
            except Exception as exc:
                self.logger.debug("eBay: failed to parse card: %s", exc)
                continue

        return listings

    async def _parse_card(self, card) -> Optional[dict]:
        """Parse a single eBay listing card into a dict."""
        listing: dict = {"source": self.source}

        # --- URL ---
        link_el = await card.query_selector(LINK_SELECTOR)
        if not link_el:
            link_el = await card.query_selector("a")
        if not link_el:
            return None

        href = await link_el.get_attribute("href") or ""
        # Strip eBay tracking parameters
        href = re.sub(r"\?.*", "", href)
        if not href.startswith("http"):
            return None
        listing["listingUrl"] = href

        # --- Title ---
        title_el = await card.query_selector(TITLE_SELECTOR)
        raw_title = (await title_el.inner_text()).strip() if title_el else ""
        # Remove the "New listing" prefix eBay sometimes prepends
        raw_title = re.sub(r"^New listing\s*", "", raw_title, flags=re.IGNORECASE).strip()
        listing["title"] = raw_title

        # --- Price ---
        price_el = await card.query_selector(PRICE_SELECTOR)
        price_text = (await price_el.inner_text()).strip() if price_el else ""
        # Handle "£X,XXX.00 to £X,XXX.00" ranges — take the lower value
        price_text = price_text.split(" to ")[0]
        listing["price"] = self.parse_price(price_text)

        # --- Specs from title + subtitle ---
        await self._parse_specs(card, listing)

        # --- Location ---
        loc_el = await card.query_selector(LOCATION_SELECTOR)
        location_text = (await loc_el.inner_text()).strip() if loc_el else ""
        # Strip "From" prefix eBay adds
        location_text = re.sub(r"^From\s+", "", location_text, flags=re.IGNORECASE)
        listing["location"] = location_text.strip()

        # --- Image ---
        img_el = await card.query_selector(IMAGE_SELECTOR)
        if img_el:
            src = (
                await img_el.get_attribute("src")
                or await img_el.get_attribute("data-src")
                or ""
            )
            # eBay thumbnails are small; swap to full size
            src = re.sub(r"s-l\d+", "s-l1600", src)
            listing["imageUrls"] = json.dumps([src]) if src.startswith("http") else json.dumps([])
        else:
            listing["imageUrls"] = json.dumps([])

        listing["sellerType"] = "dealer"  # eBay motors listings are mostly dealers/trade

        # --- Make / model ---
        make, model = self._parse_make_model(listing.get("title", ""))
        listing["make"] = make
        listing["model"] = model

        return listing

    async def _parse_specs(self, card, listing: dict) -> None:
        """
        Extract specs from eBay listing.
        eBay buries spec data in the title and a subtitle/description snippet.
        """
        listing["year"] = None
        listing["mileage"] = None
        listing["fuelType"] = None
        listing["transmission"] = None
        listing["engineSize"] = None
        listing["colour"] = None

        full_text_parts: list[str] = []

        # Primary text sources
        for sel in [
            TITLE_SELECTOR,
            ".s-item__subtitle",
            ".s-item__details",
            ".s-item__secondary-info",
        ]:
            el = await card.query_selector(sel)
            if el:
                full_text_parts.append((await el.inner_text()).strip())

        full_text = " | ".join(full_text_parts)
        lines = [p.strip() for p in re.split(r"[\n|,]", full_text) if p.strip()]

        for item in lines:
            item_lower = item.strip().lower()

            # Year
            if listing["year"] is None:
                for pattern in YEAR_PATTERNS:
                    match = re.search(pattern, item, re.IGNORECASE)
                    if match:
                        listing["year"] = int(match.group(1))
                        break

            # Mileage
            if listing["mileage"] is None and re.search(r"\d[\d,]*\s*miles?", item_lower):
                listing["mileage"] = self.parse_mileage(item)

            # Fuel type
            if listing["fuelType"] is None:
                for fuel in ("petrol", "diesel", "hybrid", "electric"):
                    if fuel in item_lower:
                        listing["fuelType"] = fuel.title()
                        break

            # Transmission
            if listing["transmission"] is None:
                if "automatic" in item_lower or " auto" in item_lower:
                    listing["transmission"] = "Automatic"
                elif "manual" in item_lower:
                    listing["transmission"] = "Manual"

            # Engine size
            if listing["engineSize"] is None:
                match = re.search(r"\d\.\d\s*[Ll]", item)
                if match:
                    listing["engineSize"] = match.group().strip().upper().replace(" ", "")

    @staticmethod
    def _parse_make_model(title: str) -> tuple[str, str]:
        """Extract make and model from eBay listing title."""
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
        """Return True if a next-page link exists and is not disabled."""
        next_el = await page.query_selector(NEXT_PAGE_SELECTOR)
        if next_el:
            visible = await next_el.is_visible()
            aria_disabled = await next_el.get_attribute("aria-disabled") or ""
            class_attr = await next_el.get_attribute("class") or ""
            is_disabled = aria_disabled == "true" or "disabled" in class_attr
            return visible and not is_disabled
        return False
