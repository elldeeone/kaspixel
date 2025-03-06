#!/usr/bin/env python3
"""
Utility script to place "KASPA" directly on the canvas from within the backend container.
This script bypasses the payment requirement by directly inserting pixels into the database.
This script should only be run from within the container.
"""

import os
import sys
import argparse
import asyncio
import random
import string
from datetime import datetime
from sqlalchemy import text
import traceback

# Add the parent directory to the path so we can import the app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.db.session import SessionLocal
from app.models.pixel import Pixel
from app.websockets import manager
from app.core.config import settings

# Define the pixel pattern for "KASPA" with much thicker lines
# Each letter is represented as a 2D array of 1s and 0s
# 1 means place a pixel, 0 means leave empty
LETTER_PATTERNS = {
    "K": [
        [1, 1, 0, 0, 0, 0, 1, 1],
        [1, 1, 0, 0, 0, 1, 1, 0],
        [1, 1, 0, 0, 1, 1, 0, 0],
        [1, 1, 0, 1, 1, 0, 0, 0],
        [1, 1, 1, 1, 0, 0, 0, 0],
        [1, 1, 1, 1, 0, 0, 0, 0],
        [1, 1, 0, 1, 1, 0, 0, 0],
        [1, 1, 0, 0, 1, 1, 0, 0],
        [1, 1, 0, 0, 0, 1, 1, 0],
        [1, 1, 0, 0, 0, 0, 1, 1]
    ],
    "A": [
        [0, 0, 1, 1, 1, 1, 0, 0],
        [0, 1, 1, 0, 0, 1, 1, 0],
        [1, 1, 0, 0, 0, 0, 1, 1],
        [1, 1, 0, 0, 0, 0, 1, 1],
        [1, 1, 0, 0, 0, 0, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 0, 0, 0, 0, 1, 1],
        [1, 1, 0, 0, 0, 0, 1, 1],
        [1, 1, 0, 0, 0, 0, 1, 1]
    ],
    "S": [
        [0, 1, 1, 1, 1, 1, 1, 0],
        [1, 1, 0, 0, 0, 0, 1, 1],
        [1, 1, 0, 0, 0, 0, 0, 0],
        [1, 1, 0, 0, 0, 0, 0, 0],
        [0, 1, 1, 1, 1, 1, 0, 0],
        [0, 0, 0, 1, 1, 1, 1, 0],
        [0, 0, 0, 0, 0, 0, 1, 1],
        [0, 0, 0, 0, 0, 0, 1, 1],
        [1, 1, 0, 0, 0, 0, 1, 1],
        [0, 1, 1, 1, 1, 1, 1, 0]
    ],
    "P": [
        [1, 1, 1, 1, 1, 1, 0, 0],
        [1, 1, 0, 0, 0, 1, 1, 0],
        [1, 1, 0, 0, 0, 0, 1, 1],
        [1, 1, 0, 0, 0, 0, 1, 1],
        [1, 1, 0, 0, 0, 1, 1, 0],
        [1, 1, 1, 1, 1, 1, 0, 0],
        [1, 1, 0, 0, 0, 0, 0, 0],
        [1, 1, 0, 0, 0, 0, 0, 0],
        [1, 1, 0, 0, 0, 0, 0, 0],
        [1, 1, 0, 0, 0, 0, 0, 0]
    ]
}

# Grid size (size of each pixel cell)
GRID_SIZE = 10

def generate_transaction_id():
    """Generate a random transaction ID."""
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"direct-placement-{timestamp}-{random_str}"

async def place_pixel(db, x, y, color, wallet_address):
    """Place a pixel directly in the database and broadcast the update."""
    try:
        # Generate a unique transaction ID
        transaction_id = generate_transaction_id()
        
        # Create new pixel
        pixel = Pixel(
            x=x,
            y=y,
            color=color,
            wallet_address=wallet_address,
            transaction_id=transaction_id
        )
        
        # Save to database
        db.add(pixel)
        db.commit()
        db.refresh(pixel)
        
        # Broadcast update to all connected clients
        print(f"Broadcasting pixel update: x={x}, y={y}, color={color}")
        await manager.broadcast_pixel_update(x, y, color)
        
        return pixel
    except Exception as e:
        db.rollback()
        print(f"Error placing pixel: {e}")
        return None

async def place_scaled_pattern(db, pattern, start_x, start_y, color, wallet_address, scale_factor):
    """Place a scaled pattern of pixels."""
    pixels_placed = 0
    
    for y in range(len(pattern)):
        for x in range(len(pattern[0])):
            if pattern[y][x] == 1:
                # For each '1' in the pattern, place a block of pixels based on the scale factor
                for scale_y in range(scale_factor):
                    for scale_x in range(scale_factor):
                        pixel_x = start_x + (x * scale_factor) + scale_x
                        pixel_y = start_y + (y * scale_factor) + scale_y
                        
                        # Place the pixel
                        pixel = await place_pixel(db, pixel_x, pixel_y, color, wallet_address)
                        if pixel:
                            pixels_placed += 1
                        
                        # Add a small delay to avoid overwhelming the server
                        await asyncio.sleep(0.01)
    
    return pixels_placed

async def place_kaspa(color="#70C7BA", wallet_address="admin-direct-placement", scale_factor=10):
    """Place "KASPA" across the center of the canvas with a specified scale factor."""
    db = SessionLocal()
    try:
        # Calculate the center of the canvas
        center_x = settings.CANVAS_WIDTH // 2
        center_y = settings.CANVAS_HEIGHT // 2
        
        # Calculate the total width of "KASPA" with spacing
        letter_spacing = 3 * scale_factor  # Spacing between letters in grid cells, scaled
        word = "KASPA"
        
        # Calculate total width of the word (scaled)
        total_width = 0
        for letter in word:
            pattern = LETTER_PATTERNS[letter]
            total_width += len(pattern[0]) * scale_factor
            if letter != word[-1]:
                total_width += letter_spacing
        
        # Calculate starting X position to center the word
        start_x = center_x - (total_width // 2)
        # 10 is the height of our letter patterns
        start_y = center_y - ((10 * scale_factor) // 2)
        
        # Place each letter
        current_x = start_x
        total_pixels_placed = 0
        
        for letter in word:
            pattern = LETTER_PATTERNS[letter]
            
            # Place pixels for this letter with scaling
            pixels_placed = await place_scaled_pattern(
                db, pattern, current_x, start_y, color, wallet_address, scale_factor
            )
            total_pixels_placed += pixels_placed
            
            # Move to the next letter position
            current_x += (len(pattern[0]) * scale_factor) + letter_spacing
        
        print(f"Successfully placed {total_pixels_placed} pixels to form 'KASPA' on the canvas at {scale_factor}x scale!")
    except Exception as e:
        print(f"Error placing KASPA: {e}")
        traceback.print_exc()
    finally:
        db.close()

def main():
    """Main entry point for the script."""
    parser = argparse.ArgumentParser(description="Place 'KASPA' directly on the canvas.")
    parser.add_argument("--color", default="#70C7BA", help="Color to use for the pixels (default: #70C7BA)")
    parser.add_argument("--wallet", default="admin-direct-placement", help="Wallet address to use (default: admin-direct-placement)")
    parser.add_argument("--scale", type=int, default=10, help="Scale factor for the text size (default: 10)")
    args = parser.parse_args()
    
    # Check if running inside container
    if not os.path.exists("/.dockerenv"):
        print("ERROR: This script can only be run from within the container.")
        sys.exit(1)
    
    # Run the async function
    asyncio.run(place_kaspa(args.color, args.wallet, args.scale))

if __name__ == "__main__":
    main() 