from typing import Dict
from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect
import json
from app.core.config import settings
import asyncio

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.canvas_state: Dict[str, str] = {}  # (x,y) -> color
        print("ConnectionManager initialized")
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        client_id = str(id(websocket))  # Convert to string for better stability
        self.active_connections[client_id] = websocket
        print(f"WebSocket client connected: {client_id}. Total connections: {len(self.active_connections)}")
        
        # Debug active connections
        print(f"Active connection IDs: {list(self.active_connections.keys())}")
        
        # Send initial canvas state
        await self.send_canvas_state(websocket)
    
    async def disconnect(self, websocket: WebSocket):
        client_id = str(id(websocket))  # Convert to string for better stability
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            print(f"WebSocket client disconnected: {client_id}. Remaining connections: {len(self.active_connections)}")
            print(f"Remaining connection IDs: {list(self.active_connections.keys())}")
    
    async def send_canvas_state(self, websocket: WebSocket):
        await websocket.send_json({
            "type": "canvas_state",
            "data": self.canvas_state
        })
    
    async def broadcast_pixel_update(self, x: int, y: int, color: str):
        if not self._is_valid_coordinate(x, y):
            print(f"Invalid pixel coordinates: ({x}, {y})")
            return
        
        # Update canvas state
        coord_key = f"{x},{y}"
        self.canvas_state[coord_key] = color
        
        # Debug active connections before broadcasting
        print(f"Broadcasting pixel update: ({x}, {y}) -> {color}")
        print(f"Active connections before broadcast: {len(self.active_connections)}")
        print(f"Active connection IDs: {list(self.active_connections.keys())}")
        print(f"Canvas state now has {len(self.canvas_state)} pixels")
        
        # Broadcast to all connected clients
        message = {
            "type": "pixel_update",
            "data": {
                "x": x,
                "y": y,
                "color": color
            }
        }
        
        # If no active connections, log a warning
        if len(self.active_connections) == 0:
            print("WARNING: No active connections to broadcast to!")
            return
        
        # Make a copy of the active connections to avoid modification during iteration
        active_connections = list(self.active_connections.items())
        print(f"Broadcasting pixel update to {len(active_connections)} clients: ({x}, {y}) -> {color}")
        
        disconnected_clients = []
        
        for client_id, connection in active_connections:
            try:
                await connection.send_json(message)
                print(f"Successfully sent update to client {client_id}")
            except Exception as e:
                print(f"Error broadcasting to client {client_id}: {e}")
                disconnected_clients.append(client_id)
        
        # Clean up disconnected clients
        for client_id in disconnected_clients:
            if client_id in self.active_connections:
                print(f"Removing disconnected client: {client_id}")
                del self.active_connections[client_id]
                print(f"Remaining connections after cleanup: {len(self.active_connections)}")
                print(f"Remaining connection IDs: {list(self.active_connections.keys())}")
    
    async def broadcast_canvas_update(self):
        """
        Broadcast the entire canvas state to all connected clients.
        This is used when the canvas is wiped or needs a full refresh.
        """
        print(f"Broadcasting full canvas update to all clients")
        
        # If no active connections, log a warning
        if len(self.active_connections) == 0:
            print("WARNING: No active connections to broadcast to!")
            return
        
        # Note: We no longer clear the canvas state here
        # This ensures we don't lose pixels when broadcasting updates
        print(f"Broadcasting canvas state with {len(self.canvas_state)} pixels")
        
        # Prepare the message
        message = {
            "type": "canvas_state",
            "data": self.canvas_state
        }
        
        # Make a copy of the active connections to avoid modification during iteration
        active_connections = list(self.active_connections.items())
        print(f"Broadcasting canvas update to {len(active_connections)} clients")
        print(f"Active connection IDs: {list(self.active_connections.keys())}")
        
        disconnected_clients = []
        
        for client_id, connection in active_connections:
            try:
                print(f"Sending canvas update to client {client_id}")
                await connection.send_json(message)
                print(f"Successfully sent canvas update to client {client_id}")
            except Exception as e:
                print(f"Error broadcasting to client {client_id}: {e}")
                disconnected_clients.append(client_id)
        
        # Clean up disconnected clients
        for client_id in disconnected_clients:
            if client_id in self.active_connections:
                print(f"Removing disconnected client: {client_id}")
                del self.active_connections[client_id]
                print(f"Remaining connections after cleanup: {len(self.active_connections)}")
                print(f"Remaining connection IDs: {list(self.active_connections.keys())}")
    
    async def handle_connection(self, websocket: WebSocket):
        client_id = str(id(websocket))  # Convert to string for better stability
        try:
            # Ensure the connection is in active_connections
            if client_id not in self.active_connections:
                print(f"Adding client {client_id} to active_connections")
                self.active_connections[client_id] = websocket
                print(f"Total active connections: {len(self.active_connections)}")
                print(f"Active connection IDs: {list(self.active_connections.keys())}")
            
            while True:
                try:
                    # Use a timeout to detect disconnections
                    data = await asyncio.wait_for(websocket.receive_json(), timeout=30.0)
                    print(f"Received message from client {client_id}: {data}")
                    
                    if data["type"] == "pixel_update":
                        x = data["data"]["x"]
                        y = data["data"]["y"]
                        color = data["data"]["color"]
                        
                        # Validate pixel placement
                        if self._is_valid_coordinate(x, y):
                            await self.broadcast_pixel_update(x, y, color)
                    elif data["type"] == "ping":
                        # Respond to ping messages to keep the connection alive
                        await websocket.send_json({"type": "pong"})
                        print(f"Sent pong to client {client_id}")
                
                except asyncio.TimeoutError:
                    # Send a ping to check if the connection is still alive
                    try:
                        print(f"Sending ping to client {client_id}")
                        await websocket.send_json({"type": "ping"})
                    except Exception as e:
                        # If we can't send a ping, the connection is dead
                        print(f"Connection to client {client_id} timed out: {e}")
                        break
                        
                except WebSocketDisconnect:
                    print(f"WebSocket client {client_id} disconnected")
                    break
                    
                except Exception as e:
                    print(f"Error handling message from client {client_id}: {e}")
                    # Check if the error indicates a disconnection
                    if "disconnect" in str(e).lower() or "closed" in str(e).lower():
                        print(f"Client {client_id} appears to be disconnected")
                        break
                    # Otherwise, continue to the next message
        
        except Exception as e:
            print(f"Unexpected error in handle_connection for client {client_id}: {e}")
        
        # Always clean up the connection when we exit the loop
        print(f"Cleaning up connection for client {client_id}")
        await self.disconnect(websocket)
    
    def _is_valid_coordinate(self, x: int, y: int) -> bool:
        return (0 <= x < settings.CANVAS_WIDTH and 
                0 <= y < settings.CANVAS_HEIGHT) 