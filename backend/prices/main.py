# price_api.py

from flask import Flask, request, jsonify
from flask_cors import CORS
from price_data import get_quotes_for_universe
import os
import json

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

@app.route("/", methods=["GET"])
def root():
    return jsonify({"status": "alive"})

@app.route("/equities/quotes", methods=["GET"])
def get_equity_quotes():
    """
    GET /equities/quotes?symbols=AAPL&symbols=MSFT&symbols=GOOGL
    Returns JSON for all requested symbols.
    """
    # Get list of symbols from query params
    symbols = request.args.getlist("symbols")
    if not symbols:
        return jsonify({"error": "No symbols provided"}), 400

    # Get optional params with defaults
    provider = request.args.get("provider", "yfinance")
    chunk_size = int(request.args.get("chunk_size", 50))

    # Fetch the data
    data = get_quotes_for_universe(symbols, provider=provider, chunk_size=chunk_size)

    response = {
        "provider": provider,
        "symbols": symbols,
        "data": data
    }

    return jsonify(response)

@app.route("/equities/universe", methods=["GET"])
def get_universe():
    """Return the trading competition universe from universe.json with sector mappings."""
    try:
        base = os.path.dirname(__file__)
        path = os.path.join(base, "universe.json")
        with open(path, "r") as f:
            data = json.load(f)
        
        tickers = []
        ticker_to_sector = {}  # NEW: Map ticker to custom sector
        
        for sector_key, sector_data in data['sectors'].items():
            sector_name = sector_data['name']
            for stock in sector_data['stocks']:
                ticker = stock['ticker']
                tickers.append(ticker)
                ticker_to_sector[ticker] = sector_name  # Map AAPL -> "Technology"
        
        return jsonify({
            "symbols": tickers,
            "total_stocks": data['metadata']['total_stocks'],
            "sectors": data['sectors'],
            "metadata": data['metadata'],
            "sector_mapping": ticker_to_sector  # NEW: Include the mapping
        })
    
    except Exception as e:
        return jsonify({"error": "Could not load universe", "details": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)