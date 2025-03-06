from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.api.routes import router as api_router
from app.websockets import manager  # Import the shared manager instance
from app.db.init_db import init_db
from app.db.session import SessionLocal
from app.models.pixel import Pixel

# Function to load pixels from database into canvas state
def load_canvas_state():
    """
    Load all pixels from the database into the canvas state.
    This ensures the canvas state is always in sync with the database.
    """
    db = SessionLocal()
    try:
        pixels = db.query(Pixel).all()
        print(f"Loading {len(pixels)} pixels from database into canvas state")
        
        # Clear existing canvas state
        manager.canvas_state = {}
        
        # Load pixels into canvas state
        for pixel in pixels:
            coord_key = f"{pixel.x},{pixel.y}"
            manager.canvas_state[coord_key] = pixel.color
            
        print(f"Canvas state loaded with {len(manager.canvas_state)} pixels")
    except Exception as e:
        print(f"Error loading canvas state: {e}")
    finally:
        db.close()

app = FastAPI(
    title="Kaspa Pixel Canvas API",
    description="API for the Kaspa Pixel Canvas Game",
    version="1.0.0",
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database
init_db()

# Load canvas state from database
load_canvas_state()

# Include API routes
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    return JSONResponse(
        content={
            "message": "Welcome to Kaspa Pixel Canvas API",
            "docs_url": "/docs",
            "redoc_url": "/redoc",
        }
    )

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    client_host = getattr(websocket.client, 'host', 'unknown')
    client_id = str(id(websocket))  # Convert to string for better stability
    print(f"New WebSocket connection request from {client_host} (client_id: {client_id})")
    try:
        await manager.connect(websocket)
        print(f"Starting WebSocket connection handler for {client_host} (client_id: {client_id})")
        await manager.handle_connection(websocket)
    except WebSocketDisconnect:
        print(f"WebSocket disconnected: {client_host} (client_id: {client_id})")
        await manager.disconnect(websocket)
    except Exception as e:
        print(f"Error handling WebSocket connection: {e} (client_id: {client_id})")
        try:
            await manager.disconnect(websocket)
        except Exception as disconnect_error:
            print(f"Error during disconnect: {disconnect_error} (client_id: {client_id})")
    finally:
        # Ensure the connection is properly cleaned up
        try:
            if client_id in manager.active_connections:
                print(f"Cleaning up connection in finally block: {client_id}")
                await manager.disconnect(websocket)
        except Exception as e:
            print(f"Error cleaning up connection: {e} (client_id: {client_id})") 