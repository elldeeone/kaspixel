#!/usr/bin/env python3
"""
Utility script to wipe all pixels from the database.
This script should only be run from within the container.
"""

import os
import sys
import argparse
import subprocess
from sqlalchemy import text
import asyncio

# Add the parent directory to the path so we can import the app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.db.session import SessionLocal
from app.websockets import manager

def wipe_pixels(confirm: bool = False, restart: bool = False):
    """
    Wipe all pixels from the database using TRUNCATE TABLE and reset WebSocket canvas state.
    
    Args:
        confirm (bool): Confirmation flag to prevent accidental wipes
        restart (bool): Whether to restart the backend service after wiping
    """
    if not confirm:
        print("WARNING: This will delete ALL pixels from the database.")
        print("To confirm, run with --confirm flag.")
        return
    
    db = SessionLocal()
    try:
        # Delete all pixels using PostgreSQL TRUNCATE TABLE command
        db.execute(text("TRUNCATE TABLE pixels"))
        db.commit()
        print("Successfully wiped all pixels from the database.")
        
        # Reset the WebSocket canvas state
        manager.canvas_state = {}
        print("Reset WebSocket canvas state.")
        
        # Broadcast the empty canvas state to all connected clients
        try:
            # Note: broadcast_canvas_update no longer clears the canvas state
            # So we need to make sure it's already cleared before broadcasting
            asyncio.run(manager.broadcast_canvas_update())
            print("Broadcast empty canvas state to all connected clients.")
        except Exception as e:
            print(f"Warning: Failed to broadcast canvas update: {e}")
            print("You may need to refresh your browser to see the changes.")
        
        if restart:
            print("\nRestarting the backend service to fully reset all in-memory state...")
            # This will exit the script and the container will be restarted by Docker
            os.kill(1, 15)  # Send SIGTERM to PID 1 (the main process in the container)
    except Exception as e:
        db.rollback()
        print(f"Error wiping pixels: {e}")
    finally:
        db.close()

def main():
    """Main entry point for the script."""
    parser = argparse.ArgumentParser(description="Wipe all pixels from the database.")
    parser.add_argument("--confirm", action="store_true", help="Confirm pixel wipe")
    parser.add_argument("--restart", action="store_true", help="Restart the backend service after wiping")
    args = parser.parse_args()
    
    # Check if running inside container
    if not os.path.exists("/.dockerenv"):
        print("ERROR: This script can only be run from within the container.")
        sys.exit(1)
    
    wipe_pixels(args.confirm, args.restart)

if __name__ == "__main__":
    main() 