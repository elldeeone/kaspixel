from typing import Optional, Dict, Any
import httpx
import time
from app.core.config import settings

class KasWareService:
    def __init__(self):
        self.kaspa_api_url = settings.KASPA_API_URL
        self.transaction_times = {}  # Store transaction start times
        self.fastest_confirmation_time = None
    
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
    
    async def verify_transaction_in_blockchain(self, transaction_id: str) -> Dict[str, Any]:
        """
        Verify that a transaction exists in the Kaspa blockchain by checking if it appears in a block.
        Returns a dictionary with verification status and performance metrics.
        """
        try:
            # Clean up transaction ID if needed
            if isinstance(transaction_id, str):
                # Remove any quotes or whitespace
                transaction_id = transaction_id.strip().strip('"\'')
                
                # Handle JSON object case
                if transaction_id.startswith('{') and transaction_id.endswith('}'):
                    import json
                    try:
                        tx_data = json.loads(transaction_id)
                        if 'id' in tx_data:
                            transaction_id = tx_data['id']
                            print(f"Extracted transaction ID in service: {transaction_id}")
                        elif 'transactionId' in tx_data:
                            transaction_id = tx_data['transactionId']
                            print(f"Extracted transaction ID in service: {transaction_id}")
                        else:
                            print(f"JSON object does not contain 'id' or 'transactionId' field: {transaction_id}")
                    except json.JSONDecodeError as e:
                        print(f"Error parsing transaction ID as JSON: {e}")
                        # Continue with original ID if JSON parsing fails
            
            print(f"Verifying transaction: {transaction_id}")
            
            # Record start time if not already recorded
            if transaction_id not in self.transaction_times:
                self.transaction_times[transaction_id] = {
                    "start_time": time.time(),
                    "confirmed": False,
                    "confirmation_time": None,
                    "scan_start": None
                }
            
            # Get the current tip hash if we don't have a scan_start yet
            async with httpx.AsyncClient() as client:
                if not self.transaction_times[transaction_id].get("scan_start"):
                    # Use the direct Kaspa API endpoint like in the reference implementation
                    tip_response = await client.get(f"{self.kaspa_api_url}/info/blockdag")
                    if tip_response.status_code != 200:
                        print(f"Error getting tip hash: {tip_response.status_code} - {tip_response.text}")
                        return {
                            "verified": False,
                            "error": f"Failed to get tip hash: {tip_response.status_code}"
                        }
                    
                    tip_hash = tip_response.json()["tipHashes"][0]
                    self.transaction_times[transaction_id]["scan_start"] = tip_hash
                    print(f"Set initial scan_start to {tip_hash} for transaction {transaction_id}")
                
                # Get the current scan_start
                scan_start = self.transaction_times[transaction_id]["scan_start"]
                
                # Check for new blocks since scan_start - use direct API like reference implementation
                print(f"Checking blocks from {scan_start} for transaction {transaction_id}")
                blocks_response = await client.get(
                    f"{self.kaspa_api_url}/blocks",
                    params={"lowHash": scan_start, "includeBlocks": "true"}
                )
                
                if blocks_response.status_code != 200:
                    print(f"Error getting blocks: {blocks_response.status_code} - {blocks_response.text}")
                    return {
                        "verified": False,
                        "error": f"Failed to get blocks: {blocks_response.status_code}"
                    }
                
                blocks_data = blocks_response.json()
                
                # Debug: Print the structure of blocks_data
                print(f"Blocks data structure: {list(blocks_data.keys())}")
                
                # Update scan_start to the latest block hash for next check
                if blocks_data.get("blockHashes") and len(blocks_data["blockHashes"]) > 0:
                    # Use the last (newest) block hash as the new scan_start
                    new_scan_start = blocks_data["blockHashes"][-1]
                    self.transaction_times[transaction_id]["scan_start"] = new_scan_start
                    print(f"Updated scan_start to {new_scan_start} for transaction {transaction_id}")
                
                # Check if transaction is in any of the blocks
                found = False
                
                # IMPORTANT FIX: The API returns "blocks" not "keys"
                for block in blocks_data.get("blocks", []):
                    if "verboseData" in block and "transactionIds" in block["verboseData"]:
                        transaction_ids = block["verboseData"]["transactionIds"]
                        print(f"Checking block {block.get('hash', 'unknown')} with {len(transaction_ids)} transactions")
                        
                        # Print the first few transaction IDs for debugging
                        if len(transaction_ids) > 0:
                            print(f"First few transaction IDs in block: {transaction_ids[:3]}")
                            print(f"Looking for transaction ID: {transaction_id}")
                        
                        # Check if our transaction ID is in the list - exact match like reference implementation
                        if transaction_id in transaction_ids:
                            found = True
                            print(f"Found transaction {transaction_id} in block {block.get('hash', 'unknown')}")
                            
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
            return {
                "verified": False,
                "error": str(e)
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