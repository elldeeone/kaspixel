from typing import Optional, Dict, Any
import httpx
import time
import asyncio
from app.core.config import settings

# Define fallback API endpoints in case the primary one fails
KASPA_API_FALLBACKS = [
    "https://api.kaspa.org",
    "http://de4.kaspa.org:8000"
]

class KasWareService:
    def __init__(self):
        self.kaspa_api_url = settings.KASPA_API_URL
        self.transaction_times = {}  # Store transaction start times
        self.fastest_confirmation_time = None
        self.current_api_index = 0  # Track current API endpoint
        
        # Log the API URL being used
        print(f"Initializing KasWareService with API URL: {self.kaspa_api_url}")
    
    async def verify_transaction(self, transaction_id: str, amount_sompi: int, wallet_address: str) -> bool:
        """
        Verify a transaction on the Kaspa network through KasWare API.
        """
        try:
            # This method is not used in the current implementation
            # It's kept for reference or future use
            print(f"Warning: verify_transaction method is not implemented")
            return False
            
        except Exception as e:
            print(f"Error verifying transaction: {e}")
            return False
    
    async def _try_api_request(self, url, method="GET", **kwargs):
        """
        Try making a request to an API with retries and fallbacks
        """
        # Try the current API endpoint first
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                if method == "GET":
                    response = await client.get(url, **kwargs)
                    if response.status_code == 200:
                        return response
        except Exception as e:
            print(f"API request failed: {e}")
        
        # If we reach here, the request failed - try fallbacks
        print(f"Primary API endpoint failed, trying fallbacks...")
        
        # Try each fallback API
        for i, fallback in enumerate(KASPA_API_FALLBACKS):
            try:
                if fallback == self.kaspa_api_url:
                    continue  # Skip if it's the same as our primary
                
                fallback_url = url.replace(self.kaspa_api_url, fallback)
                print(f"Trying fallback API #{i+1}: {fallback_url}")
                
                async with httpx.AsyncClient(timeout=5.0) as client:
                    if method == "GET":
                        response = await client.get(fallback_url, **kwargs)
                        if response.status_code == 200:
                            # Update the primary API if a fallback works
                            print(f"Fallback API {fallback} is working, using it as primary now")
                            self.kaspa_api_url = fallback
                            return response
            except Exception as e:
                print(f"Fallback API request failed: {e}")
        
        # If we reach here, all APIs failed
        raise Exception("All Kaspa API endpoints failed")
    
    async def verify_transaction_in_blockchain(self, transaction_id: str) -> Dict[str, Any]:
        """
        Verify that a transaction exists in the Kaspa blockchain by checking if it appears in a block.
        Returns a dictionary with verification status and performance metrics.
        """
        try:
            # Clean up transaction ID if needed
            if isinstance(transaction_id, str):
                # Store original ID for debugging
                original_transaction_id = transaction_id
                
                # Remove any quotes or whitespace
                transaction_id = transaction_id.strip().strip('"\'')
                
                # Handle JSON object case
                if transaction_id.startswith('{') and transaction_id.endswith('}'):
                    import json
                    try:
                        tx_data = json.loads(transaction_id)
                        if 'id' in tx_data:
                            transaction_id = tx_data['id']
                            print(f"***** Successfully extracted transaction ID from JSON: {transaction_id} *****")
                        elif 'transactionId' in tx_data:
                            transaction_id = tx_data['transactionId']
                            print(f"***** Successfully extracted transaction ID from JSON: {transaction_id} *****")
                        else:
                            # Check all keys recursively
                            def find_id_in_dict(d, prefix=""):
                                for k, v in d.items():
                                    if k == 'id' or k == 'transactionId':
                                        return v
                                    elif isinstance(v, dict):
                                        result = find_id_in_dict(v, prefix=f"{prefix}.{k}")
                                        if result:
                                            return result
                                return None
                            
                            found_id = find_id_in_dict(tx_data)
                            if found_id:
                                transaction_id = found_id
                                print(f"***** Found transaction ID in nested JSON: {transaction_id} *****")
                            else:
                                print(f"JSON object does not contain 'id' or 'transactionId' field. Available keys: {list(tx_data.keys())}")
                    except json.JSONDecodeError as e:
                        print(f"Error parsing transaction ID as JSON: {e}")
                        # Continue with original ID if JSON parsing fails
            
            print(f"Verifying transaction: {transaction_id}")
            # If the original and cleaned IDs differ, log both
            if 'original_transaction_id' in locals() and original_transaction_id != transaction_id:
                print(f"Original transaction ID before cleaning: {original_transaction_id}")
            
            # Record start time if not already recorded
            if transaction_id not in self.transaction_times:
                self.transaction_times[transaction_id] = {
                    "start_time": time.time(),
                    "confirmed": False,
                    "confirmation_time": None,
                    "scan_start": None
                }
            
            # Try to get the tip hash with retries and fallbacks
            try:
                if not self.transaction_times[transaction_id].get("scan_start"):
                    # Use the direct Kaspa API endpoint with retry logic
                    tip_response = await self._try_api_request(f"{self.kaspa_api_url}/info/blockdag")
                    tip_hash = tip_response.json()["tipHashes"][0]
                    self.transaction_times[transaction_id]["scan_start"] = tip_hash
                    print(f"Set initial scan_start to {tip_hash} for transaction {transaction_id}")
                
                # Get the current scan_start
                scan_start = self.transaction_times[transaction_id]["scan_start"]
                
                # Check for new blocks since scan_start with retry logic
                print(f"Checking blocks from {scan_start} for transaction {transaction_id}")
                blocks_response = await self._try_api_request(
                    f"{self.kaspa_api_url}/blocks",
                    params={"lowHash": scan_start, "includeBlocks": "true"}
                )
                
                blocks_data = blocks_response.json()
                
                # Debug: Print the structure of blocks_data
                print(f"Blocks data structure: {list(blocks_data.keys())}")
                # Print a sample of the blocks response to understand the structure
                if blocks_data.get("blocks") and len(blocks_data.get("blocks", [])) > 0:
                    sample_block = blocks_data["blocks"][0]
                    print(f"Sample block structure: {list(sample_block.keys())}")
                    if "verboseData" in sample_block:
                        print(f"Sample verboseData structure: {list(sample_block['verboseData'].keys())}")
                        # Check if transactionIds exists
                        if "transactionIds" in sample_block["verboseData"]:
                            print(f"transactionIds exists with {len(sample_block['verboseData']['transactionIds'])} transactions")
                        else:
                            print(f"transactionIds key missing from verboseData. Available keys: {list(sample_block['verboseData'].keys())}")
                    else:
                        print(f"verboseData key missing from block. Available keys: {list(sample_block.keys())}")
                else:
                    print(f"No blocks found in response or blocks key missing. Full response keys: {list(blocks_data.keys())}")
                
                # Update scan_start to the latest block hash for next check
                if blocks_data.get("blockHashes") and len(blocks_data["blockHashes"]) > 0:
                    # Use the last (newest) block hash as the new scan_start
                    new_scan_start = blocks_data["blockHashes"][-1]
                    self.transaction_times[transaction_id]["scan_start"] = new_scan_start
                    print(f"Updated scan_start to {new_scan_start} for transaction {transaction_id}")
            except Exception as e:
                print(f"Error getting blocks: {e}")
                raise e  # Re-raise to be caught by the outer exception handler
                
            # Check if transaction is in any of the blocks
            found = False
            
            # IMPORTANT FIX: The API returns "blocks" not "keys"
            for block in blocks_data.get("blocks", []):
                # Try different possible paths for transaction IDs
                transaction_ids = []
                
                # Path 1: Classic verboseData.transactionIds
                if "verboseData" in block and "transactionIds" in block["verboseData"]:
                    transaction_ids = block["verboseData"]["transactionIds"]
                    print(f"Found transactionIds in verboseData with {len(transaction_ids)} transactions")
                
                # Path 2: Check if transactions array exists
                elif "transactions" in block:
                    print(f"Found 'transactions' array with {len(block['transactions'])} entries")
                    # Extract IDs from transactions if it's an array of objects
                    if isinstance(block["transactions"], list) and len(block["transactions"]) > 0:
                        if isinstance(block["transactions"][0], dict) and "id" in block["transactions"][0]:
                            transaction_ids = [tx["id"] for tx in block["transactions"] if "id" in tx]
                            print(f"Extracted {len(transaction_ids)} transaction IDs from transactions array")
                
                # Path 3: Check if the API returns txIds instead
                elif "verboseData" in block and "txIds" in block["verboseData"]:
                    transaction_ids = block["verboseData"]["txIds"]
                    print(f"Found txIds in verboseData with {len(transaction_ids)} transactions")
                    
                # Path 4: Direct transactionIds at block level
                elif "transactionIds" in block:
                    transaction_ids = block["transactionIds"]
                    print(f"Found transactionIds directly in block with {len(transaction_ids)} transactions")
                
                # Debug: print block structure if no transaction IDs found
                if not transaction_ids:
                    print(f"No transaction IDs found in block. Block keys: {list(block.keys())}")
                    if "verboseData" in block:
                        print(f"VerboseData keys: {list(block['verboseData'].keys())}")
                    continue
                
                print(f"Checking block {block.get('hash', 'unknown')} with {len(transaction_ids)} transactions")
                
                # Print the first few transaction IDs for debugging
                if len(transaction_ids) > 0:
                    print(f"First few transaction IDs in block: {transaction_ids[:3]}")
                    print(f"Looking for transaction ID: {transaction_id}")
                
                # Primary check: exact match
                if transaction_id in transaction_ids:
                    found = True
                    print(f"FOUND MATCH! Transaction {transaction_id} in block {block.get('hash', 'unknown')}")
                    
                    # Transaction found in a block, mark as confirmed
                    end_time = time.time()
                    confirmation_time = end_time - self.transaction_times[transaction_id]["start_time"]
                    
                    # Update transaction data
                    self.transaction_times[transaction_id]["confirmed"] = True
                    self.transaction_times[transaction_id]["confirmation_time"] = confirmation_time
                    
                    # Update fastest confirmation time if applicable
                    if (self.fastest_confirmation_time is None or 
                        confirmation_time < self.fastest_confirmation_time):
                        self.fastest_confirmation_time = confirmation_time
                    
                    return {
                        "verified": True,
                        "confirmation_time": confirmation_time,
                        "fastest_time": self.fastest_confirmation_time,
                        "block_hash": block.get("hash"),
                        "block_height": block.get("verboseData", {}).get("blockHeight")
                    }
                
                # Secondary check: case-insensitive match (in case of capitalization differences)
                if not found and any(tid.lower() == transaction_id.lower() for tid in transaction_ids):
                    found = True
                    matching_tid = next(tid for tid in transaction_ids if tid.lower() == transaction_id.lower())
                    print(f"FOUND CASE-INSENSITIVE MATCH! Transaction {matching_tid} matches {transaction_id}")
                    
                    # Transaction found in a block, mark as confirmed
                    end_time = time.time()
                    confirmation_time = end_time - self.transaction_times[transaction_id]["start_time"]
                    
                    # Update transaction data
                    self.transaction_times[transaction_id]["confirmed"] = True
                    self.transaction_times[transaction_id]["confirmation_time"] = confirmation_time
                    
                    # Update fastest confirmation time if applicable
                    if (self.fastest_confirmation_time is None or 
                        confirmation_time < self.fastest_confirmation_time):
                        self.fastest_confirmation_time = confirmation_time
                    
                    return {
                        "verified": True,
                        "confirmation_time": confirmation_time,
                        "fastest_time": self.fastest_confirmation_time,
                        "block_hash": block.get("hash"),
                        "block_height": block.get("verboseData", {}).get("blockHeight")
                    }
                
                # Tertiary check: check if transaction ID is a substring of any transaction ID in the block
                # This handles the case where the API might return longer format IDs
                if not found and any(transaction_id in tid for tid in transaction_ids):
                    found = True
                    matching_tid = next(tid for tid in transaction_ids if transaction_id in tid)
                    print(f"FOUND SUBSTRING MATCH! Transaction {matching_tid} contains {transaction_id}")
                    
                    # Transaction found in a block, mark as confirmed
                    end_time = time.time()
                    confirmation_time = end_time - self.transaction_times[transaction_id]["start_time"]
                    
                    # Update transaction data
                    self.transaction_times[transaction_id]["confirmed"] = True
                    self.transaction_times[transaction_id]["confirmation_time"] = confirmation_time
                    
                    # Update fastest confirmation time if applicable
                    if (self.fastest_confirmation_time is None or 
                        confirmation_time < self.fastest_confirmation_time):
                        self.fastest_confirmation_time = confirmation_time
                    
                    return {
                        "verified": True,
                        "confirmation_time": confirmation_time,
                        "fastest_time": self.fastest_confirmation_time,
                        "block_hash": block.get("hash"),
                        "block_height": block.get("verboseData", {}).get("blockHeight")
                    }
            
            if not found:
                print(f"Transaction {transaction_id} not found in any blocks yet")
            
            # Transaction not found in any block yet
            return {
                "verified": False,
                "message": "Transaction not found in any block yet",
                "scan_start": self.transaction_times[transaction_id]["scan_start"]
            }
        
        except Exception as e:
            print(f"Error verifying transaction in blockchain: {e}")
            import traceback
            traceback.print_exc()
            
            # Create a descriptive error message
            error_msg = str(e)
            
            # Try to provide some user-friendly guidance
            if "ConnectTimeout" in error_msg or "ConnectionError" in error_msg:
                error_msg = "Cannot connect to Kaspa API. The network may be experiencing issues. Your transaction will be credited once connectivity is restored."
            
            return {
                "verified": False,
                "error": error_msg,
                "message": "The Kaspa API appears to be offline. Your transaction will still be processed once the API is back online.",
                "api_status": "offline",
                "transaction_recorded": True # Let the frontend know the transaction was recorded
            }
    
    async def start_transaction_timer(self, transaction_id: str) -> None:
        """
        Start timing a transaction for performance measurement.
        """
        self.transaction_times[transaction_id] = {
            "start_time": time.time(),
            "confirmed": False,
            "confirmation_time": None
        }
    
    def get_transaction_metrics(self, transaction_id: str = None) -> Dict[str, Any]:
        """
        Get metrics for a specific transaction or all transactions.
        """
        if transaction_id:
            return self.transaction_times.get(transaction_id, {})
        
        return {
            "transactions": self.transaction_times,
            "fastest_confirmation_time": self.fastest_confirmation_time
        }
    
    async def get_wallet_balance(self, wallet_address: str) -> Optional[int]:
        """
        Get the balance of a wallet in sompi.
        """
        try:
            # This method is not used in the current implementation
            # It's kept for reference or future use
            print(f"Warning: get_wallet_balance method is not implemented")
            return None
            
        except Exception as e:
            print(f"Error getting wallet balance: {e}")
            return None
    
    async def close(self):
        """
        Close the HTTP client session.
        """
        # This method is not used in the current implementation
        # It's kept for reference or future use
        print(f"Warning: close method is not implemented")

# Create a global instance
kasware_service = KasWareService() 