from typing import Dict, List, Optional, Any, Union
from pydantic import BaseModel, Field

class TransactionVerification(BaseModel):
    """
    Schema for transaction verification response.
    """
    verified: bool
    confirmation_time: Optional[float] = None
    fastest_time: Optional[float] = None
    block_hash: Optional[str] = None
    block_height: Optional[int] = None
    message: Optional[str] = None
    error: Optional[str] = None
    scan_start: Optional[str] = None

class TransactionMetrics(BaseModel):
    """
    Schema for transaction metrics response.
    """
    fastest_time: Optional[float] = None
    average_time: Optional[float] = None
    total_transactions: int = 0
    confirmed_transactions: int = 0
    error: Optional[str] = None

class PixelPlacement(BaseModel):
    """
    Schema for pixel placement request.
    """
    x: int
    y: int
    color: str
    address: str
    transaction_id: str

class PixelUpdate(BaseModel):
    """
    Schema for pixel update via WebSocket.
    """
    x: int
    y: int
    color: str 