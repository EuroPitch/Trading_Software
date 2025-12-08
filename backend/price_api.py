# price_api.py
from typing import List, Optional
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from price_data import get_quotes_for_universe

app = FastAPI(title="Equity Price Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class QuotesResponse(BaseModel):
    provider: str
    symbols: List[str]
    data: dict  # {symbol: {field: value}}

@app.get("/equities/quotes", response_model=QuotesResponse)
def get_equity_quotes(
    symbols: List[str] = Query(..., description="Repeat ?symbols= for each ticker"),
    provider: str = "yfinance",
    chunk_size: int = 50,
):
    """
    GET /equities/quotes?symbols=AAPL&symbols=MSFT&symbols=GOOGL
    Returns JSON for all requested symbols.
    """
    data = get_quotes_for_universe(symbols, provider=provider, chunk_size=chunk_size)
    return QuotesResponse(provider=provider, symbols=symbols, data=data)

