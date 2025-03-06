from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import traceback
import asyncio
from sqlalchemy import func

from app.db.session import get_db
from app.models.pixel import Pixel
from app.models.wallet_balance import WalletBalance
from app.models.transaction import Transaction
from app.services.kasware import kasware_service, KasWareService
from app.websockets import manager as connection_manager  # Import the shared manager instance
from app.core.config import settings, Settings
from app.schemas import TransactionVerification, TransactionMetrics

router = APIRouter()
# connection_manager = ConnectionManager()  # Remove this line as we're importing the manager from main.py

# Dependency to get the KasWareService instance
def get_kasware_service() -> KasWareService:
    return kasware_service

# Dependency to get the Settings instance
def get_settings() -> Settings:
    return settings

@router.get("/pixels", response_model=List[dict])
async def get_pixels(db: Session = Depends(get_db)):
    """
    Get all pixels from the database.
    """
    pixels = db.query(Pixel).all()
    return [
        {
            "id": pixel.id,
            "x": pixel.x,
            "y": pixel.y,
            "color": pixel.color,
            "wallet_address": pixel.wallet_address,
            "transaction_id": pixel.transaction_id,
            "created_at": pixel.created_at
        }
        for pixel in pixels
    ]

async def verify_transaction_in_background(transaction_id: str):
    """
    Background task to verify transaction in the blockchain.
    """
    # Start monitoring for transaction confirmation
    await kasware_service.start_transaction_timer(transaction_id)
    
    # Initial verification attempt
    verification_result = await kasware_service.verify_transaction_in_blockchain(transaction_id)
    
    # If not verified, we'll let the frontend poll for updates
    return verification_result

async def verify_transaction_and_update_balance(transaction_id: str, db: Session):
    """
    Verify a transaction and update the wallet balance if valid.
    This function is used for purchase transactions to ensure pixels are only
    added to a wallet's balance after the transaction is confirmed on the blockchain.
    """
    print(f"Starting verification and balance update for transaction {transaction_id}")
    
    try:
        # Get the transaction from the database
        transaction = db.query(Transaction).filter(
            Transaction.transaction_id == transaction_id
        ).first()
        
        if not transaction:
            print(f"Transaction {transaction_id} not found in database")
            return
            
        if transaction.verified:
            print(f"Transaction {transaction_id} already verified")
            return
        
        # Start monitoring for transaction confirmation
        await kasware_service.start_transaction_timer(transaction_id)
        
        # Maximum number of verification attempts
        max_attempts = 10
        attempt = 0
        verified = False
        
        # Poll the Kaspa API to verify the transaction
        # This involves multiple attempts with delays between them
        while attempt < max_attempts and not verified:
            attempt += 1
            print(f"Verification attempt {attempt} for transaction {transaction_id}")
            
            # Verify the transaction
            verification_result = await kasware_service.verify_transaction_in_blockchain(transaction_id)
            verified = verification_result.get("verified", False)
            
            if verified:
                print(f"Transaction {transaction_id} verified on attempt {attempt}")
                break
                
            # Wait before trying again (200ms)
            await asyncio.sleep(0.2)
        
        if verified:
            # Transaction is valid, update the wallet balance
            wallet_balance = db.query(WalletBalance).filter(
                WalletBalance.wallet_address == transaction.wallet_address
            ).first()
            
            if not wallet_balance:
                print(f"Creating new wallet balance for {transaction.wallet_address}")
                wallet_balance = WalletBalance(
                    wallet_address=transaction.wallet_address,
                    pixel_balance=0
                )
                db.add(wallet_balance)
            
            # Now it's safe to add the pixels
            old_balance = wallet_balance.pixel_balance
            wallet_balance.pixel_balance += transaction.pixels_added
            print(f"Updated wallet balance from {old_balance} to {wallet_balance.pixel_balance} for {transaction.wallet_address}")
            
            # Mark transaction as verified
            transaction.verified = True
            
            # Commit changes
            db.commit()
            print(f"Transaction {transaction_id} marked as verified and balance updated")
        else:
            print(f"Transaction {transaction_id} could not be verified after {max_attempts} attempts")
            
    except Exception as e:
        # Log the error
        print(f"Error verifying transaction {transaction_id}: {str(e)}")
        import traceback
        traceback.print_exc()

@router.post("/pixels", status_code=status.HTTP_201_CREATED)
async def place_pixel(
    x: int,
    y: int,
    color: str,
    wallet_address: str,
    transaction_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings)
):
    """
    Place a pixel on the canvas.
    """
    try:
        # Validate coordinates
        if not (0 <= x < settings.CANVAS_WIDTH and 0 <= y < settings.CANVAS_HEIGHT):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid pixel coordinates"
            )
        
        # Check if receiver address is configured
        if not settings.RECEIVER_ADDRESS:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Receiver address not configured"
            )
        
        # Check if the wallet has enough pixels
        wallet_balance = db.query(WalletBalance).filter(WalletBalance.wallet_address == wallet_address).first()
        
        if not wallet_balance or wallet_balance.pixel_balance <= 0:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient pixel balance"
            )
        
        # Decrement the wallet's pixel balance
        wallet_balance.pixel_balance -= 1
        
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
        
        # Start transaction verification in the background if enabled
        if settings.enable_transaction_verification:
            background_tasks.add_task(verify_transaction_in_background, transaction_id)
        
        # Broadcast update to all connected clients
        print(f"Broadcasting pixel update: x={x}, y={y}, color={color}")
        
        # Get active connections before broadcasting
        active_connections = list(connection_manager.active_connections.keys())
        print(f"Active connections before broadcast: {len(active_connections)}")
        print(f"Active connection IDs: {active_connections}")
        
        # Broadcast the update
        await connection_manager.broadcast_pixel_update(x, y, color)
        
        return {
            "message": "Pixel placed successfully",
            "pixel": {
                "id": pixel.id,
                "x": pixel.x,
                "y": pixel.y,
                "color": pixel.color,
                "wallet_address": pixel.wallet_address,
                "transaction_id": pixel.transaction_id,
                "created_at": pixel.created_at
            },
            "remaining_balance": wallet_balance.pixel_balance
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        return {"error": str(e)}

@router.get("/transactions/{transaction_id}/verify", response_model=TransactionVerification)
async def verify_transaction(
    transaction_id: str,
    kasware_service: KasWareService = Depends(get_kasware_service),
    settings: Settings = Depends(get_settings)
):
    """
    Verify a transaction on the Kaspa blockchain.
    """
    # Check if transaction verification is enabled
    if not settings.enable_transaction_verification:
        return {"verified": False, "error": "Transaction verification is disabled"}
    
    print(f"Received verification request for transaction ID: {transaction_id}")
    
    # Clean up transaction_id if it's a JSON string
    if transaction_id.startswith('{') and transaction_id.endswith('}'):
        try:
            import json
            tx_data = json.loads(transaction_id)
            if 'id' in tx_data:
                transaction_id = tx_data['id']
                print(f"Extracted transaction ID from JSON: {transaction_id}")
        except Exception as e:
            print(f"Error parsing transaction ID as JSON: {e}")
            # Continue with original ID if parsing fails
    
    # Strip any quotes or whitespace
    transaction_id = transaction_id.strip().strip('"\'')
    print(f"Cleaned transaction ID: {transaction_id}")
    
    # Verify the transaction
    result = await kasware_service.verify_transaction_in_blockchain(transaction_id)
    print(f"Verification result: {result}")
    
    return result

@router.get("/transactions/metrics", response_model=TransactionMetrics)
async def get_transaction_metrics(
    transaction_id: Optional[str] = None,
    kasware_service: KasWareService = Depends(get_kasware_service),
    settings: Settings = Depends(get_settings)
):
    """
    Get transaction performance metrics.
    """
    # Check if transaction verification is enabled
    if not settings.enable_transaction_verification:
        return {
            "fastest_time": None,
            "average_time": None,
            "total_transactions": 0,
            "confirmed_transactions": 0,
            "error": "Transaction verification is disabled"
        }
    
    # Clean up transaction_id if it's a JSON string
    if transaction_id and transaction_id.startswith('{') and transaction_id.endswith('}'):
        try:
            import json
            tx_data = json.loads(transaction_id)
            if 'id' in tx_data:
                transaction_id = tx_data['id']
                print(f"Extracted transaction ID from JSON for metrics: {transaction_id}")
        except Exception as e:
            print(f"Error parsing transaction ID as JSON for metrics: {e}")
            # Continue with original ID if parsing fails
    
    # Strip any quotes or whitespace if transaction_id is provided
    if transaction_id:
        transaction_id = transaction_id.strip().strip('"\'')
        print(f"Cleaned transaction ID for metrics: {transaction_id}")
    
    # Get transaction metrics
    metrics = kasware_service.get_transaction_metrics(transaction_id)
    print(f"Transaction metrics: {metrics}")
    
    return metrics

@router.get("/canvas")
async def get_canvas():
    """
    Get the current state of the canvas.
    """
    return {"canvas_state": connection_manager.canvas_state}

@router.get("/config")
async def get_config(settings: Settings = Depends(get_settings)):
    """
    Get public configuration for the frontend.
    """
    return {
        "canvas_width": settings.CANVAS_WIDTH,
        "canvas_height": settings.CANVAS_HEIGHT,
        "pixel_pack_cost": settings.PIXEL_PACK_COST,
        "pixel_pack_cost_sompi": settings.PIXEL_PACK_COST_SOMPI,
        "pixel_pack_size": settings.PIXEL_PACK_SIZE,
        "receiver_address": settings.RECEIVER_ADDRESS,
        "verify_transactions": settings.enable_transaction_verification,
        "transaction_check_interval": settings.TRANSACTION_CHECK_INTERVAL
    }

@router.get("/debug/blocks")
async def debug_blocks():
    """
    Debug endpoint to check the structure of blocks from the Kaspa API.
    """
    try:
        import httpx
        
        # Get the current tip hash
        async with httpx.AsyncClient() as client:
            tip_response = await client.get(f"http://de4.kaspa.org:8000/info/blockdag")
            if tip_response.status_code != 200:
                return {"error": f"Failed to get tip hash: {tip_response.status_code}"}
            
            tip_hash = tip_response.json()["tipHashes"][0]
            
            # Get blocks
            blocks_response = await client.get(
                f"http://de4.kaspa.org:8000/blocks",
                params={"lowHash": tip_hash, "includeBlocks": "true"}
            )
            
            if blocks_response.status_code != 200:
                return {"error": f"Failed to get blocks: {blocks_response.status_code}"}
            
            blocks_data = blocks_response.json()
            
            # Analyze structure
            result = {
                "blocks_data_keys": list(blocks_data.keys()),
                "has_keys": "keys" in blocks_data,
                "has_blockHashes": "blockHashes" in blocks_data,
                "blockHashes_count": len(blocks_data.get("blockHashes", [])),
                "keys_count": len(blocks_data.get("keys", [])),
                "first_block_sample": None
            }
            
            # Check first block structure if available
            if "keys" in blocks_data and len(blocks_data["keys"]) > 0:
                first_block = blocks_data["keys"][0]
                result["first_block_sample"] = {
                    "keys": list(first_block.keys()),
                    "has_verboseData": "verboseData" in first_block,
                }
                
                if "verboseData" in first_block:
                    verbose_data = first_block["verboseData"]
                    result["first_block_sample"]["verboseData_keys"] = list(verbose_data.keys())
                    result["first_block_sample"]["has_transactionIds"] = "transactionIds" in verbose_data
                    
                    if "transactionIds" in verbose_data:
                        result["first_block_sample"]["transactionIds_count"] = len(verbose_data["transactionIds"])
                        result["first_block_sample"]["first_few_transactionIds"] = verbose_data["transactionIds"][:3] if verbose_data["transactionIds"] else []
            
            return result
    except Exception as e:
        return {
            "error": str(e),
            "traceback": traceback.format_exc()
        }

@router.post("/purchases", status_code=status.HTTP_202_ACCEPTED)
async def purchase_pixels(
    wallet_address: str,
    transaction_id: str,
    amount_sompi: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings)
):
    """
    Process a pixel purchase transaction.
    """
    print(f"Purchase request received: wallet={wallet_address}, tx={transaction_id}, amount={amount_sompi}")
    try:
        # Check if transaction already exists
        existing_transaction = db.query(Transaction).filter(
            Transaction.transaction_id == transaction_id
        ).first()
        
        if existing_transaction:
            print(f"Transaction {transaction_id} already processed")
            
            # If transaction exists and is verified, return the current balance
            if existing_transaction.verified:
                wallet_balance = db.query(WalletBalance).filter(
                    WalletBalance.wallet_address == wallet_address
                ).first()
                
                return {
                    "message": "Transaction already processed",
                    "pixels_added": existing_transaction.pixels_added,
                    "new_balance": wallet_balance.pixel_balance if wallet_balance else 0
                }
            else:
                # If transaction exists but is not verified, return pending status
                # but still start verification in the background
                background_tasks.add_task(verify_transaction_and_update_balance, transaction_id, db)
                
                return {
                    "message": "Transaction pending verification",
                    "status": "pending",
                    "estimated_pixels": existing_transaction.pixels_added
                }
        
        # Calculate pixels to add based on amount
        # Use the settings values for pixel cost and pack size
        # Calculate how many packs were purchased
        pixel_pack_cost = settings.PIXEL_PACK_COST_SOMPI
        packs_purchased = amount_sompi // pixel_pack_cost
        pixels_to_add = packs_purchased * settings.PIXEL_PACK_SIZE
        
        print(f"Calculated {pixels_to_add} pixels to add for {amount_sompi} sompi (pack cost: {pixel_pack_cost}, pack size: {settings.PIXEL_PACK_SIZE})")
        
        if pixels_to_add <= 0:
            print(f"Amount {amount_sompi} too small for pixel purchase (minimum: {pixel_pack_cost} sompi)")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Amount too small for pixel purchase. Minimum amount is {pixel_pack_cost} sompi."
            )
        
        # Create transaction record (but don't add pixels yet)
        transaction = Transaction(
            transaction_id=transaction_id,
            wallet_address=wallet_address,
            amount_sompi=amount_sompi,
            pixels_added=pixels_to_add,
            verified=False
        )
        
        # Save transaction to database
        db.add(transaction)
        db.commit()
        print(f"Transaction saved to database: {transaction_id}")
        
        # Start transaction verification in the background
        if settings.enable_transaction_verification:
            background_tasks.add_task(verify_transaction_and_update_balance, transaction_id, db)
            print(f"Started background verification for {transaction_id}")
        
        # Get current wallet balance (without adding pixels yet)
        wallet_balance = db.query(WalletBalance).filter(
            WalletBalance.wallet_address == wallet_address
        ).first()
        
        current_balance = wallet_balance.pixel_balance if wallet_balance else 0
        
        return {
            "message": "Purchase submitted for verification",
            "status": "pending",
            "estimated_pixels": pixels_to_add,
            "current_balance": current_balance,
            "new_balance": current_balance  # Frontend will still show the old balance until verification completes
        }
    except HTTPException as e:
        print(f"HTTP Exception in purchase_pixels: {e.detail}")
        raise e
    except Exception as e:
        print(f"Exception in purchase_pixels: {str(e)}")
        return {"error": str(e)}

@router.get("/wallets/{wallet_address}/balance")
async def get_wallet_balance(
    wallet_address: str,
    db: Session = Depends(get_db)
):
    """
    Get the pixel balance for a wallet.
    """
    print(f"Received balance request for wallet: '{wallet_address}'")
    
    # Log all wallet balances for debugging
    all_balances = db.query(WalletBalance).all()
    print(f"All wallet balances in database:")
    for balance in all_balances:
        print(f"  - {balance.wallet_address}: {balance.pixel_balance}")
    
    # Try to find the exact match first
    wallet_balance = db.query(WalletBalance).filter(
        WalletBalance.wallet_address == wallet_address
    ).first()
    
    if not wallet_balance:
        print(f"No exact wallet balance match found for '{wallet_address}'")
        
        # Try a case-insensitive search as a fallback
        wallet_balance = db.query(WalletBalance).filter(
            func.lower(WalletBalance.wallet_address) == func.lower(wallet_address)
        ).first()
        
        if wallet_balance:
            print(f"Found wallet balance with case-insensitive match: '{wallet_balance.wallet_address}' with {wallet_balance.pixel_balance} pixels")
        else:
            print(f"No wallet balance found for '{wallet_address}' even with case-insensitive search")
            return {"pixel_balance": 0}
    
    print(f"Found wallet balance for '{wallet_address}': {wallet_balance.pixel_balance}")
    return {"pixel_balance": wallet_balance.pixel_balance} 