# price_data.py
from typing import List, Dict, Any
from openbb import obb
import math

def chunk_list(items: List[str], chunk_size: int) -> List[List[str]]:
    return [items[i : i + chunk_size] for i in range(0, len(items), chunk_size)]

def get_quotes_for_universe(
    symbols: List[str],
    provider: str = "yfinance",
    chunk_size: int = 50,
) -> Dict[str, Dict[str, Any]]:
    """
    Fetch latest quotes for many symbols via OpenBB and
    return a dict keyed by symbol with quote fields.
    """
    result: Dict[str, Dict[str, Any]] = {}

    for batch in chunk_list(symbols, chunk_size):
        obb_obj = obb.equity.price.quote(symbol=batch, provider=provider)
        df = obb_obj.to_df()  # index = symbol
        # Normalise to plain JSON per symbol
        for sym, row in df.iterrows():
            result[str(sym)] = row.to_dict()

    return result