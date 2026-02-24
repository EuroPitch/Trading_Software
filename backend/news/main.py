"""
News Microservice REST API
FastAPI-based service for fetching and processing stock news articles.
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
from typing import Optional

from news_service import fetch_news, fetch_and_save_news


# Pydantic models for request/response
class NewsItem(BaseModel):
    """Model for a single news item."""
    title: str
    date: str
    summary: str
    link: str


class NewsResponse(BaseModel):
    """Model for the news response."""
    ticker: str
    count: int
    items: list[NewsItem]
    total_retrieved: int


# Initialize FastAPI app
app = FastAPI(
    title="News Microservice API",
    description="REST API for fetching stock news articles from yfinance",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["Health"])
async def root():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "News Microservice API",
        "version": "1.0.0"
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "News Microservice"
    }


@app.get("/news", response_model=NewsResponse, tags=["News"])
async def get_news(
    ticker: str = Query(..., description="Stock ticker symbol (e.g., AAPL, MSFT)"),
    count: int = Query(10, ge=1, le=100, description="Number of news items to retrieve (1-100)")
):
    """
    Fetch news articles for a given stock ticker.
    
    **Parameters:**
    - `ticker` (required): Stock ticker symbol (e.g., AAPL, MSFT, C)
    - `count` (optional): Number of news items to retrieve, default is 10, max is 100
    
    **Returns:**
    - A list of news items with title, date, summary, and link
    """
    try:
        news_data = fetch_news(ticker, count)
        
        # Check if we got any results
        if not news_data["Title"]:
            raise HTTPException(
                status_code=404,
                detail=f"No news found for ticker '{ticker}'"
            )
        
        # Format response
        items = []
        for i in range(len(news_data["Title"])):
            items.append(
                NewsItem(
                    title=news_data["Title"][i],
                    date=news_data["Date"][i],
                    summary=news_data["summary"][i],
                    link=news_data["link"][i]
                )
            )
        
        return NewsResponse(
            ticker=ticker.upper(),
            count=len(items),
            items=items,
            total_retrieved=len(items)
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching news: {str(e)}"
        )


@app.post("/news/save", tags=["News"])
async def save_news(
    ticker: str = Query(..., description="Stock ticker symbol"),
    count: int = Query(10, ge=1, le=100, description="Number of news items"),
    output_file: str = Query("output.json", description="Output file path")
):
    """
    Fetch news articles and save them to a JSON file.
    
    **Parameters:**
    - `ticker` (required): Stock ticker symbol
    - `count` (optional): Number of news items to retrieve
    - `output_file` (optional): Path to save the JSON file
    
    **Returns:**
    - Confirmation message with file path and count
    """
    try:
        df = fetch_and_save_news(ticker, count, output_file)
        return {
            "status": "success",
            "ticker": ticker.upper(),
            "output_file": output_file,
            "articles_saved": len(df),
            "message": f"Successfully saved {len(df)} articles to {output_file}"
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error saving news: {str(e)}"
        )


if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
