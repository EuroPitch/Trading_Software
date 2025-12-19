# price_data.py
from typing import List, Dict, Any
import time
import concurrent.futures
import yfinance as yf
import pandas as pd


def chunk_list(items: List[str], chunk_size: int) -> List[List[str]]:
    return [items[i : i + chunk_size] for i in range(0, len(items), chunk_size)]


def calculate_rsi(data, periods=14):
    """Calculate RSI from price data"""
    delta = data.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=periods).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=periods).mean()
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    return rsi.iloc[-1] if len(rsi) > 0 else None


def get_quotes_for_universe(
    symbols: List[str],
    provider: str = "yfinance",
    chunk_size: int = 50,
) -> Dict[str, Dict[str, Any]]:
    """
    Fetch latest quotes + fundamentals for many symbols via yfinance
    """
    result: Dict[str, Dict[str, Any]] = {}

    # Simple in-memory caches to avoid repeated slow calls when polling frequently
    INFO_CACHE_TTL = 30  # seconds
    info_cache: Dict[str, Dict[str, Any]] = {}
    info_cache_ts: Dict[str, float] = {}

    def fetch_info(symbol: str) -> Dict[str, Any]:
        # Return cached info when fresh
        ts = info_cache_ts.get(symbol)
        if ts and (time.time() - ts) < INFO_CACHE_TTL and symbol in info_cache:
            return info_cache[symbol]

        try:
            tk = yf.Ticker(symbol)
            info = tk.info or {}
        except Exception:
            info = {}

        info_cache[symbol] = info
        info_cache_ts[symbol] = time.time()
        return info

    for batch in chunk_list(symbols, chunk_size):
        try:
            # Fetch historical close prices for the batch in a single request
            # This is much faster than calling history() per symbol
            hist = yf.download(batch, period="1mo", group_by="ticker", threads=True, progress=False)
        except Exception:
            hist = pd.DataFrame()

        # For fundamentals, parallelize info fetches per batch
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(8, len(batch))) as exc:
            future_map = {exc.submit(fetch_info, symbol): symbol for symbol in batch}

            for fut in concurrent.futures.as_completed(future_map):
                sym = future_map[fut]
                info = {}
                try:
                    info = fut.result()
                except Exception:
                    info = {}

                # Determine price & previous close from hist data when available
                price = None
                previous_close = None
                rsi = None

                try:
                    if not hist.empty:
                        # hist could be a multi-column DF grouped by ticker when multiple tickers
                        if isinstance(hist.columns, pd.MultiIndex):
                            # e.g., hist[sym]['Close']
                            close_series = hist[sym]['Close'].dropna()
                        else:
                            # single ticker returned as single-level columns
                            close_series = hist['Close'].dropna()

                        if len(close_series) >= 1:
                            price = float(close_series.iloc[-1])
                        if len(close_series) >= 2:
                            previous_close = float(close_series.iloc[-2])

                        # RSI calculation (use closing prices series)
                        if len(close_series) >= 15:
                            rsi = calculate_rsi(close_series)
                except Exception:
                    price = price or None
                    previous_close = previous_close or None
                    rsi = rsi or None

                # Build the consolidated result using info + derived fields
                try:
                    result[sym] = {
                        "symbol": sym,
                        "name": info.get("longName") or info.get("shortName") or sym,
                        "sector": info.get("sector"),
                        "price": price or info.get("currentPrice") or None,
                        "previous_close": previous_close or info.get("previousClose") or None,
                        "open": info.get("regularMarketOpen"),
                        "day_high": info.get("dayHigh"),
                        "day_low": info.get("dayLow"),
                        "volume": info.get("volume"),
                        "market_cap": info.get("marketCap") or info.get("market_cap"),
                        "52_week_high": info.get("fiftyTwoWeekHigh"),
                        "52_week_low": info.get("fiftyTwoWeekLow"),
                        "pe_ratio": info.get("trailingPE"),
                        "pb_ratio": info.get("priceToBook"),
                        "peg_ratio": info.get("pegRatio"),
                        "dividend_yield": info.get("dividendYield"),
                        "roe": info.get("returnOnEquity"),
                        "roa": info.get("returnOnAssets"),
                        "debt_to_equity": info.get("debtToEquity"),
                        "current_ratio": info.get("currentRatio"),
                        "gross_margin": info.get("grossMargins"),
                        "operating_margin": info.get("operatingMargins"),
                        "net_margin": info.get("profitMargins"),
                        "revenue_growth": info.get("revenueGrowth"),
                        "earnings_growth": info.get("earningsGrowth"),
                        "beta": info.get("beta"),
                        "rsi": rsi,
                    }
                except Exception as e:
                    result[sym] = {"symbol": sym, "error": str(e)}

        # small sleep to be gentle on remote endpoints if batches are large
        time.sleep(0.05)

    return result