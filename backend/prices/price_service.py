import websocket
import json
import threading
import time
import os
import yfinance as yf
import pandas as pd
import logging

# Setup logging so we know if Garry tripped over the server cable again
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("PriceService")

class PriceService:
    def __init__(self, universe_file="universe.json"):
        self.api_key = os.getenv("FINNHUB_KEY")
        if not self.api_key:
            logger.warning("Oi! You forgot the FINNHUB_KEY. We're flying blind here mate.")
        
        self.universe_file = universe_file
        self.symbols = self._load_symbols()
        
        # This dict holds the "Slow" data (Fundamentals + History)
        # Structure: { 'AAPL': { 'info': {...}, 'history': pd.DataFrame(...) } }
        self.fundamental_cache = {}
        
        # This dict holds the "Fast" data (Live Price) from Websocket
        # Structure: { 'AAPL': 150.23 }
        self.live_prices = {}
        
        self.ws = None
        self.running = False

    def _load_symbols(self):
        """Loads the tickers from your universe.json file."""
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

    def start(self):
        """Kicks off the background threads."""
        self.running = True
        
        # 1. Start the slow loop (Fundamentals)
        t_fund = threading.Thread(target=self._fundamental_loop, daemon=True)
        t_fund.start()
        
        # 2. Start the fast loop (Websocket)
        t_ws = threading.Thread(target=self._websocket_loop, daemon=True)
        t_ws.start()

    def _fundamental_loop(self):
        """Fetches heavy data from yfinance every 15 minutes."""
        while self.running:
            logger.info("Fetching fundamental data... grab a cold one, this takes a sec.")
            try:
                # We fetch history for RSI calc (1mo is plenty)
                # Group by ticker ensures we get a MultiIndex DF if >1 symbol
                history = yf.download(self.symbols, period="1mo", interval="1d", group_by='ticker', threads=True, progress=False, auto_adjust=True)
                
                for sym in self.symbols:
                    try:
                        # Extract history for this specific symbol
                        if len(self.symbols) > 1:
                            sym_hist = history[sym]
                        else:
                            sym_hist = history
                        
                        # Fetch basic info (Sector, PE, etc)
                        # Note: yf.Ticker(sym).info can be slow, might want to optimize or cache longer
                        ticker_obj = yf.Ticker(sym)
                        info = ticker_obj.info
                        
                        self.fundamental_cache[sym] = {
                            'history': sym_hist,
                            'info': info
                        }
                    except Exception as e:
                        logger.error(f"Failed to fetch fundamentals for {sym}: {e}")
            
            except Exception as e:
                logger.error(f"Global fundamental fetch failed: {e}")
            
            # Sleep for 15 minutes (900 seconds)
            time.sleep(900)

    def _websocket_loop(self):
        """Maintains the Finnhub connection."""
        websocket.enableTrace(False)  # Make True if I want to have a look at connections
        
        ws_url = f"wss://ws.finnhub.io?token={self.api_key}"
        
        def on_message(ws, message):
            try:
                data = json.loads(message)
                if data['type'] == 'trade':
                    for trade in data['data']:
                        sym = trade['s']
                        price = trade['p']
                        # Update the live price
                        self.live_prices[sym] = price
            except Exception as e:
                logger.error(f"WS Message Error: {e}")

        def on_error(ws, error):
            logger.error(f"Websocket Error: {error}")

        def on_close(ws, close_status_code, close_msg):
            logger.warning("Websocket closed. Reconnecting in 5s...")
            time.sleep(5)
            # Recursion is dangerous but efficient here for simple reconnects
            if self.running:
                self._websocket_loop()

        def on_open(ws):
            logger.info("Websocket connected! Subscribing to the lot.")
            for sym in self.symbols:
                # Finnhub expects specific format
                ws.send(json.dumps({"type": "subscribe", "symbol": sym}))
                # ws.send(json.dumps({"type": "subscribe", "symbol": "BINANCE:BTCUSDT"})) # In case we're testing over the weekend again
                # Sleep 50ms between subs so we don't choke the socket
                time.sleep(0.05)

        self.ws = websocket.WebSocketApp(
            ws_url,
            on_message=on_message,
            on_error=on_error,
            on_close=on_close,
            on_open=on_open
        )
        self.ws.run_forever()

    def calculate_metrics(self, history, current_price):
        """
        Your helper function logic. 
        Calculates RSI based on history + latest live price.
        """
        if history.empty:
            return None

        # Append the current live price as a new row (or update today's row) to calculate 'live' RSI
        # This is a bit of a hack but works for live RSI
        temp_hist = history['Close'].copy()
        
        # Create a new timestamp for 'now' if it doesn't exist, or update the last one
        # For simplicity, we just append to the series
        temp_hist.loc[pd.Timestamp.now()] = current_price
        
        # Calculate RSI (14 period)
        delta = temp_hist.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        
        return rsi.iloc[-1]

    def get_quotes(self, requested_symbols):
        """Returns the merged data object for the API."""
        response = {}
        
        for sym in requested_symbols:
            # 1. Get Static Data
            fund_data = self.fundamental_cache.get(sym, {})
            info = fund_data.get('info', {})
            history = fund_data.get('history', pd.DataFrame())
            
            # 2. Get Live Price (fallback to yfinance close if WS hasn't sent data yet)
            live_price = self.live_prices.get(sym, info.get('currentPrice'))
            
            # 3. Calculate dynamic metrics
            rsi_val = None
            if live_price and not history.empty:
                rsi_val = self.calculate_metrics(history, live_price)

            # 4. Construct the final object (matching your frontend interface)
            response[sym] = {
                "symbol": sym,
                "name": info.get("longName") or info.get("shortName") or sym,
                "sector": info.get("sector"),
                "price": live_price, # Simple logic: if live price > cached high, update it.
                "day_high": max(info.get("dayHigh", -1), live_price) if live_price else info.get("dayHigh"),
                "day_low": min(info.get("dayLow", 999999), live_price) if live_price else info.get("dayLow"),
                "open": info.get("regularMarketOpen"),
                "previous_close": info.get("previousClose"),
                "volume": info.get("volume"), # WS sends volume too, could update this
                "market_cap": info.get("marketCap"),
                "pe_ratio": info.get("trailingPE"),
                "rsi": rsi_val,
            }
            
        return response