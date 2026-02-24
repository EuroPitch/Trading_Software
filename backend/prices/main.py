from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List, Optional
import logging
import asyncio
from dotenv import load_dotenv

load_dotenv()

from price_service import PriceService
from universe_utils import load_universe

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("MainApp")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

service = PriceService()

@app.get("/health")
def health_check():
    """Quick health check that responds immediately"""
    return {
        "status": "healthy",
        "service": "EuroPitch Price API",
        "ws_connected": service.ws_connected if hasattr(service, 'ws_connected') else False
    }

@app.on_event("startup")
async def startup_event():
    """Start background services without blocking"""
    logger.info("HTTP Server ready - accepting requests")
    asyncio.create_task(service.start())
    logger.info("Background price services starting...")

@app.get("/")
def home():
    return {
        "status": "online",
        "service": "EuroPitch Price API",
        "msg": "Send it."
    }

@app.get("/equities/universe")
def get_universe():
    try:
        data = load_universe()
        return data
    except Exception as e:
        return {"error": f"Failed to load universe: {str(e)}"}

@app.get("/equities/quotes")
def get_quotes(symbols: List[str] = Query(None)):
    try:
        if not symbols:
            symbols = service.symbols
        data = service.get_snapshot(symbols)
        return {"data": data}
    except Exception as e:
        logger.error(f"Error in /equities/quotes: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to fetch quotes: {str(e)}"},
        )

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await service.manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        service.manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        service.manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)