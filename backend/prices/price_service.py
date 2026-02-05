import asyncio
import json
import logging
import os
import threading
import time
import pickle
import requests
import yfinance as yf
import pandas as pd
import websockets
from fastapi import WebSocket
from datetime import datetime, timedelta

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("PriceService")

CACHE_FILE = "fundamentals_cache.pkl"

class ConnectionManager:
    """Manages the websocket connections to your frontend clients (React)."""
    
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"New client connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"Client disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """Broadcasts a JSON message to all connected clients. Removes dead connections automatically."""
        json_msg = json.dumps(message)
        for connection in list(self.active_connections):  # Iterate over a copy
            try:
                await connection.send_text(json_msg)
            except Exception as e:
                logger.error(f"Failed to send to client: {e}")
                self.disconnect(connection)


class PriceService:
    def __init__(self, universe_file="universe.json"):
        self.api_key = os.getenv("FINNHUB_KEY")
        if not self.api_key:
            logger.warning("Oi! You forgot the FINNHUB_KEY. We're flying blind here mate.")
        
        self.universe_file = universe_file
        self.symbols = self._load_symbols()
        
        self.fundamental_cache = self._load_cache()
        self.live_prices = {}  # {symbol: price}
        
        self.manager = ConnectionManager()
        self.running = False
        
        # ============================================
        # NEW: WebSocket Reconnection Management
        # ============================================
        self.reconnect_attempts = 0
        self.max_reconnect_attempts = 10
        self.base_delay = 5
        self.max_delay = 300  # 5 minutes max
        self.last_429_time = None
        self.consecutive_failures = 0
        self.ws_connected = False

    def _load_symbols(self):
        try:
            base = os.path.dirname(__file__)
            path = os.path.join(base, self.universe_file)
            if not os.path.exists(path):
                return []
            
            with open(path, "r") as f:
                data = json.load(f)
            
            tickers = []
            for sector in data["sectors"].values():
                for stock in sector["stocks"]:
                    tickers.append(stock["ticker"])
            return list(set(tickers))
        except Exception as e:
            logger.error(f"Failed to load universe: {e}")
            return []

    def _load_cache(self):
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, "rb") as f:
                    logger.info("Loaded cached fundamentals from disk.")
                    return pickle.load(f)
            except Exception:
                pass
        return {}

    def _save_cache(self):
        try:
            with open(CACHE_FILE, "wb") as f:
                pickle.dump(self.fundamental_cache, f)
        except Exception as e:
            logger.error(f"Failed to save cache: {e}")

    async def start(self):
        """Starts the async loop for Finnhub and the threaded loop for Yahoo."""
        self.running = True
        
        # Start fundamentals in a background thread
        t_fund = threading.Thread(target=self._fundamental_loop, daemon=True)
        t_fund.start()
        
        # Start the async websocket consumer
        asyncio.create_task(self._upstream_websocket_loop())

    async def _upstream_websocket_loop(self):
        """Connects to Finnhub with exponential backoff and rate limit handling."""
        uri = f"wss://ws.finnhub.io?token={self.api_key}"
        
        while self.running:
            try:
                # ============================================
                # RATE LIMIT CHECK: If we got 429, wait longer
                # ============================================
                if self.last_429_time:
                    time_since_429 = (datetime.now() - self.last_429_time).total_seconds()
                    if time_since_429 < 120:  # Wait at least 2 minutes after 429
                        wait_time = 120 - time_since_429
                        logger.warning(f"⚠️ Rate limited! Waiting {wait_time:.0f}s before retry...")
                        await asyncio.sleep(wait_time)
                        self.last_429_time = None  # Reset after waiting
                
                # ============================================
                # EXPONENTIAL BACKOFF: Calculate delay
                # ============================================
                if self.reconnect_attempts > 0:
                    delay = min(self.base_delay * (2 ** self.reconnect_attempts), self.max_delay)
                    logger.info(f"Reconnecting in {delay}s (attempt {self.reconnect_attempts}/{self.max_reconnect_attempts})...")
                    await asyncio.sleep(delay)
                
                logger.info("Connecting to Finnhub WS...")
                
                async with websockets.connect(uri) as ws:
                    logger.info("✅ Connected to Finnhub.")
                    self.ws_connected = True
                    self.reconnect_attempts = 0  # Reset on successful connection
                    self.consecutive_failures = 0
                    
                    # Subscribe to all symbols
                    for sym in self.symbols:
                        await ws.send(json.dumps({"type": "subscribe", "symbol": sym}))
                        await asyncio.sleep(0.05)  # Small delay between subscriptions
                    
                    # Listen for messages
                    async for message in ws:
                        try:
                            data = json.loads(message)
                            
                            if data["type"] == "trade":
                                update_batch = {}
                                
                                for trade in data["data"]:
                                    sym = trade["s"]
                                    price = trade["p"]
                                    
                                    self.live_prices[sym] = price
                                    
                                    prev_close = self._get_prev_close(sym)
                                    change = 0.0
                                    change_p = 0.0
                                    
                                    if prev_close and prev_close > 0:
                                        change = price - prev_close
                                        change_p = (change / prev_close) * 100
                                    
                                    update_batch[sym] = {
                                        "price": price,
                                        "change": round(change, 2),
                                        "change_percent": round(change_p, 2),
                                    }
                                
                                if update_batch:
                                    await self.manager.broadcast({
                                        "type": "price_update",
                                        "data": update_batch
                                    })
                        
                        except Exception as e:
                            logger.error(f"Error processing message: {e}")
            
            except Exception as e:
                self.ws_connected = False
                self.consecutive_failures += 1
                
                error_msg = str(e)
                
                # ============================================
                # HANDLE 429 (Rate Limit) SPECIFICALLY
                # ============================================
                if "429" in error_msg or "HTTP 429" in error_msg:
                    logger.error(f"🚨 Finnhub rate limit hit (HTTP 429). Backing off significantly...")
                    self.last_429_time = datetime.now()
                    self.reconnect_attempts = min(self.reconnect_attempts + 5, self.max_reconnect_attempts)
                
                # ============================================
                # HANDLE OTHER ERRORS
                # ============================================
                else:
                    logger.error(f"Finnhub connection dropped: {e}")
                    self.reconnect_attempts = min(self.reconnect_attempts + 1, self.max_reconnect_attempts)
                
                # ============================================
                # STOP TRYING AFTER TOO MANY FAILURES
                # ============================================
                if self.consecutive_failures >= self.max_reconnect_attempts:
                    logger.error(f"❌ Failed to connect {self.max_reconnect_attempts} times. Giving up on WebSocket.")
                    logger.info("💡 Falling back to HTTP-only mode. Live prices disabled.")
                    break

    def _get_prev_close(self, symbol):
        """Helper to get previous close from cache."""
        cache = self.fundamental_cache.get(symbol, {})
        history = cache.get("history", pd.DataFrame())
        
        if not history.empty and "Close" in history:
            return history["Close"].iloc[-1]
        return None

    def _fundamental_loop(self):
        """Runs in a separate thread. Fetches Yahoo Finance data every 1 hour."""
        while self.running:
            logger.info("Fetching atomic fundamentals (Yahoo)...")
            
            if not self.symbols:
                time.sleep(10)
                continue
            
            try:
                # Fetch history for RSI calculation
                history_data = yf.download(
                    self.symbols,
                    period="1mo",
                    interval="1d",
                    group_by="ticker",
                    threads=False,
                    progress=False,
                    auto_adjust=True
                )
                
                for sym in self.symbols:
                    try:
                        # Extract history
                        if len(self.symbols) > 1:
                            sym_hist = history_data[sym] if sym in history_data else pd.DataFrame()
                        else:
                            sym_hist = history_data
                        
                        # Get ticker object
                        ticker = yf.Ticker(sym)
                        
                        try:
                            # Get all metrics
                            fast_info = ticker.fast_info
                            market_cap = fast_info.market_cap if hasattr(fast_info, "market_cap") else None
                            prev_close = fast_info.previous_close if hasattr(fast_info, "previous_close") else None
                            
                            info = ticker.info
                            
                            pe_ratio = info.get("trailingPE")
                            pb_ratio = info.get("priceToBook")
                            peg_ratio = info.get("pegRatio")
                            dividend_yield = info.get("dividendYield")
                            
                            roe = info.get("returnOnEquity")
                            roa = info.get("returnOnAssets")
                            
                            debt_to_equity = info.get("debtToEquity")
                            current_ratio = info.get("currentRatio")
                            quick_ratio = info.get("quickRatio")
                            
                            gross_margin = info.get("grossMargins")
                            operating_margin = info.get("operatingMargins")
                            profit_margin = info.get("profitMargins")
                            
                            revenue_growth = info.get("revenueGrowth")
                            earnings_growth = info.get("earningsGrowth")
                            
                            volume = info.get("volume")
                            avg_volume = info.get("averageVolume")
                            beta = info.get("beta")
                            
                            week52_high = info.get("fiftyTwoWeekHigh")
                            week52_low = info.get("fiftyTwoWeekLow")
                        
                        except Exception as e:
                            logger.warning(f"Failed to get metrics for {sym}: {e}")
                            market_cap = prev_close = pe_ratio = pb_ratio = peg_ratio = None
                            dividend_yield = roe = roa = debt_to_equity = current_ratio = None
                            quick_ratio = gross_margin = operating_margin = profit_margin = None
                            revenue_growth = earnings_growth = volume = avg_volume = beta = None
                            week52_high = week52_low = None
                        
                        # Calculate RSI
                        rsi_val = self._calculate_rsi(sym_hist, prev_close)
                        
                        # Store in cache
                        self.fundamental_cache[sym] = {
                            "history": sym_hist,
                            "constants": {
                                "market_cap": market_cap,
                                "prev_close": prev_close,
                                "sector": "Unknown",
                                "pe_ratio": pe_ratio,
                                "pb_ratio": pb_ratio,
                                "peg_ratio": peg_ratio,
                                "dividend_yield": dividend_yield,
                                "roe": roe,
                                "roa": roa,
                                "debt_to_equity": debt_to_equity,
                                "current_ratio": current_ratio,
                                "quick_ratio": quick_ratio,
                                "gross_margin": gross_margin,
                                "operating_margin": operating_margin,
                                "profit_margin": profit_margin,
                                "revenue_growth": revenue_growth,
                                "earnings_growth": earnings_growth,
                                "volume": volume,
                                "avg_volume": avg_volume,
                                "beta": beta,
                                "52week_high": week52_high,
                                "52week_low": week52_low,
                                "rsi": round(rsi_val, 2) if rsi_val else None,
                            }
                        }
                        
                        time.sleep(0.5)  # Rate limiting
                    
                    except Exception as e:
                        logger.error(f"Failed to process {sym}: {e}")
                
                self._save_cache()
                logger.info("Fundamentals updated successfully.")
                time.sleep(3600)  # Sleep for 1 hour
            
            except Exception as e:
                logger.error(f"Global fetch failed: {e}")
                time.sleep(60)

    def _calculate_rsi(self, history, current_price):
        """Calculates 14-day RSI."""
        if history.empty or "Close" not in history:
            return None
        
        try:
            closes = history["Close"].tolist()
            if current_price:
                closes.append(current_price)
            
            series = pd.Series(closes)
            delta = series.diff()
            
            gain = delta.where(delta > 0, 0).rolling(window=14).mean()
            loss = -delta.where(delta < 0, 0).rolling(window=14).mean()
            
            rs = gain / loss
            rsi = 100 - (100 / (1 + rs))
            
            return rsi.iloc[-1]
        except:
            return None

    def get_snapshot(self, requested_symbols):
        """Returns the full state for the initial REST load."""
        response = {}
        
        for sym in requested_symbols:
            cache = self.fundamental_cache.get(sym, {})
            constants = cache.get("constants", {})
            
            price = self.live_prices.get(sym)
            if not price:
                price = constants.get("prev_close", 0.0)
            
            prev_close = constants.get("prev_close", 0.0)
            change = 0.0
            change_p = 0.0
            
            if prev_close and price:
                change = price - prev_close
                change_p = (change / prev_close) * 100
            
            response[sym] = {
                "symbol": sym,
                "name": sym,
                "price": price,
                "change": round(change, 2),
                "change_percent": round(change_p, 2),
                "sector": constants.get("sector", "Unknown"),
                "market_cap": constants.get("market_cap"),
                "pe_ratio": constants.get("pe_ratio"),
                "price_to_book": constants.get("pb_ratio"),
                "peg_ratio": constants.get("peg_ratio"),
                "dividend_yield": constants.get("dividend_yield"),
                "roe": constants.get("roe"),
                "roa": constants.get("roa"),
                "debt_to_equity": constants.get("debt_to_equity"),
                "current_ratio": constants.get("current_ratio"),
                "quick_ratio": constants.get("quick_ratio"),
                "gross_margin": constants.get("gross_margin"),
                "operating_margin": constants.get("operating_margin"),
                "profit_margin": constants.get("profit_margin"),
                "revenue_growth": constants.get("revenue_growth"),
                "earnings_growth": constants.get("earnings_growth"),
                "volume": constants.get("volume"),
                "avg_volume": constants.get("avg_volume"),
                "beta": constants.get("beta"),
                "52week_high": constants.get("52week_high"),
                "52week_low": constants.get("52week_low"),
                "rsi": constants.get("rsi"),
            }
        
        return response

    def get_chart_data(self, symbol, timeframe="1M"):
        """
        Returns historical price data for charting.
        Timeframe: 1D, 1W, 1M, 3M, 1Y, 5Y
        """
        try:
            cache = self.fundamental_cache.get(symbol, {})
            history = cache.get("history")
            
            if history is None or history.empty:
                return []
            
            # Calculate cutoff date based on timeframe
            today = pd.Timestamp.today()
            timeframe_days = {
                "1D": 1,
                "1W": 7,
                "1M": 30,
                "3M": 90,
                "1Y": 365,
                "5Y": 1825
            }
            
            days = timeframe_days.get(timeframe, 30)
            cutoff_date = today - timedelta(days=days)
            
            # Filter history by date
            filtered = history[history.index >= cutoff_date].copy()
            
            # Convert to list of dicts for JSON serialization
            result = []
            for date, row in filtered.iterrows():
                result.append({
                    "date": date.strftime("%Y-%m-%d"),
                    "timestamp": int(date.timestamp() * 1000),  # milliseconds for chart libraries
                    "open": round(float(row.get("Open", 0)), 2),
                    "high": round(float(row.get("High", 0)), 2),
                    "low": round(float(row.get("Low", 0)), 2),
                    "close": round(float(row.get("Close", 0)), 2),
                    "volume": int(row.get("Volume", 0)) if "Volume" in row else 0
                })
            
            return result
        except Exception as e:
            logger.error(f"Error getting chart data for {symbol}: {e}")
            return []
