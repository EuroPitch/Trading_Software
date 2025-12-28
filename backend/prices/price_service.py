import websocket
import json
import threading
import time
import os
import requests
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
        
        # Load cache from disk if it exists
        self.fundamental_cache = self._load_cache()
        
        self.live_prices = {}
        self.ws = None
        self.running = False

    def _load_symbols(self):
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

    def start(self):
        self.running = True
        # Thread 1: Fundamentals (Sequential, gentle)
        t_fund = threading.Thread(target=self._fundamental_loop, daemon=True)
        t_fund.start()
        
        # Thread 2: Websockets
        t_ws = threading.Thread(target=self._websocket_loop, daemon=True)
        t_ws.start()

    def _fundamental_loop(self):
        while self.running:
            logger.info("Fetching atomic fundamentals...")
            
            # 1. Create a Session to look like a browser
            session = requests.Session()
            session.headers.update({
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            })

            try:
                # 2. Sequential Download (Gentler on API and RAM)
                # We fetch 5 days just for RSI.
                # If this fails, we catch it.
                history = yf.download(
                    self.symbols, 
                    period="5d", 
                    interval="1d", 
                    group_by='ticker', 
                    threads=False, # CRITICAL: Disable threads to avoid 429
                    progress=False,
                    auto_adjust=True
                    # session=session # Not supported in all versions, rely on global requests patch if needed
                )
                
                for sym in self.symbols:
                    try:
                        # Handle DataFrame structure
                        if len(self.symbols) > 1:
                            sym_hist = history[sym] if sym in history else pd.DataFrame()
                        else:
                            sym_hist = history

                        # Fetch Ticker Info (This is the risky part that gets blocked)
                        # We wrap it in a try-except and fallback to Finnhub if needed
                        ticker = yf.Ticker(sym)
                        info = {}
                        try:
                            info = ticker.fast_info # Prefer fast_info over .info
                        except:
                            pass
                        
                        # --- FALLBACK: If Yahoo returns garbage, try Finnhub REST for Price ---
                        current_price = 0.0
                        try:
                             # Try Yahoo first
                            current_price = info.get('last_price', 0.0)
                            if current_price == 0.0:
                                # Fallback to Finnhub Quote
                                r = requests.get(f"https://finnhub.io/api/v1/quote?symbol={sym}&token={self.api_key}")
                                if r.status_code == 200:
                                    q = r.json()
                                    current_price = q.get('c', 0.0) # 'c' is current price
                                    # Update live prices immediately
                                    self.live_prices[sym] = current_price
                        except:
                            pass

                        existing = self.fundamental_cache.get(sym, {})
                        existing_constants = existing.get('constants', {})
                        
                        # Merge logic
                        new_constants = {
                            "market_cap_static": info.get('market_cap', existing_constants.get('market_cap_static')),
                            "shares_outstanding": info.get('shares', existing_constants.get('shares_outstanding')),
                            # Add other fields as needed, keeping existing if new fetch fails
                            "long_name": existing_constants.get('long_name', sym),
                            "sector": existing_constants.get('sector', "Unknown")
                        }

                        self.fundamental_cache[sym] = {
                            'history': sym_hist,
                            'constants': new_constants,
                            'raw_info': {'currentPrice': current_price} # Store price here
                        }
                        
                    except Exception as e:
                        logger.error(f"Error processing {sym}: {e}")

                self._save_cache()
                logger.info("Fundamentals updated successfully.")

            except Exception as e:
                logger.error(f"Global fetch failed: {e}")
            
            # Sleep 15 mins
            time.sleep(900)

    def _websocket_loop(self):
        websocket.enableTrace(False)
        ws_url = f"wss://ws.finnhub.io?token={self.api_key}"
        
        def on_message(ws, message):
            try:
                data = json.loads(message)
                if data['type'] == 'trade':
                    for trade in data['data']:
                        self.live_prices[trade['s']] = trade['p']
            except:
                pass

        def on_close(ws, status, msg):
            logger.warning("Websocket closed. Reconnecting in 10s...")
            time.sleep(10) # Increase from 5s to 10s
            if self.running:
                self._websocket_loop()

        def on_error(ws, error):
            logger.error(f"Websocket Error: {error}")
            # If it's a 429, wait longer!
            if "429" in str(error):
                logger.warning("Rate limited! Cooling down for 60s...")
                time.sleep(60) 


        def on_open(ws):
            logger.info("Websocket connected.")
            for sym in self.symbols:
                ws.send(json.dumps({"type": "subscribe", "symbol": sym}))
                time.sleep(0.05)
        
        self.ws = websocket.WebSocketApp(
            ws_url, 
            on_message=on_message, 
            on_error=on_error, 
            on_close=on_close, 
            on_open=on_open
        )
        self.ws.run_forever(ping_interval=30, ping_timeout=10)

    def calculate_rsi(self, history, current_price):
        if history.empty: return None
        try:
            # Simple RSI
            closes = history['Close'].tolist()
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

    def get_quotes(self, requested_symbols):
        response = {}
        for sym in requested_symbols:
            cache = self.fundamental_cache.get(sym)
            
            # --- SAFETY FOR INITIAL LOAD ---
            if cache is None:
                # If we have a live price from WS/Finnhub, use it even if cache is empty
                price = self.live_prices.get(sym, 0.0)
                response[sym] = {
                    "symbol": sym,
                    "name": sym,
                    "price": price,
                    "change": 0.0,
                    "change_percent": 0.0,
                    "sector": "Loading..." if price == 0.0 else "Updating...",
                    "market_cap": None,
                    "pe_ratio": None,
                    "rsi": None
                }
                continue

            constants = cache.get('constants', {})
            history = cache.get('history', pd.DataFrame())
            raw_info = cache.get('raw_info', {})

            # Price Priority: Live WS -> Finnhub REST (stored in raw_info) -> 0
            live_price = self.live_prices.get(sym)
            if not live_price:
                live_price = raw_info.get('currentPrice', 0.0)
            
            # Calc RSI
            rsi_val = None
            if live_price and not history.empty:
                rsi_val = self.calculate_rsi(history, live_price)

            # Calc Market Cap
            mc = constants.get('market_cap_static')
            if live_price and constants.get('shares_outstanding'):
                mc = live_price * constants.get('shares_outstanding')

            response[sym] = {
                "symbol": sym,
                "name": constants.get("long_name", sym),
                "sector": constants.get("sector", "Unknown"),
                "price": live_price,
                "change": 0.0, # You can calculate this if you store prev close
                "change_percent": 0.0,
                "market_cap": mc,
                "pe_ratio": None, # Hard to get without reliable EPS
                "rsi": rsi_val,
                # ... add other fields as needed ...
            }
            
        return response