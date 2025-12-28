from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os
import json

# Load env variables first
load_dotenv()

from price_service import PriceService 

app = Flask(__name__)
CORS(app)

# Global service variable
price_service = None

# Initialize only if main process (avoids double-init with Flask reloader)
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
    """
    GET /equities/quotes?symbols=AAPL&symbols=MSFT
    """
    # If service hasn't started yet (race condition during boot), wait a tick
    if price_service is None:
        return jsonify({"error": "Service initializing..."}), 503

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