# price_data.py
from typing import List, Dict, Any
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

    for batch in chunk_list(symbols, chunk_size):
        for symbol in batch:
            try:
                ticker = yf.Ticker(symbol)
                info = ticker.info
                fast_info = ticker.fast_info
                
                # Get historical data for RSI calculation
                hist = ticker.history(period="1mo")
                rsi = calculate_rsi(hist['Close']) if not hist.empty else None
                
                result[symbol] = {
                    "symbol": symbol,
                    "name": info.get("longName") or info.get("shortName") or symbol,
                    "sector": info.get("sector"),
                    "price": fast_info.get("last_price"),
                    "previous_close": fast_info.get("previous_close"),
                    "open": fast_info.get("open"),
                    "day_high": fast_info.get("day_high"),
                    "day_low": fast_info.get("day_low"),
                    "volume": fast_info.get("last_volume"),
                    "market_cap": fast_info.get("market_cap"),
                    "52_week_high": fast_info.get("year_high"),
                    "52_week_low": fast_info.get("year_low"),
                    # Fundamentals from info
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
                result[symbol] = {"symbol": symbol, "error": str(e)}

    return result