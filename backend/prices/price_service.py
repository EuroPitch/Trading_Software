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

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("PriceService")

CACHE_FILE = "fundamentals_cache.pkl"

class ConnectionManager:
    """
    Manages the websocket connections to your frontend clients (React).
    """
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
        """
        Broadcasts a JSON message to all connected clients.
        Removes dead connections automatically.
        """
        json_msg = json.dumps(message)
        # Iterate over a copy to avoid modification issues during iteration
        for connection in self.active_connections[:]:
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
        
        # Load cache from disk if it exists
        self.fundamental_cache = self._load_cache()
        self.live_prices = {} # {symbol: price}
        
        # The Manager handles your frontend clients
        self.manager = ConnectionManager()
        self.running = False

    def _load_symbols(self):
        try:
            base = os.path.dirname(__file__)
            path = os.path.join(base, self.universe_file)
            if not os.path.exists(path):
                 # Fallback if file not found (e.g. running from different dir)
                 return []
                 
            with open(path, "r") as f:
                data = json.load(f)
            tickers = []
            for sector in data['sectors'].values():
                for stock in sector['stocks']:
                    tickers.append(stock['ticker'])
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
        
        # 1. Start Fundamentals in a background thread (Blocking IO)
        t_fund = threading.Thread(target=self._fundamental_loop, daemon=True)
        t_fund.start()

        # 2. Start the Async Websocket Consumer (Non-blocking)
        asyncio.create_task(self._upstream_websocket_loop())

    async def _upstream_websocket_loop(self):
        """Connects to Finnhub and pushes data to the Manager."""
        uri = f"wss://ws.finnhub.io?token={self.api_key}"
        
        while self.running:
            try:
                logger.info("Connecting to Finnhub WS...")
                async with websockets.connect(uri) as ws:
                    logger.info("Connected to Finnhub.")
                    
                    # Subscribe to all symbols
                    for sym in self.symbols:
                        await ws.send(json.dumps({"type": "subscribe", "symbol": sym}))
                    
                    # Listen for messages
                    async for message in ws:
                        try:
                            data = json.loads(message)
                            if data['type'] == 'trade':
                                # Update internal state
                                update_batch = {}
                                for trade in data['data']:
                                    sym = trade['s']
                                    price = trade['p']
                                    self.live_prices[sym] = price
                                    
                                    # Calculate change % on the fly if we have yesterday's close
                                    prev_close = self._get_prev_close(sym)
                                    change = 0.0
                                    change_p = 0.0
                                    if prev_close and prev_close > 0:
                                        change = price - prev_close
                                        change_p = (change / prev_close) * 100

                                    update_batch[sym] = {
                                        "price": price,
                                        "change": round(change, 2),
                                        "change_percent": round(change_p, 2)
                                    }
                                
                                # BROADCAST TO FRONTEND IMMEDIATELY
                                if update_batch:
                                    await self.manager.broadcast({
                                        "type": "price_update",
                                        "data": update_batch
                                    })
                        except Exception as e:
                            logger.error(f"Error processing message: {e}")
                            
            except Exception as e:
                logger.error(f"Finnhub connection dropped: {e}. Reconnecting in 5s...")
                await asyncio.sleep(5)

    def _get_prev_close(self, symbol):
        """Helper to get previous close from cache."""
        cache = self.fundamental_cache.get(symbol, {})
        history = cache.get('history', pd.DataFrame())
        if not history.empty and 'Close' in history:
            # Return the last known close from history (yesterday)
            return history['Close'].iloc[-1]
        return None

    def _fundamental_loop(self):
        """
        Runs in a separate thread. Fetches Yahoo Finance data every 1 hour.
        """
        while self.running:
            logger.info("Fetching atomic fundamentals (Yahoo)...")
            if not self.symbols:
                time.sleep(10)
                continue

            try:
                # 1. Fetch History for RSI (Lightweight)
                history_data = yf.download(
                    self.symbols,
                    period="1mo",
                    interval="1d",
                    group_by='ticker',
                    threads=False,
                    progress=False,
                    auto_adjust=True
                )

                for sym in self.symbols:
                    try:
                        # Extract History
                        if len(self.symbols) > 1:
                            sym_hist = history_data[sym] if sym in history_data else pd.DataFrame()
                        else:
                            sym_hist = history_data

                        # Get ticker object
                        ticker = yf.Ticker(sym)
                        
                        # ✅ Get ALL the metrics we need
                        try:
                            # Fast info (lightweight)
                            fast_info = ticker.fast_info
                            market_cap = fast_info.market_cap if hasattr(fast_info, 'market_cap') else None
                            prev_close = fast_info.previous_close if hasattr(fast_info, 'previous_close') else None
                            
                            # Full info (slower but has more data)
                            info = ticker.info
                            
                            # Financial metrics
                            pe_ratio = info.get('trailingPE')
                            pb_ratio = info.get('priceToBook')
                            peg_ratio = info.get('pegRatio')
                            dividend_yield = info.get('dividendYield')
                            
                            # Profitability metrics
                            roe = info.get('returnOnEquity')
                            roa = info.get('returnOnAssets')
                            
                            # Debt metrics
                            debt_to_equity = info.get('debtToEquity')
                            current_ratio = info.get('currentRatio')
                            quick_ratio = info.get('quickRatio')
                            
                            # Margins
                            gross_margin = info.get('grossMargins')
                            operating_margin = info.get('operatingMargins')
                            profit_margin = info.get('profitMargins')
                            
                            # Growth metrics
                            revenue_growth = info.get('revenueGrowth')
                            earnings_growth = info.get('earningsGrowth')
                            
                            # Volume and volatility
                            volume = info.get('volume')
                            avg_volume = info.get('averageVolume')
                            beta = info.get('beta')
                            
                            # 52-week range
                            week_52_high = info.get('fiftyTwoWeekHigh')
                            week_52_low = info.get('fiftyTwoWeekLow')
                            
                        except Exception as e:
                            logger.warning(f"Failed to get metrics for {sym}: {e}")
                            # Set defaults
                            market_cap = prev_close = pe_ratio = pb_ratio = peg_ratio = None
                            dividend_yield = roe = roa = debt_to_equity = current_ratio = None
                            quick_ratio = gross_margin = operating_margin = profit_margin = None
                            revenue_growth = earnings_growth = volume = avg_volume = beta = None
                            week_52_high = week_52_low = None

                        # Pre-calculate RSI
                        rsi_val = self.calculate_rsi(sym_hist, prev_close)

                        # ✅ Store ALL metrics in cache
                        self.fundamental_cache[sym] = {
                            'history': sym_hist,
                            'constants': {
                                # Basic info
                                "market_cap": market_cap,
                                "prev_close": prev_close,
                                "sector": "Unknown",  # Load from universe.json if needed
                                
                                # Valuation metrics
                                "pe_ratio": pe_ratio,
                                "pb_ratio": pb_ratio,
                                "peg_ratio": peg_ratio,
                                "dividend_yield": dividend_yield,
                                
                                # Profitability
                                "roe": roe,
                                "roa": roa,
                                
                                # Financial health
                                "debt_to_equity": debt_to_equity,
                                "current_ratio": current_ratio,
                                "quick_ratio": quick_ratio,
                                
                                # Margins
                                "gross_margin": gross_margin,
                                "operating_margin": operating_margin,
                                "profit_margin": profit_margin,
                                
                                # Growth
                                "revenue_growth": revenue_growth,
                                "earnings_growth": earnings_growth,
                                
                                # Volume and volatility
                                "volume": volume,
                                "avg_volume": avg_volume,
                                "beta": beta,
                                
                                # Price range
                                "52_week_high": week_52_high,
                                "52_week_low": week_52_low,
                                
                                # Technical indicators
                                "rsi": round(rsi_val, 2) if rsi_val else None,
                            }
                        }
                        
                        # Rate limiting
                        time.sleep(0.5)
                        
                    except Exception as e:
                        logger.error(f"Failed to process {sym}: {e}")

                self._save_cache()
                logger.info("Fundamentals updated successfully.")

                # Sleep for 1 hour
                time.sleep(3600)

            except Exception as e:
                logger.error(f"Global fetch failed: {e}")
                time.sleep(60)

    def calculate_rsi(self, history, current_price):
        """Calculates 14-day RSI."""
        if history.empty or 'Close' not in history: 
            return None
        try:
            # Append current price to history for live RSI
            closes = history['Close'].tolist()
            if current_price:
                closes.append(current_price)
            
            series = pd.Series(closes)
            delta = series.diff()
            
            gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
            
            rs = gain / loss
            rsi = 100 - (100 / (1 + rs))
            return rsi.iloc[-1]
        except:
            return None

    def get_snapshot(self, requested_symbols):
        """
        Returns the full state for the initial REST load.
        """
        response = {}
        for sym in requested_symbols:
            cache = self.fundamental_cache.get(sym, {})
            constants = cache.get('constants', {})

            # 1. Price Source: Live -> Cache -> 0
            price = self.live_prices.get(sym)
            if not price:
                price = constants.get('prev_close', 0.0)

            # 2. Calculate Change
            prev_close = constants.get('prev_close', 0.0)
            change = 0.0
            change_p = 0.0
            if prev_close and price:
                change = price - prev_close
                change_p = (change / prev_close) * 100

            # ✅ Return ALL metrics
            response[sym] = {
                # Basic info
                "symbol": sym,
                "name": sym,
                "price": price,
                "change": round(change, 2),
                "change_percent": round(change_p, 2),
                "sector": constants.get("sector", "Unknown"),
                
                # Valuation metrics
                "market_cap": constants.get("market_cap"),
                "pe_ratio": constants.get("pe_ratio"),
                "price_to_book": constants.get("pb_ratio"),
                "peg_ratio": constants.get("peg_ratio"),
                "dividend_yield": constants.get("dividend_yield"),
                
                # Profitability
                "roe": constants.get("roe"),
                "roa": constants.get("roa"),
                
                # Financial health
                "debt_to_equity": constants.get("debt_to_equity"),
                "current_ratio": constants.get("current_ratio"),
                "quick_ratio": constants.get("quick_ratio"),
                
                # Margins
                "gross_margin": constants.get("gross_margin"),
                "operating_margin": constants.get("operating_margin"),
                "profit_margin": constants.get("profit_margin"),
                
                # Growth
                "revenue_growth": constants.get("revenue_growth"),
                "earnings_growth": constants.get("earnings_growth"),
                
                # Volume and volatility
                "volume": constants.get("volume"),
                "avg_volume": constants.get("avg_volume"),
                "beta": constants.get("beta"),
                
                # Price range
                "52_week_high": constants.get("52_week_high"),
                "52_week_low": constants.get("52_week_low"),
                
                # Technical indicators
                "rsi": constants.get("rsi"),
            }

        return response