"use client"

import { useState, useEffect, useCallback } from 'react'

// Define types for API responses
export interface PixelData {
  id: number;
  x: number;
  y: number;
  color: string;
  wallet_address: string;
  transaction_id: string;
  created_at: string;
}

export interface ConfigData {
  canvas_width: number;
  canvas_height: number;
  pixel_pack_cost: number;
  pixel_pack_cost_sompi: number;
  pixel_pack_size: number;
  receiver_address: string;
  verify_transactions: boolean;
  transaction_check_interval: number;
}

export interface VerificationResult {
  verified: boolean;
  confirmation_time: number | null;
  fastest_time: number | null;
  block_hash: string | null;
  block_height: number | null;
  message: string;
  error: string | null;
  scan_start: string | null;
}

export function useApi(baseUrl: string) {
  const [config, setConfig] = useState<ConfigData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Helper function to get the appropriate API URL
  const getApiUrl = useCallback((endpoint: string) => {
    let url;
    // Always use the baseUrl provided through environment variables
    // This will be properly configured in docker-compose.yml
    url = `${baseUrl}/${endpoint}`;
    console.log(`API URL for endpoint '${endpoint}': ${url}`);
    return url;
  }, [baseUrl]);

  // Fetch configuration from backend
  const fetchConfig = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(getApiUrl('config'))
      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.status}`)
      }
      const data = await response.json()
      setConfig(data)
      return data
    } catch (err) {
      console.error('Error fetching config:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      return null
    } finally {
      setIsLoading(false)
    }
  }, [getApiUrl])

  // Fetch all pixels from backend
  const fetchPixels = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(getApiUrl('pixels'))
      if (!response.ok) {
        throw new Error(`Failed to fetch pixels: ${response.status}`)
      }
      const data = await response.json()
      return data
    } catch (err) {
      console.error('Error fetching pixels:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      return []
    } finally {
      setIsLoading(false)
    }
  }, [getApiUrl])

  // Place a pixel on the canvas
  const placePixel = useCallback(
    async (
      x: number,
      y: number,
      color: string,
      wallet_address: string,
      transaction_id: string
    ) => {
      setIsLoading(true)
      setError(null)
      try {
        console.log('Sending pixel data to API:', { x, y, color, wallet_address, transaction_id });
        
        // The error message indicates the backend expects query parameters, not a JSON body
        // Construct the URL with query parameters
        const url = new URL(getApiUrl('pixels'), typeof window !== 'undefined' ? window.location.origin : undefined);
        url.searchParams.append('x', x.toString());
        url.searchParams.append('y', y.toString());
        url.searchParams.append('color', color);
        url.searchParams.append('wallet_address', wallet_address);
        url.searchParams.append('transaction_id', transaction_id);
        
        console.log('Request URL:', url.toString());
        
        const response = await fetch(url.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          // No body needed as we're using query parameters
        })
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('API error response:', errorText);
          throw new Error(`Failed to place pixel: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json()
        return data
      } catch (err) {
        console.error('Error placing pixel:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [getApiUrl]
  )

  // Verify a transaction
  const verifyTransaction = useCallback(
    async (transaction_id: string) => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch(
          `${getApiUrl(`transactions/${transaction_id}/verify`)}`
        )
        if (!response.ok) {
          throw new Error(`Failed to verify transaction: ${response.status}`)
        }
        const data = await response.json()
        return data as VerificationResult
      } catch (err) {
        console.error('Error verifying transaction:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [getApiUrl]
  )

  // Process a pixel purchase
  const purchasePixels = useCallback(
    async (wallet_address: string, transaction_id: string, amount_sompi: number) => {
      setIsLoading(true);
      setError(null);
      try {
        console.log('Starting purchase process with:', { wallet_address, transaction_id, amount_sompi });
        
        // Use the API URL from getApiUrl instead of a direct URL
        const url = new URL(getApiUrl('purchases'), typeof window !== 'undefined' ? window.location.origin : undefined);
        url.searchParams.append('wallet_address', wallet_address);
        url.searchParams.append('transaction_id', transaction_id);
        url.searchParams.append('amount_sompi', amount_sompi.toString());
        
        console.log('Purchase request URL:', url.toString());
        
        const response = await fetch(url.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        console.log('Purchase response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Purchase error response:', errorText);
          throw new Error(`Failed to process purchase: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        console.log('Purchase response data:', data);
        return data;
      } catch (err) {
        console.error('Error processing purchase:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [getApiUrl]
  );

  // Get wallet balance
  const getWalletBalance = useCallback(
    async (wallet_address: string) => {
      setIsLoading(true);
      setError(null);
      try {
        // Add a timestamp to prevent caching
        const timestamp = new Date().getTime();
        const url = getApiUrl(`wallets/${wallet_address}/balance?_t=${timestamp}`);
        console.log(`Fetching wallet balance from: ${url}`);
        console.log(`Wallet address being used: "${wallet_address}"`);
        
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`Failed to get wallet balance: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`Wallet balance response:`, data);
        return data.pixel_balance;
      } catch (err) {
        console.error('Error getting wallet balance:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        return 0;
      } finally {
        setIsLoading(false);
      }
    },
    [getApiUrl]
  );

  // Fetch configuration on mount
  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  return {
    config,
    isLoading,
    error,
    fetchConfig,
    fetchPixels,
    placePixel,
    verifyTransaction,
    purchasePixels,
    getWalletBalance,
  }
} 