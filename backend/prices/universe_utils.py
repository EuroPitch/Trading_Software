# universe_utils.py
"""Utility functions for working with universe.json"""

import json

def load_universe(file_path="universe.json"):
    """Load the universe.json file."""
    with open(file_path, 'r') as f:
        return json.load(f)

def get_all_tickers(universe_data=None, file_path="universe.json"):
    """Extract all ticker symbols from universe.json."""
    if universe_data is None:
        universe_data = load_universe(file_path)

    tickers = []
    for sector_key, sector_data in universe_data['sectors'].items():
        for stock in sector_data['stocks']:
            tickers.append(stock['ticker'])
    return tickers

def get_tickers_by_sector(sector_key, universe_data=None, file_path="universe.json"):
    """Get tickers for a specific sector."""
    if universe_data is None:
        universe_data = load_universe(file_path)

    if sector_key not in universe_data['sectors']:
        return []

    return [stock['ticker'] for stock in universe_data['sectors'][sector_key]['stocks']]

def get_ticker_info(ticker, universe_data=None, file_path="universe.json"):
    """Get full info for a specific ticker."""
    if universe_data is None:
        universe_data = load_universe(file_path)

    for sector_key, sector_data in universe_data['sectors'].items():
        for stock in sector_data['stocks']:
            if stock['ticker'] == ticker:
                return {
                    'ticker': stock['ticker'],
                    'name': stock['name'],
                    'sector': sector_data['name'],
                    'sector_key': sector_key
                }
    return None

# Example usage:
if __name__ == "__main__":
    # Get all tickers
    all_tickers = get_all_tickers()
    print(f"All tickers ({len(all_tickers)}): {all_tickers}")

    # Get tickers by sector
    tech_tickers = get_tickers_by_sector('tech')
    print(f"\nTech tickers: {tech_tickers}")

    # Get info for specific ticker
    info = get_ticker_info('AAPL')
    print(f"\nAAPL info: {info}")
