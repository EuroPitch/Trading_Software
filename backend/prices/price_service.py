import websocket
import json
import threading
import time
import os
import yfinance as yf
import pandas as pd
import logging
import pickle

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("PriceService")

# Cache file path
CACHE_FILE = "fundamentals_cache.pkl"

class PriceService:
    def __init__(self, universe_file="universe.json"):
        self.api_key = os.getenv("FINNHUB_KEY")
        if not self.api_key:
            logger.warning("Oi! You forgot the FINNHUB_KEY. We're flying blind here mate.")
        
        self.universe_file = universe_file
        self.symbols = self._load_symbols()
        
        # Load cache from disk if it exists (Instant boot!)
        self.fundamental_cache = self._load_cache()
        
        self.live_prices = {}
        self.ws = None
        self.running = False

    def _load_symbols(self):
        """Parses the universe.json to get the list of tickers."""
        try:
            base = os.path.dirname(__file__)
            path = os.path.join(base, self.universe_file)
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
        """Loads the last known good data so we don't start empty."""
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, "rb") as f:
                    logger.info("Loaded cached fundamentals from disk. Speedy!")
                    return pickle.load(f)
            except Exception:
                logger.warning("Cache file corrupted or unreadable. Starting fresh.")
                pass
        return {}

    def _save_cache(self):
        """Saves good data to disk."""
        try:
            with open(CACHE_FILE, "wb") as f:
                pickle.dump(self.fundamental_cache, f)
        except Exception as e:
            logger.error(f"Failed to save cache: {e}")

    def start(self):
        """Starts the background threads."""
        self.running = True
        
        # Thread 1: The Heavy Lifter (Fundamentals + History)
        t_fund = threading.Thread(target=self._fundamental_loop, daemon=True)
        t_fund.start()
        
        # Thread 2: The Speed Demon (Websockets)
        t_ws = threading.Thread(target=self._websocket_loop, daemon=True)
        t_ws.start()

    def _fundamental_loop(self):
        """
        The 'Slow' Loop. 
        Fetches heavy data from yfinance every 15 minutes.
        """
        while self.running:
            logger.info("Fetching atomic fundamentals... grab a cold one, this takes a sec.")
            try:
                # 1. Fetch History for RSI (Batch download is faster)
                history = yf.download(
                    self.symbols, 
                    period="1mo", 
                    interval="1d", 
                    group_by='ticker', 
                    threads=True, 
                    progress=False, 
                    auto_adjust=True
                )
                
                for sym in self.symbols:
                    try:
                        # Handle MultiIndex DataFrame (when >1 symbol) vs Single Index
                        if len(self.symbols) > 1:
                            sym_hist = history[sym]
                        else:
                            sym_hist = history
                        
                        # 2. Fetch Detailed Info via Ticker object
                        ticker = yf.Ticker(sym)
                        
                        # Fallback logic for info
                        info = {}
                        try:
                            info = ticker.info
                        except:
                            pass 
                        
                        # Grab existing cache to use as fallback if Yahoo fails this time
                        existing = self.fundamental_cache.get(sym, {})
                        existing_constants = existing.get('constants', {})
                        
                        # Helper to safely grab a field: 
                        # Priority: New Info -> Old Cache -> Default
                        def get_const(key, default=None):
                            val = info.get(key)
                            if val is not None: return val
                            return existing_constants.get(key, default)

                        new_constants = {
                            # --- Core Metrics ---
                            "shares_outstanding": ticker.fast_info.get('shares', existing_constants.get('shares_outstanding')),
                            "market_cap_static": ticker.fast_info.get('market_cap', existing_constants.get('market_cap_static')),
                            "eps_ttm": info.get('trailingEps') or existing_constants.get('eps_ttm'),
                            
                            # --- Advanced Ratios (The "Missing" Ones) ---
                            "peg_ratio": get_const('pegRatio'),
                            "quick_ratio": get_const('quickRatio'),
                            "current_ratio": get_const('currentRatio'),
                            "debt_to_equity": get_const('debtToEquity'),
                            "return_on_equity": get_const('returnOnEquity'),
                            "return_on_assets": get_const('returnOnAssets'),
                            "revenue_growth": get_const('revenueGrowth'),
                            "operating_margins": get_const('operatingMargins'),
                            "gross_margins": get_const('grossMargins'),
                            "price_to_book": get_const('priceToBook'),
                            
                            # --- Volume & Dividends ---
                            "avg_volume": get_const('averageVolume'),
                            "avg_volume_10day": get_const('averageDailyVolume10Day'),
                            # Force 0.0 if missing, implies no dividend
                            "dividend_rate": info.get('dividendRate') or existing_constants.get('dividend_rate') or 0.0,
                            
                            # --- Metadata ---
                            "beta": get_const('beta'),
                            "sector": get_const('sector', "Unknown"),
                            "long_name": get_const('longName', sym),
                            "currency": get_const('currency', "USD"),
                            "52_week_high": get_const('fiftyTwoWeekHigh'),
                            "52_week_low": get_const('fiftyTwoWeekLow'),
                        }

                        self.fundamental_cache[sym] = {
                            'history': sym_hist,
                            'constants': new_constants,
                            # Store raw info just in case, but rely on constants for math
                            'raw_info': info 
                        }
                    except Exception as e:
                        logger.error(f"Failed to fetch fundamentals for {sym}: {e}")
                
                # Checkpoint to disk after a successful run
                self._save_cache()

            except Exception as e:
                logger.error(f"Global fundamental fetch failed: {e}")
            
            # Sleep for 15 minutes (900 seconds)
            time.sleep(900)

    def _websocket_loop(self):
        """The 'Fast' Loop. Connects to Finnhub WS."""
        # Disable verbose logs for production
        websocket.enableTrace(False)
        ws_url = f"wss://ws.finnhub.io?token={self.api_key}"
        
        def on_message(ws, message):
            try:
                data = json.loads(message)
                if data['type'] == 'trade':
                    for trade in data['data']:
                        # Update the live price dictionary
                        self.live_prices[trade['s']] = trade['p']
            except:
                pass # Silent fail on malformed packets

        def on_error(ws, error):
            logger.error(f"Websocket Error: {error}")

        def on_close(ws, status, msg):
            logger.warning("Websocket closed. Reconnecting in 5s...")
            time.sleep(5)
            if self.running:
                self._websocket_loop()

        def on_open(ws):
            logger.info("Websocket connected! Subscribing...")
            for sym in self.symbols:
                ws.send(json.dumps({"type": "subscribe", "symbol": sym}))
                time.sleep(0.05) # Rate limit protection
        
        self.ws = websocket.WebSocketApp(
            ws_url, 
            on_message=on_message, 
            on_error=on_error, 
            on_close=on_close, 
            on_open=on_open
        )
        # Ping every 30s to keep connection alive
        self.ws.run_forever(ping_interval=30, ping_timeout=10)

    def calculate_rsi(self, history, current_price):
        """Helper to calculate live RSI."""
        if history.empty: return None
        try:
            # Copy to avoid SettingWithCopy warnings
            temp_hist = history['Close'].copy()
            # Update/Append today's price
            temp_hist.loc[pd.Timestamp.now()] = current_price
            
            delta = temp_hist.diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
            rs = gain / loss
            rsi = 100 - (100 / (1 + rs))
            return rsi.iloc[-1]
        except Exception:
            return None

    def get_quotes(self, requested_symbols):
        """Constructs the combined response object."""
        response = {}
        for sym in requested_symbols:
            # 1. Get Data from Cache
            cache = self.fundamental_cache.get(sym)

            # --- SAFETY CHECK: WARMING UP ---
            if cache is None:
                # We have zero data yet. Return a "Loading" skeleton.
                response[sym] = {
                    "symbol": sym,
                    "name": sym,
                    "price": 0.0,
                    "change": 0.0,
                    "change_percent": 0.0,
                    "sector": "Loading...",
                    # Fill essential fields with None to prevent frontend crashing on undefined
                    "market_cap": None,
                    "pe_ratio": None,
                    "rsi": None
                }
                continue

            constants = cache.get('constants', {})
            history = cache.get('history', pd.DataFrame())
            raw_info = cache.get('raw_info', {})

            # 2. Determine Live Price
            # Priority: Live WS -> Yahoo Cache -> Yahoo Previous Close -> 0
            live_price = self.live_prices.get(sym, raw_info.get('currentPrice'))
            if not live_price:
                live_price = raw_info.get('previousClose', 0.0)

            # 3. Dynamic Metric Calculation
            
            # PE Ratio = Price / EPS
            pe_ratio = None
            eps = constants.get('eps_ttm')
            if live_price and eps:
                pe_ratio = live_price / eps

            # Market Cap = Price * Shares
            market_cap = constants.get('market_cap_static') 
            shares = constants.get('shares_outstanding')
            if live_price and shares:
                market_cap = live_price * shares
            
            # Dividend Yield = Rate / Price
            div_yield = 0.0
            div_rate = constants.get('dividend_rate')
            if live_price and div_rate:
                div_yield = div_rate / live_price

            # RSI
            rsi_val = None
            if live_price and not history.empty:
                rsi_val = self.calculate_rsi(history, live_price)

            # Change Calculation
            prev_close = raw_info.get("previousClose") or live_price
            change = live_price - prev_close if live_price else 0
            change_p = (change / prev_close) * 100 if prev_close else 0

            # 4. Final Object Construction
            response[sym] = {
                "symbol": sym,
                "name": constants.get("long_name", sym),
                "sector": constants.get("sector", "Unknown"),
                "currency": constants.get("currency", "USD"),
                
                # --- Price Data ---
                "price": live_price,
                "previous_close": prev_close,
                "change": change,
                "change_percent": change_p,
                "day_high": max(raw_info.get("dayHigh", -1), live_price) if live_price else None,
                "day_low": min(raw_info.get("dayLow", 999999), live_price) if live_price else None,
                "volume": raw_info.get("volume"), 
                "avg_volume": constants.get("avg_volume"),
                
                # --- Valuation Metrics ---
                "market_cap": market_cap,
                "pe_ratio": pe_ratio,
                "peg_ratio": constants.get("peg_ratio"),
                "price_to_book": constants.get("price_to_book"),
                "dividend_yield": div_yield,
                "eps_ttm": eps,
                
                # --- Financial Health ---
                "quick_ratio": constants.get("quick_ratio"),
                "current_ratio": constants.get("current_ratio"),
                "debt_to_equity": constants.get("debt_to_equity"),
                "roe": constants.get("return_on_equity"),
                "roa": constants.get("return_on_assets"),
                "operating_margin": constants.get("operating_margins"),
                "revenue_growth": constants.get("revenue_growth"),
                
                # --- Technicals ---
                "rsi": rsi_val,
                "beta": constants.get("beta"),
                "52_week_high": constants.get("52_week_high"),
                "52_week_low": constants.get("52_week_low"),
            }
            
        return response