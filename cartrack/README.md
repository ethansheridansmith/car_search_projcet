# CarTrack 🚗

A full-stack car search dashboard that scrapes UK listings from AutoTrader, Motors.co.uk, Gumtree, and eBay Motors — then surfaces them in a polished Next.js UI with saved searches, price-drop alerts, and analytics.

---

## Features

- 🔍 **Live search** with 10+ filters (make/model, price, year, mileage, fuel, gearbox, postcode radius, seller type)
- 🃏 **Card & table view** toggle with photo, price-drop badge, days-on-market
- 💾 **Saved cars** with per-car notes and price-change tracking
- 🔔 **Saved searches** with desktop & email alert toggles
- 📊 **Analytics** — avg price trends, distribution charts, price-drop frequency (Recharts)
- 🤖 **Automated scraping** every 30 min via Playwright (headless Chromium)
- 🏷️ **De-duplication** by VIN or title+year+mileage+price fingerprint
- ⚙️ **Settings page** — configure postcode, scrape interval, SMTP alerts, enable/disable sources

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18 + |
| npm | 9 + |
| Python | 3.11 + |
| pip / uv | latest |

---

## Quick Start

### 1 · Clone & configure

```bash
cd /path/to/cartrack
cp .env.example .env
# Edit .env if you want to change defaults (postcode, SMTP, etc.)
```

### 2 · Database setup

```bash
cd app
npm install
npm run db:generate   # generates Prisma client
npm run db:push       # creates cartrack.db + tables
npm run db:seed       # seeds 20 example listings
```

> The SQLite database is created at `cartrack/cartrack.db` and is shared between the Next.js app and the Python scraper.

### 3 · Start the frontend

```bash
# inside cartrack/app/
npm run dev
# → http://localhost:3000
```

### 4 · Start the scraper (optional — seed data works without it)

```bash
cd ../scraper
pip install -r requirements.txt
playwright install chromium
uvicorn main:app --reload --port 8001
# → http://localhost:8001/docs
```

### 5 · Trigger a manual scrape

Either click **"Scrape Now"** on the Settings page, or:

```bash
curl -X POST http://localhost:8001/scrape
```

Check status:

```bash
curl http://localhost:8001/status
```

---

## Project Structure

```
cartrack/
├── .env.example          ← copy to .env
├── cartrack.db           ← SQLite (created on first run)
├── README.md
│
├── prisma/
│   ├── schema.prisma     ← Prisma schema (Listing, SavedSearch, etc.)
│   └── seed.ts           ← 20 seed listings + saved searches
│
├── app/                  ← Next.js 14 (App Router)
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx              → redirects to /search
│   │   ├── search/page.tsx       ← sidebar filters + grid/table
│   │   ├── listings/page.tsx     ← browse all listings
│   │   ├── listing/[id]/page.tsx ← detail page
│   │   ├── saved/page.tsx        ← saved cars + notes
│   │   ├── searches/page.tsx     ← saved searches + alert toggles
│   │   ├── analytics/page.tsx    ← Recharts dashboards
│   │   ├── settings/page.tsx     ← scraper config + email
│   │   └── api/                  ← Next.js API routes
│   │       ├── listings/
│   │       ├── saved/
│   │       ├── searches/
│   │       ├── analytics/
│   │       ├── settings/
│   │       └── scrape/
│   ├── components/
│   │   ├── ui/                   ← shadcn/ui primitives
│   │   ├── nav.tsx
│   │   ├── listing-card.tsx
│   │   ├── listing-table.tsx
│   │   ├── search-filters.tsx
│   │   ├── detail-modal.tsx
│   │   ├── analytics-charts.tsx
│   │   ├── price-badge.tsx
│   │   └── source-badge.tsx
│   ├── lib/
│   │   ├── prisma.ts             ← Prisma singleton
│   │   ├── types.ts              ← shared TypeScript types
│   │   ├── utils.ts              ← formatPrice, formatMileage, etc.
│   │   └── insurance-groups.ts   ← static insurance group lookup
│   ├── package.json
│   └── tsconfig.json
│
└── scraper/              ← FastAPI + Playwright
    ├── main.py           ← FastAPI app + scheduler
    ├── models.py         ← SQLAlchemy models (mirrors Prisma)
    ├── scheduler.py      ← APScheduler job
    ├── requirements.txt
    └── scrapers/
        ├── base.py
        ├── autotrader.py
        ├── motors.py
        ├── gumtree.py
        └── ebay.py
```

---

## Pages

| Route | Description |
|-------|-------------|
| `/search` | Live search with full filter sidebar |
| `/listings` | Browse all scraped listings |
| `/listing/[id]` | Detail page with image gallery + price history |
| `/saved` | Your saved cars with notes |
| `/searches` | Saved searches with alert toggles |
| `/analytics` | Price trends, distributions, source breakdown |
| `/settings` | Postcode, scrape interval, SMTP, source toggles |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `file:./cartrack.db` | Prisma SQLite URL |
| `DB_PATH` | `./cartrack.db` | Python scraper SQLite path |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Frontend URL |
| `NEXT_PUBLIC_SCRAPER_URL` | `http://localhost:8001` | Scraper API URL |
| `SMTP_HOST` | — | SMTP server for email alerts |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` | — | SMTP username |
| `SMTP_PASS` | — | SMTP password |
| `ALERT_EMAIL` | — | Address to receive alerts |
| `DEFAULT_POSTCODE` | `BS7 8NE` | Default search postcode |

---

## Tech Stack

**Frontend**
- Next.js 14 (App Router, TypeScript)
- Prisma ORM + SQLite
- shadcn/ui + Tailwind CSS
- Recharts

**Backend / Scraper**
- FastAPI + Uvicorn
- Playwright (headless Chromium)
- SQLAlchemy + aiosqlite
- APScheduler

---

## Development Tips

```bash
# Open Prisma Studio (visual DB browser)
cd app && npm run db:studio

# Re-seed the database (clears + re-inserts 20 listings)
npm run db:seed

# View scraper API docs
open http://localhost:8001/docs

# Run Next.js in production mode
npm run build && npm run start
```

---

## My Search Profile (defaults pre-filled)

| Setting | Value |
|---------|-------|
| Postcode | BS7 8NE |
| Budget | £18,000 |
| Year from | 2019 |
| Transmission | Automatic |
| Fuels | Petrol, Diesel, Hybrid |
| Makes | BMW, Audi, SEAT, CUPRA, Mercedes-Benz, Skoda, Toyota, Honda |
| Insurance group max | 28 |
