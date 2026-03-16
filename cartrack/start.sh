#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  CarTrack — start both servers and open the browser
#  Usage:  ./start.sh          (from the cartrack/ directory)
#          bash start.sh       (from anywhere)
# ─────────────────────────────────────────────────────────────────────────────

set -e

# ── resolve script directory so it works from any cwd ────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$SCRIPT_DIR/app"
SCRAPER_DIR="$SCRIPT_DIR/scraper"

# ── colours ──────────────────────────────────────────────────────────────────
BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
DIM='\033[2m'
NC='\033[0m'

# ── helpers ───────────────────────────────────────────────────────────────────
port_in_use() { lsof -i ":$1" -sTCP:LISTEN -t &>/dev/null; }

wait_for_port() {
  local port=$1 label=$2 timeout=30 elapsed=0
  printf "  Waiting for %-20s" "$label..."
  while ! port_in_use "$port"; do
    sleep 1; elapsed=$((elapsed+1))
    if [ $elapsed -ge $timeout ]; then
      echo -e " ${RED}timed out${NC}"; return 1
    fi
  done
  echo -e " ${GREEN}ready ✓${NC}"
}

cleanup() {
  echo ""
  echo -e "${YELLOW}Shutting down CarTrack…${NC}"
  [ -n "$SCRAPER_PID" ] && kill "$SCRAPER_PID" 2>/dev/null
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null
  wait "$SCRAPER_PID" "$FRONTEND_PID" 2>/dev/null
  echo -e "${DIM}Stopped.${NC}"
  exit 0
}
trap cleanup INT TERM

# ── banner ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${BLUE}🚗  CarTrack${NC}"
echo -e "${DIM}──────────────────────────────────────${NC}"

# ── preflight: check .env ─────────────────────────────────────────────────────
if [ ! -f "$SCRIPT_DIR/.env" ]; then
  echo -e "${YELLOW}⚠  No .env found — copying .env.example${NC}"
  cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
fi

# ── preflight: check node_modules ────────────────────────────────────────────
if [ ! -d "$APP_DIR/node_modules" ]; then
  echo -e "${YELLOW}📦  Installing npm dependencies…${NC}"
  (cd "$APP_DIR" && npm install --silent)
fi

# ── preflight: check database ─────────────────────────────────────────────────
if [ ! -f "$SCRIPT_DIR/cartrack.db" ]; then
  echo -e "${YELLOW}🗄  No database found — running setup…${NC}"
  (cd "$APP_DIR" && npm run db:push --silent && npm run db:seed --silent)
  echo -e "${GREEN}   Database created and seeded ✓${NC}"
fi

# ── find python / uvicorn ────────────────────────────────────────────────────
UVICORN=""
for candidate in \
    "$(python3 -c 'import sys; print(sys.prefix)' 2>/dev/null)/bin/uvicorn" \
    "$HOME/Library/Python/3.9/bin/uvicorn" \
    "$HOME/Library/Python/3.10/bin/uvicorn" \
    "$HOME/Library/Python/3.11/bin/uvicorn" \
    "$HOME/Library/Python/3.12/bin/uvicorn" \
    "$(which uvicorn 2>/dev/null)"; do
  [ -x "$candidate" ] && UVICORN="$candidate" && break
done

# ── start FastAPI scraper ─────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}Starting services…${NC}"

if [ -z "$UVICORN" ]; then
  echo -e "  ${YELLOW}⚠  uvicorn not found — skipping scraper${NC}"
  echo -e "  ${DIM}Run: pip install -r scraper/requirements.txt && playwright install chromium${NC}"
  SCRAPER_PID=""
elif port_in_use 8001; then
  echo -e "  ${DIM}Scraper already running on :8001 — skipping${NC}"
  SCRAPER_PID=""
else
  (cd "$SCRAPER_DIR" && "$UVICORN" main:app --reload --port 8001 \
      --log-level warning 2>&1 \
    | awk '{print "  \033[2m[scraper]\033[0m " $0; fflush()}') &
  SCRAPER_PID=$!
fi

# ── start Next.js frontend ────────────────────────────────────────────────────
if port_in_use 3000; then
  echo -e "  ${DIM}Frontend already running on :3000 — skipping${NC}"
  FRONTEND_PID=""
else
  (cd "$APP_DIR" && npm run dev 2>&1 \
    | awk '{print "  \033[2m[frontend]\033[0m " $0; fflush()}') &
  FRONTEND_PID=$!
fi

# ── wait for both ports ───────────────────────────────────────────────────────
echo ""
wait_for_port 3000 "frontend (:3000)"
[ -n "$SCRAPER_PID" ] && wait_for_port 8001 "scraper  (:8001)"

# ── open browser ─────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}✅  CarTrack is running!${NC}"
echo -e "   ${BOLD}Dashboard:${NC}  http://localhost:3000"
[ -n "$SCRAPER_PID" ] && echo -e "   ${BOLD}Scraper:${NC}    http://localhost:8001/docs"
echo ""
echo -e "${DIM}Press Ctrl+C to stop both servers.${NC}"
echo ""

# open browser (macOS)
open "http://localhost:3000" 2>/dev/null || true

# ── keep alive ────────────────────────────────────────────────────────────────
wait
