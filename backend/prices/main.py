from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import logging
import os
from dotenv import load_dotenv

# Load env variables
load_dotenv()

# Import Service
from price_service import PriceService
# Import Universe Utils for the universe endpoint
from universe_utils import load_universe

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("MainApp")

app = FastAPI()

# CORS Setup - Essential for React
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Service Instance
# We initialize it here so it persists across requests
service = PriceService()

@app.on_event("startup")
async def startup_event():
    """
    Kickstarts the background threads when the server starts.
    """
    logger.info("Booting up the EuroPitch Price Engine...")
    await service.start()

@app.get("/")
def home():
    return {
        "status": "online", 
        "service": "EuroPitch Price API", 
        "msg": "Send it."
    }

@app.get("/equities/universe")
def get_universe():
    """
    Returns the full universe structure from universe.json
    """
    try:
        data = load_universe()
        return data
    except Exception as e:
        return {"error": f"Failed to load universe: {str(e)}"}

@app.get("/equities/quotes")
def get_quotes(symbols: List[str] = Query(None)):
    """
    REST Endpoint for initial page load.
    Example: /equities/quotes?symbols=AAPL&symbols=MSFT
    """
    if not symbols:
        # If no symbols provided, return all known symbols
        symbols = service.symbols
        
    data = service.get_snapshot(symbols)
    return {"data": data}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket Endpoint.
    React connects here: ws://localhost:8000/ws
    """
    await service.manager.connect(websocket)
    try:
        while True:
            # Keep the connection alive and listen for any client messages
            # (e.g. heartbeat or subscription requests)
            data = await websocket.receive_text()
            # Logic to handle client messages if needed
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        service.manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        service.manager.disconnect(websocket)

# Entry point for debugging
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000) # Run command = uvicorn main:app --reload --port 5000