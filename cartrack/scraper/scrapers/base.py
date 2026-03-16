"""
Base scraper class providing shared Playwright browser management,
utility methods, and rate limiting for all CarTrack scrapers.
"""

import asyncio
import logging
import random
import re
from abc import ABC, abstractmethod
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

from playwright.async_api import Browser, BrowserContext, Page, async_playwright

logger = logging.getLogger(__name__)

USER_AGENTS = [
    (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0"
    ),
]

VIEWPORT = {"width": 1280, "height": 800}


class BaseScraper(ABC):
    """
    Abstract base class for all CarTrack site scrapers.

    Subclasses must implement `scrape(search_params)`.
    """

    source: str = "unknown"

    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)

    # ------------------------------------------------------------------
    # Abstract interface
    # ------------------------------------------------------------------

    @abstractmethod
    async def scrape(self, search_params: dict) -> list[dict]:
        """
        Perform a search on the target site and return a list of listing dicts.

        Each dict should contain at minimum:
            title, make, model, year, price, mileage, fuelType, transmission,
            colour, engineSize, sellerType, location, listingUrl, source, imageUrls
        """
        ...

    # ------------------------------------------------------------------
    # Browser management
    # ------------------------------------------------------------------

    @asynccontextmanager
    async def get_browser(self) -> AsyncGenerator[tuple[Browser, BrowserContext], None]:
        """
        Async context manager that launches a headless Chromium browser
        and yields (browser, context).  Cleans up on exit.
        """
        user_agent = random.choice(USER_AGENTS)
        async with async_playwright() as playwright:
            browser: Browser = await playwright.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-blink-features=AutomationControlled",
                    "--disable-infobars",
                ],
            )
            context: BrowserContext = await browser.new_context(
                user_agent=user_agent,
                viewport=VIEWPORT,
                locale="en-GB",
                timezone_id="Europe/London",
                extra_http_headers={
                    "Accept-Language": "en-GB,en;q=0.9",
                    "Accept": (
                        "text/html,application/xhtml+xml,application/xml;"
                        "q=0.9,image/avif,image/webp,*/*;q=0.8"
                    ),
                },
            )
            # Mask automation signals
            await context.add_init_script(
                "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
            )
            try:
                yield browser, context
            finally:
                await context.close()
                await browser.close()

    async def new_page(self, context: BrowserContext) -> Page:
        """Create a new page with sensible defaults."""
        page = await context.new_page()
        page.set_default_navigation_timeout(30_000)
        page.set_default_timeout(15_000)
        return page

    # ------------------------------------------------------------------
    # Rate limiting
    # ------------------------------------------------------------------

    async def polite_delay(self, min_s: float = 1.0, max_s: float = 3.0) -> None:
        """Sleep for a random interval to avoid hammering the server."""
        delay = random.uniform(min_s, max_s)
        self.logger.debug("Rate-limit delay: %.2fs", delay)
        await asyncio.sleep(delay)

    # ------------------------------------------------------------------
    # Price / mileage parsing utilities
    # ------------------------------------------------------------------

    @staticmethod
    def parse_price(price_str: str) -> int:
        """
        Parse a price string like '£16,500' or '16500' into an integer.
        Returns 0 if the string cannot be parsed.
        """
        if not price_str:
            return 0
        cleaned = re.sub(r"[£,\s]", "", price_str.strip())
        # Handle "POA" / "Contact" / non-numeric
        match = re.search(r"\d+", cleaned)
        if not match:
            return 0
        try:
            return int(match.group())
        except ValueError:
            return 0

    @staticmethod
    def parse_mileage(mileage_str: str) -> int:
        """
        Parse a mileage string like '22,000 miles' or '22000mi' into an integer.
        Returns 0 if the string cannot be parsed.
        """
        if not mileage_str:
            return 0
        cleaned = re.sub(r"[,\s]", "", mileage_str.strip().lower())
        cleaned = re.sub(r"miles?|mi$", "", cleaned)
        match = re.search(r"\d+", cleaned)
        if not match:
            return 0
        try:
            return int(match.group())
        except ValueError:
            return 0

    @staticmethod
    def parse_year(text: str) -> Optional[int]:
        """Extract a 4-digit year (2000-2030) from a string."""
        match = re.search(r"\b(20[012]\d)\b", text)
        if match:
            return int(match.group(1))
        return None

    # ------------------------------------------------------------------
    # Safe page navigation helper
    # ------------------------------------------------------------------

    async def safe_goto(
        self,
        page: Page,
        url: str,
        wait_until: str = "domcontentloaded",
    ) -> bool:
        """
        Navigate to a URL and return True on success, False on error.
        Swallows navigation timeouts to allow partial scrapes to continue.
        """
        try:
            await page.goto(url, wait_until=wait_until)
            return True
        except Exception as exc:
            self.logger.warning("Navigation failed for %s: %s", url, exc)
            return False

    # ------------------------------------------------------------------
    # Text extraction helper
    # ------------------------------------------------------------------

    async def get_text(self, page: Page, selector: str, default: str = "") -> str:
        """Return the inner text of the first matching element, or `default`."""
        try:
            el = await page.query_selector(selector)
            if el:
                text = await el.inner_text()
                return text.strip()
        except Exception:
            pass
        return default

    async def get_attr(
        self, page: Page, selector: str, attr: str, default: str = ""
    ) -> str:
        """Return an attribute value from the first matching element, or `default`."""
        try:
            el = await page.query_selector(selector)
            if el:
                val = await el.get_attribute(attr)
                return (val or "").strip()
        except Exception:
            pass
        return default
