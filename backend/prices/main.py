from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os
import json

# LOAD ENV FIRST
load_dotenv()

from price_service import PriceService 

app = Flask(__name__)
CORS(app)

# Global variable placeholder
price_service = None

# ONLY initialize if we are in the reloader process (or if reloader is off)
# This prevents the "Double Garry" problem
if os.environ.get("WERKZEUG_RUN_MAIN") == "true" or os.environ.get("FLASK_ENV") == "production":
    price_service = PriceService()
    price_service.start()
else:
    print("INFO: Main process started. Waiting for reloader worker to spawn PriceService...")

@app.route("/", methods=["GET"])
def root():
    return jsonify({"status": "alive", "msg": "Garry says hello"})

@app.route("/equities/quotes", methods=["GET"])
def get_equity_quotes():
    # If request hits the wrong process (rare but possible during boot), handle gracefully
    if price_service is None:
         return jsonify({"error": "PriceService is warming up, hold your horses"}), 503

    symbols = request.args.getlist("symbols")
    if not symbols:
        return jsonify({"error": "No symbols provided"}), 400

    try:
        data = price_service.get_quotes(symbols)
        return jsonify({
            "provider": "finnhub-ws-hybrid",
            "symbols": symbols,
            "data": data
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/equities/universe", methods=["GET"])
def get_universe():
    # ... (Keep your existing universe logic here, it was fine) ...
    try:
        base = os.path.dirname(__file__)
        path = os.path.join(base, "universe.json")
        with open(path, "r") as f:
            data = json.load(f)
            
        tickers = []
        ticker_to_sector = {}
        for sector_key, sector_data in data['sectors'].items():
            sector_name = sector_data['name']
            for stock in sector_data['stocks']:
                ticker = stock['ticker']
                tickers.append(ticker)
                ticker_to_sector[ticker] = sector_name

        return jsonify({
            "symbols": tickers,
            "total_stocks": data['metadata']['total_stocks'],
            "sectors": data['sectors'],
            "metadata": data['metadata'],
            "sector_mapping": ticker_to_sector
        })
    except Exception as e:
        return jsonify({"error": "Could not load universe", "details": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)