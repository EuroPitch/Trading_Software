#!/usr/bin/env python3
"""
Cache stock P/E ratios from yfinance into Supabase `fundamentals` table.

Run manually or via cron. Reads Supabase credentials from environment variables.
Uses upsert to avoid duplicates; sleeps between requests to reduce rate limiting.

How to run locally:
  1. Create the `fundamentals` table in Supabase (run supabase_fundamentals_table.sql
     in the Supabase SQL Editor if not already done).
  2. From the backend folder, create a .env file with:
       SUPABASE_URL=https://your-project.supabase.co
       SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
     (Use Service Role key so the script can upsert; never expose this to the frontend.)
  3. Install deps:  pip install -r requirements.txt
  4. Run:  python cache_fundamentals.py
     Or with custom tickers:  python cache_fundamentals.py "AAPL,MSFT,GOOGL"
"""

import os
import sys
import time
import logging
from datetime import datetime, timezone
from typing import Optional

import yfinance as yf
from dotenv import load_dotenv
from supabase import create_client, Client

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

# Load .env from script directory or project root
load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# Supabase credentials (must be set in env; never commit real keys)
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

# Delay between yfinance requests (seconds) to avoid 429 rate limits
REQUEST_DELAY_SEC = 1.0

# Default ticker list; replace or extend as needed
DEFAULT_TICKERS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK-B", "UNH", "JNJ",
    "JPM", "V", "PG", "XOM", "HD", "CVX", "MA", "ABBV", "MRK", "PEP",
    "KO", "COST", "LLY", "WMT", "MCD", "CSCO", "ACN", "ABT", "DHR", "TMO",
    "NEE", "WFC", "PM", "BMY", "INTC", "RTX", "HON", "UPS", "UNP", "LOW",
    "AMGN", "INTU", "QCOM", "SPGI", "CAT", "BA", "AXP", "DE", "SBUX", "GS",
    "ADBE", "MDT", "GILD", "ADI", "CVS", "ISRG", "VZ", "REGN", "LMT", "AMAT",
    "BKNG", "PANW", "TXN", "CMCSA", "PLD", "C", "SO", "DUK", "BDX", "CI",
]

# -----------------------------------------------------------------------------
# Logging
# -----------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)


def get_supabase_client() -> Client:
    """Build Supabase client from env. Exits if credentials missing."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        log.error(
            "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. "
            "Set them in .env or the environment."
        )
        sys.exit(1)
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def fetch_pe_ratio(symbol: str) -> Optional[float]:
    """
    Fetch trailing P/E for one ticker via yfinance.
    Returns None if unavailable or on error.
    """
    symbol = (symbol or "").strip().upper()
    if not symbol:
        return None
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info or {}
        pe = info.get("trailingPE")
        if pe is None:
            return None
        return round(float(pe), 4)
    except Exception as e:
        log.warning("yfinance error for %s: %s", symbol, e)
        return None


def main(tickers: Optional[list[str]] = None) -> None:
    tickers = tickers or DEFAULT_TICKERS
    supabase = get_supabase_client()

    success_count = 0
    fail_count = 0

    for i, symbol in enumerate(tickers):
        symbol = (symbol or "").strip().upper()
        if not symbol:
            continue

        pe = fetch_pe_ratio(symbol)
        row = {
            "symbol": symbol,
            "pe_ratio": pe,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        try:
            supabase.table("fundamentals").upsert(
                row,
                on_conflict="symbol",
            ).execute()
            if pe is not None:
                log.info("%s: P/E = %s (upserted)", symbol, pe)
                success_count += 1
            else:
                log.info("%s: no P/E data (upserted with NULL)", symbol)
                fail_count += 1
        except Exception as e:
            log.error("%s: upsert failed: %s", symbol, e)
            fail_count += 1

        # Rate limiting: sleep after each request (except before the last)
        if i < len(tickers) - 1:
            time.sleep(REQUEST_DELAY_SEC)

    log.info("Done. Success: %s, No data/Error: %s", success_count, fail_count)


if __name__ == "__main__":
    # Optional: pass a comma-separated list of tickers as first argument
    if len(sys.argv) > 1:
        custom = [s.strip() for s in sys.argv[1].split(",") if s.strip()]
        if custom:
            main(tickers=custom)
        else:
            main()
    else:
        main()
