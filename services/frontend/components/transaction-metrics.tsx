"use client"

import { Button } from "@/components/ui/button"
import { CheckCircle2, Clock, X, Trophy, ExternalLink } from "lucide-react"
import { useEffect } from "react"

interface TransactionMetricsProps {
  transactionId: string | null
  verified: boolean
  transactionTime: number | null
  fastestTime: number | null
  onClose: () => void
}

export default function TransactionMetrics({ 
  transactionId, 
  verified, 
  transactionTime, 
  fastestTime, 
  onClose 
}: TransactionMetricsProps) {
  // Format transaction ID for display
  const formatTxId = (txId: string | null): string => {
    if (!txId) return "Processing...";
    
    // Clean the transaction ID if it's in JSON format
    let cleanTxId = txId;
    if (txId.startsWith('{') && txId.endsWith('}')) {
      try {
        const parsed = JSON.parse(txId);
        if (parsed.id) {
          cleanTxId = parsed.id;
        }
      } catch (e) {
        console.error("Error parsing transaction ID:", e);
      }
    }
    
    // Return shortened version for display
    if (cleanTxId.length <= 16) return cleanTxId;
    return `${cleanTxId.substring(0, 8)}...${cleanTxId.substring(cleanTxId.length - 8)}`;
  };

  // Get the full transaction ID (without formatting)
  const getFullTxId = (txId: string | null): string => {
    if (!txId) return "";
    
    // If the transaction ID is in JSON format, extract the ID
    if (txId.startsWith('{') && txId.endsWith('}')) {
      try {
        const parsed = JSON.parse(txId);
        return parsed.id || "";
      } catch (e) {
        console.error("Error parsing transaction ID:", e);
        return txId;
      }
    }
    
    return txId;
  };

  // Handle transaction ID click
  const handleTxIdClick = () => {
    if (!transactionId) return;
    
    const fullTxId = getFullTxId(transactionId);
    if (fullTxId) {
      window.open(`https://kas.fyi/txs/${fullTxId}`, '_blank');
    }
  };

  // Log transaction details for debugging
  useEffect(() => {
    console.log("Transaction Metrics:", {
      transactionId,
      verified,
      transactionTime,
      fastestTime
    });
  }, [transactionId, verified, transactionTime, fastestTime]);

  // Format time for display
  const formatTime = (seconds: number | null): string => {
    if (seconds === null) return 'N/A';
    return seconds.toFixed(3) + 's';
  };

  // Check if this is a new record
  const isNewRecord = fastestTime !== null && 
                      transactionTime !== null && 
                      Math.abs(transactionTime - fastestTime) < 0.001;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border rounded-lg shadow-xl max-w-md w-full p-6 m-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold font-rubik">Transaction Metrics</h3>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4">
          <div className="bg-muted/30 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Transaction ID:</span>
              <button 
                onClick={handleTxIdClick}
                disabled={!transactionId}
                className="flex items-center gap-1 text-xs font-mono bg-muted px-2 py-1 rounded hover:bg-muted/80 transition-colors"
                title={getFullTxId(transactionId) || ""}
              >
                {formatTxId(transactionId)}
                <ExternalLink className="h-3 w-3 ml-1" />
              </button>
            </div>

            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Status:</span>
              {!verified ? (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-amber-500 animate-pulse" />
                  <span className="text-sm font-medium text-amber-500">Pending</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium text-green-500">Verified</span>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Time:</span>
              <span className="text-sm font-mono">{formatTime(transactionTime)}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Fastest Time:</span>
              <div className="flex items-center gap-1.5">
                {isNewRecord && <Trophy className="h-4 w-4 text-yellow-500" />}
                <span className="text-sm font-mono">{formatTime(fastestTime)}</span>
              </div>
            </div>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            {verified ? (
              <p>
                Transaction verified in {formatTime(transactionTime)}! Kaspa's blockDAG technology enables near-instant
                finality.
                {isNewRecord && (
                  <span className="block mt-1 text-yellow-600 font-medium">
                    New record! This is the fastest transaction so far.
                  </span>
                )}
              </p>
            ) : (
              <p>Waiting for transaction verification on the Kaspa network...</p>
            )}
          </div>

          {verified && (
            <Button onClick={onClose} className="w-full">
              Continue
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

