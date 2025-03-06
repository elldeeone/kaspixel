"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { useWallet } from "@/components/wallet-provider"
import ColorPicker from "@/components/color-picker"
import TransactionMetrics from "@/components/transaction-metrics"
import { Loader2, ZoomIn, ZoomOut, Plus, Minus, Info, RefreshCw } from "lucide-react"
import { useWebSocket } from "@/hooks/use-websocket"
import { useApi, PixelData } from "@/hooks/use-api"
import { useIsMobile } from "@/hooks/use-mobile"

// Constants
const GRID_SIZE = 10 // Size of each grid cell in pixels
// These default values are only used until config is loaded from backend
const DEFAULT_CANVAS_WIDTH = 1000
const DEFAULT_CANVAS_HEIGHT = 1000
const DEFAULT_PIXEL_PACK_SIZE = 10
const DEFAULT_PIXEL_PACK_COST = 200000000 // 0.2 KAS in sompi
const DEFAULT_PIXEL_SIZE = 10 // Increased to 10 for better visibility
const DEFAULT_COLOR = "#70C7BA"
// This will be overridden by the backend config
const DEFAULT_RECEIVER_ADDRESS = ""

// Fix WebSocket URL to use the correct port
const WS_URL = typeof window !== 'undefined' 
  ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
  : '/ws'

// Fix the API URL to match the actual backend endpoint
const API_BASE_URL = '/api/v1'

// Sample pixels for testing - only used if no pixels from backend
const SAMPLE_PIXELS = {
  // Empty object - no sample pixels
};

export default function PixelCanvas() {
  const { toast } = useToast()
  const { isConnected, isInstalled, connect, balance, sendTransaction, address } = useWallet()
  const [pixelSize, setPixelSize] = useState(DEFAULT_PIXEL_SIZE)
  const [selectedColor, setSelectedColor] = useState(DEFAULT_COLOR)
  const [isPaying, setIsPaying] = useState(false)
  const [remainingPixels, setRemainingPixels] = useState(5) // Start with 5 pixels for testing
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const [showTransactionMetrics, setShowTransactionMetrics] = useState(false)
  const [packsToBuy, setPacksToBuy] = useState(1)
  const [showMobileMessage, setShowMobileMessage] = useState(false)
  const isMobile = useIsMobile()
  
  // Canvas dimensions from backend config
  const [canvasWidth, setCanvasWidth] = useState(DEFAULT_CANVAS_WIDTH)
  const [canvasHeight, setCanvasHeight] = useState(DEFAULT_CANVAS_HEIGHT)
  const [pixelPackSize, setPixelPackSize] = useState(DEFAULT_PIXEL_PACK_SIZE)
  const [pixelPackCost, setPixelPackCost] = useState(DEFAULT_PIXEL_PACK_COST)
  const [receiverAddress, setReceiverAddress] = useState(DEFAULT_RECEIVER_ADDRESS)
  
  // Use WebSocket hook for real-time updates
  const { isConnected: isWsConnected, canvasState, isConnecting } = useWebSocket(WS_URL)
  
  // Use API hook for REST API calls
  const { config, isLoading, placePixel, verifyTransaction, fetchPixels, purchasePixels, getWalletBalance } = useApi(API_BASE_URL)
  
  // Track backend connection status
  const [backendStatus, setBackendStatus] = useState<'connecting' | 'online' | 'offline'>('connecting')
  
  // Local canvas state for immediate updates
  const [localCanvasState, setLocalCanvasState] = useState<Record<string, string>>({})
  
  // Canvas rendering optimization with offscreen canvas
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Transaction verification state
  const [currentTransaction, setCurrentTransaction] = useState<string | null>(null)
  const [transactionVerified, setTransactionVerified] = useState(false)
  const [transactionTime, setTransactionTime] = useState<number | null>(null)
  const [fastestTransactionTime, setFastestTransactionTime] = useState<number | null>(null)
  
  // Refs for interval management
  const verificationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const isVerifiedRef = useRef<boolean>(false)
  
  // Pan and zoom state
  const [isDragging, setIsDragging] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [startPosition, setStartPosition] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1) // Set to 1 (100%) for default zoom

  // Reference for wallet balance polling interval
  const walletBalanceIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Update backend status based on WebSocket connection
  useEffect(() => {
    if (isWsConnected) {
      setBackendStatus('online');
      console.log('Backend connection established via WebSocket');
    } else {
      setBackendStatus('connecting');
      console.log('WebSocket connection not established, trying to connect...');
    }

    // Set a timeout to change status to offline if connection isn't established
    const timeoutId = setTimeout(() => {
      if (!isWsConnected) {
        setBackendStatus('offline');
        console.log('Backend connection failed via WebSocket');
      }
    }, 5000);
    
    return () => clearTimeout(timeoutId);
  }, [isWsConnected]);

  // Show mobile message on initial load for mobile users
  useEffect(() => {
    if (isMobile) {
      setShowMobileMessage(true);
    }
  }, [isMobile]);

  // Fetch initial canvas state from backend
  useEffect(() => {
    const fetchInitialCanvas = async () => {
      try {
        console.log("Fetching initial canvas state from backend...");
        const pixelsArray = await fetchPixels();
        
        if (pixelsArray && pixelsArray.length > 0) {
          // Convert array of pixels to object format
          const pixelsObject: Record<string, string> = {};
          pixelsArray.forEach((pixel: PixelData) => {
            pixelsObject[`${pixel.x},${pixel.y}`] = pixel.color;
          });
          
          console.log(`Loaded ${pixelsArray.length} pixels from backend`);
          setLocalCanvasState(pixelsObject);
          setBackendStatus('online');
        } else {
          console.log("No pixels from backend, using sample pixels");
          setLocalCanvasState(SAMPLE_PIXELS);
        }
      } catch (error) {
        console.error("Error fetching initial canvas:", error);
        // Still use sample pixels even if there's an error
        setLocalCanvasState(SAMPLE_PIXELS);
        setBackendStatus('offline');
        
        toast({
          title: "Backend Connection Issue",
          description: "Could not connect to the backend server. Using sample pixels instead.",
          variant: "destructive",
        });
      }
    };

    fetchInitialCanvas();
  }, [fetchPixels, toast]);

  // Update canvas dimensions when config is loaded
  useEffect(() => {
    if (config) {
      setCanvasWidth(config.canvas_width || DEFAULT_CANVAS_WIDTH)
      setCanvasHeight(config.canvas_height || DEFAULT_CANVAS_HEIGHT)
      setPixelPackSize(config.pixel_pack_size || DEFAULT_PIXEL_PACK_SIZE)
      
      // Update state with config values
      if (config.canvas_width) setCanvasWidth(config.canvas_width)
      if (config.canvas_height) setCanvasHeight(config.canvas_height)
      if (config.pixel_pack_cost !== undefined) {
        // Convert KAS to sompi for internal use (1 KAS = 100,000,000 sompi)
        const sompiValue = Math.round(config.pixel_pack_cost * 100000000)
        setPixelPackCost(sompiValue)
        console.log(`Pixel pack cost from config: ${config.pixel_pack_cost} KAS (${sompiValue} sompi) for ${config.pixel_pack_size} pixels`)
      }
      if (config.pixel_pack_size) setPixelPackSize(config.pixel_pack_size)
      if (config.receiver_address) setReceiverAddress(config.receiver_address)
      
      console.log(`Canvas dimensions from config: ${config.canvas_width}x${config.canvas_height}`)
      setBackendStatus('online');
    }
  }, [config])

  // Merge canvasState from WebSocket with local state
  useEffect(() => {
    if (canvasState && Object.keys(canvasState).length > 0) {
      console.log(`Merging WebSocket canvas state with ${Object.keys(canvasState).length} pixels`)
      setLocalCanvasState(prevState => {
        const newState = { ...prevState, ...canvasState }
        return newState
      })
      setBackendStatus('online')
    }
  }, [canvasState])

  // Load fastest time from localStorage on component mount
  useEffect(() => {
    const storedFastestTime = localStorage.getItem("fastestTime")
    if (storedFastestTime) {
      try {
        const fastestTime = parseFloat(storedFastestTime)
        if (!isNaN(fastestTime)) {
          setFastestTransactionTime(fastestTime)
          console.log("Loaded fastest time from localStorage:", fastestTime)
        }
      } catch (err) {
        console.error("Error parsing fastest time from localStorage:", err)
      }
    }
  }, [])

  // Clean up intervals on unmount
  useEffect(() => {
    return () => {
      if (verificationIntervalRef.current) {
        clearInterval(verificationIntervalRef.current)
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
      }
      if (walletBalanceIntervalRef.current) {
        clearInterval(walletBalanceIntervalRef.current)
      }
    }
  }, [])

  // Initialize offscreen canvas for better performance
  useEffect(() => {
    if (!offscreenCanvasRef.current) {
      const canvas = document.createElement('canvas')
      canvas.width = canvasWidth
      canvas.height = canvasHeight
      offscreenCanvasRef.current = canvas
    }
  }, [canvasWidth, canvasHeight])

  // Update canvas when canvasState changes
  useEffect(() => {
    renderCanvas()
  }, [localCanvasState, zoom, position])

  // Center the canvas initially
  useEffect(() => {
    if (containerRef.current && canvasRef.current) {
      const containerWidth = containerRef.current.clientWidth
      const containerHeight = containerRef.current.clientHeight

      setPosition({
        x: (containerWidth - canvasWidth * zoom) / 2,
        y: (containerHeight - canvasHeight * zoom) / 2,
      })
    }
  }, [zoom, canvasWidth, canvasHeight])

  // Fetch wallet balance
  const fetchBalance = useCallback(async () => {
    if (!isConnected || !address) {
      setRemainingPixels(0);
      return;
    }
    
    try {
      const balance = await getWalletBalance(address);
      console.log(`Initial wallet balance fetch: ${balance}`);
      
      // Always update the balance, even if it's the same as before
      setRemainingPixels(balance);
    } catch (error) {
      console.error("Error fetching wallet balance:", error);
    }
  }, [isConnected, address, getWalletBalance]);
  
  // Fetch balance when wallet connection changes
  useEffect(() => {
    fetchBalance();
  }, [isConnected, address, fetchBalance]);

  // Format a price in sompi to KAS with proper decimal places
  const formatKasPrice = (sompi: number): string => {
    if (!sompi) return "0 KAS"
    
    // 1 KAS = 100,000,000 sompi
    // Convert sompi to KAS
    const kas = sompi / 100000000 // Fix: Changed from 1,000,000,000 to 100,000,000 to match KasWare's conversion
    
    // Format the KAS value to remove trailing zeros after the decimal point
    return `${kas.toFixed(8).replace(/\.?0+$/, "")} KAS`
  }

  // Format time for display
  const formatTime = (seconds: number | null): string => {
    if (seconds === null) return 'N/A'
    return seconds.toFixed(2) + 's'
  }

  // Render the canvas efficiently
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    // Set canvas dimensions
    canvas.width = canvasWidth
    canvas.height = canvasHeight

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Fill with white background
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw grid (always show grid lines)
    ctx.beginPath()
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)' // Darker grid lines for better visibility
    ctx.lineWidth = 0.5

    // Draw vertical grid lines (every GRID_SIZE pixels)
    for (let x = 0; x <= canvasWidth; x += GRID_SIZE) {
      ctx.moveTo(x, 0)
      ctx.lineTo(x, canvasHeight)
    }

    // Draw horizontal grid lines (every GRID_SIZE pixels)
    for (let y = 0; y <= canvasHeight; y += GRID_SIZE) {
      ctx.moveTo(0, y)
      ctx.lineTo(canvasWidth, y)
    }

    ctx.stroke()

    // Draw pixels from localCanvasState
    Object.entries(localCanvasState).forEach(([coord, color]) => {
      const [x, y] = coord.split(',').map(Number)
      if (x >= 0 && x < canvasWidth && y >= 0 && y < canvasHeight) {
        // Calculate the grid cell position
        const gridX = Math.floor(x / GRID_SIZE) * GRID_SIZE
        const gridY = Math.floor(y / GRID_SIZE) * GRID_SIZE
        
        ctx.fillStyle = color
        // Fill the entire grid cell
        ctx.fillRect(gridX, gridY, GRID_SIZE, GRID_SIZE)
      }
    })

    // Draw a border around the canvas
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.lineWidth = 1
    ctx.strokeRect(0, 0, canvasWidth, canvasHeight)

    console.log(`Canvas rendered with ${Object.keys(localCanvasState).length} pixels`);
  }, [localCanvasState, canvasWidth, canvasHeight, zoom])

  // Verify transaction with backend
  const verifyTransactionWithBackend = useCallback(async (txId: string, packs: number = 1, initialBalance: number | null = null) => {
    console.log("Starting verification for transaction:", txId, "with", packs, "packs")
    
    // Clear any existing intervals
    if (verificationIntervalRef.current) {
      clearInterval(verificationIntervalRef.current)
      verificationIntervalRef.current = null
    }
    
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
    
    // Start time for measuring transaction confirmation
    startTimeRef.current = Date.now()
    
    // Reset verification state
    isVerifiedRef.current = false
    setTransactionVerified(false)
    setTransactionTime(0) // Start at 0
    
    // Start a timer to update the elapsed time
    timerIntervalRef.current = setInterval(() => {
      if (startTimeRef.current && !isVerifiedRef.current) {
        const elapsed = (Date.now() - startTimeRef.current) / 1000
        setTransactionTime(elapsed)
      }
    }, 100) // Update more frequently for smoother display
    
    // Poll for transaction verification
    verificationIntervalRef.current = setInterval(async () => {
      try {
        // Skip polling if already verified
        if (isVerifiedRef.current) {
          if (verificationIntervalRef.current) {
            clearInterval(verificationIntervalRef.current)
            verificationIntervalRef.current = null
          }
          return
        }
        
        const result = await verifyTransaction(txId)
        
        if (result.verified && !isVerifiedRef.current) {
          // Transaction is verified - set flag immediately to prevent multiple processing
          isVerifiedRef.current = true
          setTransactionVerified(true)
          
          // Stop polling immediately
          if (verificationIntervalRef.current) {
            clearInterval(verificationIntervalRef.current)
            verificationIntervalRef.current = null
          }
          
          // Stop timer
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current)
            timerIntervalRef.current = null
          }
          
          // Calculate confirmation time - use the first verification time only
          const confirmationTime = (Date.now() - (startTimeRef.current || Date.now())) / 1000
          setTransactionTime(confirmationTime)
          
          // Update fastest time if applicable
          if (fastestTransactionTime === null || confirmationTime < fastestTransactionTime) {
            setFastestTransactionTime(confirmationTime)
            localStorage.setItem("fastestTime", confirmationTime.toString())
          }
          
          console.log(`Transaction verified in ${confirmationTime.toFixed(2)} seconds - first verification time`)
          
          // Start checking wallet balance to detect when backend adds pixels
          const totalPixelsPurchased = packs * pixelPackSize;
          const actualInitialBalance = initialBalance !== null ? initialBalance : remainingPixels;
          console.log(`Starting wallet balance polling for ${totalPixelsPurchased} pixels (${packs} packs of ${pixelPackSize}). Current balance: ${actualInitialBalance}, Expected after purchase: ${actualInitialBalance + totalPixelsPurchased}`);
          startWalletBalancePolling(totalPixelsPurchased, actualInitialBalance);
        }
      } catch (error) {
        console.error("Error verifying transaction:", error)
      }
    }, config?.transaction_check_interval || 1000)
    
  }, [config?.transaction_check_interval, fastestTransactionTime, verifyTransaction])

  // Function to start polling for wallet balance changes after a transaction
  const startWalletBalancePolling = useCallback((pixelsPurchased = pixelPackSize, providedInitialBalance: number | null = null) => {
    // Clear any existing interval
    if (walletBalanceIntervalRef.current) {
      clearInterval(walletBalanceIntervalRef.current);
      walletBalanceIntervalRef.current = null;
    }
    
    // Store the initial balance to detect changes
    const initialBalance = providedInitialBalance !== null ? providedInitialBalance : remainingPixels;
    
    // Get the current balance from the backend to ensure we have the most up-to-date value
    const checkCurrentBalance = async () => {
      if (!isConnected || !address) return initialBalance;
      try {
        const currentBalance = await getWalletBalance(address);
        return currentBalance;
      } catch (error) {
        console.error("Error getting current balance:", error);
        return initialBalance;
      }
    };
    
    // Start the polling process
    checkCurrentBalance().then(actualInitialBalance => {
      // If the balance is already updated, we don't need to poll
      if (actualInitialBalance >= initialBalance + pixelsPurchased) {
        console.log(`Balance already updated: ${actualInitialBalance} (expected: ${initialBalance + pixelsPurchased})`);
        // Update the UI with the current balance
        setRemainingPixels(actualInitialBalance);
        return;
      }
      
      // Store the expected balance after purchase (initial + purchased amount)
      const expectedBalance = initialBalance + pixelsPurchased;
      console.log(`Starting wallet balance polling. Initial balance: ${initialBalance}, Expected after purchase: ${expectedBalance}, Pixels purchased: ${pixelsPurchased}`);
      
      // Create a ref to track the last polled balance - polling will stop when current balance reaches expected balance
      let lastPolledBalance = actualInitialBalance;
      let pollCount = 0;
      let zeroBalanceCount = 0; // Count consecutive zero balances
      
      // Set a maximum polling time (2 minutes)
      const maxPollingTime = 2 * 60 * 1000; // 2 minutes in milliseconds
      const pollingStartTime = Date.now();
      
      // Force an immediate balance check
      const checkBalance = async () => {
        if (!isConnected || !address) return;
        
        try {
          pollCount++;
          console.log(`Checking wallet balance (poll #${pollCount}) for address: ${address}`);
          const currentBalance = await getWalletBalance(address);
          console.log(`Wallet balance poll #${pollCount}: ${currentBalance} (was: ${lastPolledBalance}, expected: ${expectedBalance})`);
          
          // Always update the UI with the current balance
          setRemainingPixels(currentBalance);
          
          // If balance has reached or exceeded the expected value, stop polling
          if (currentBalance >= expectedBalance) {
            console.log(`Balance verified: ${currentBalance} (expected: ${expectedBalance}). Increase: +${currentBalance - initialBalance} pixels`);
            
            // Stop polling
            if (walletBalanceIntervalRef.current) {
              clearInterval(walletBalanceIntervalRef.current);
              walletBalanceIntervalRef.current = null;
            }
            return true;
          }
          
          // Update the last polled balance
          lastPolledBalance = currentBalance;
          
          // Special case: If we're getting 0 but we know we should have pixels
          if (currentBalance === 0 && lastPolledBalance > 0) {
            zeroBalanceCount++;
            console.log(`Got 0 balance but expected ${expectedBalance}. Zero count: ${zeroBalanceCount}`);
            
            // If we get 3 consecutive zero balances, try a direct curl request
            if (zeroBalanceCount >= 3 && pollCount >= 5) {
              console.log("Multiple zero balances detected, stopping polling");
              if (walletBalanceIntervalRef.current) {
                clearInterval(walletBalanceIntervalRef.current);
                walletBalanceIntervalRef.current = null;
              }
              return false;
            }
          } else {
            zeroBalanceCount = 0;
          }
          
          // Check if we've exceeded the maximum polling time
          if (Date.now() - pollingStartTime > maxPollingTime) {
            console.log(`Maximum polling time (${maxPollingTime/1000} seconds) exceeded. Stopping polling.`);
            if (walletBalanceIntervalRef.current) {
              clearInterval(walletBalanceIntervalRef.current);
              walletBalanceIntervalRef.current = null;
            }
            return false;
          }
          
          return false;
        } catch (error) {
          console.error("Error polling wallet balance:", error);
          return false;
        }
      };
      
      // Check immediately
      checkBalance();
      
      // Poll for wallet balance changes
      walletBalanceIntervalRef.current = setInterval(checkBalance, 500); // Poll every 500ms
      
      // Stop polling after 10 seconds regardless (safety timeout)
      setTimeout(() => {
        if (walletBalanceIntervalRef.current) {
          clearInterval(walletBalanceIntervalRef.current);
          walletBalanceIntervalRef.current = null;
          console.log("Wallet balance polling stopped after timeout");
        }
      }, 10000);
    });
  }, [address, getWalletBalance, isConnected, remainingPixels, pixelPackSize]);

  // Handle pixel click
  const handlePixelClick = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    // If on mobile, show the message instead of placing a pixel
    if (isMobile) {
      setShowMobileMessage(true);
      return;
    }
    
    if (!isConnected) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to place pixels.",
        variant: "destructive",
      });
      return;
    }

    if (remainingPixels <= 0) {
      // Show purchase modal if no pixels remaining
      setShowPurchaseModal(true);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Get click coordinates relative to canvas
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Get raw pixel coordinates
    const rawX = Math.floor((e.clientX - rect.left) * scaleX);
    const rawY = Math.floor((e.clientY - rect.top) * scaleY);
    
    // Snap to grid
    const x = Math.floor(rawX / GRID_SIZE) * GRID_SIZE;
    const y = Math.floor(rawY / GRID_SIZE) * GRID_SIZE;
    
    // Validate coordinates
    if (x < 0 || x >= canvasWidth || y < 0 || y >= canvasHeight) {
      return;
    }

    // Create a key for this pixel location
    const pixelKey = `${x},${y}`;
    
    // Check if we're overwriting an existing pixel
    const isOverwriting = localCanvasState[pixelKey] !== undefined;

    console.log(`Placing pixel at grid cell (${x}, ${y}) with color ${selectedColor}${isOverwriting ? ' (overwriting)' : ''}`);

    try {
      // Update local canvas state immediately for better UX
      setLocalCanvasState(prev => ({
        ...prev,
        [pixelKey]: selectedColor
      }));
      
      // Force a re-render of the canvas for immediate feedback
      renderCanvas();
      
      // Try to place pixel on backend if it's online
      if (backendStatus === 'online') {
        try {
          // Generate a unique transaction ID for each placement
          const timestamp = Date.now();
          const randomStr = Math.random().toString(36).substring(2, 10);
          const transactionId = `placement-${timestamp}-${randomStr}-${x}-${y}`;
          
          // Make sure the wallet address is valid or use a placeholder
          const walletAddress = address || 'demo-wallet-address';
          
          // Ensure color is in the correct format (hex with # prefix)
          const formattedColor = selectedColor.startsWith('#') 
            ? selectedColor 
            : `#${selectedColor}`;
          
          // Call the API with properly formatted data
          const result = await placePixel(
            x, 
            y, 
            formattedColor, 
            walletAddress, 
            transactionId
          );
          
          console.log("Backend response for pixel placement:", result);
          
          // Update remaining pixels from the backend response
          if (result.remaining_balance !== undefined) {
            setRemainingPixels(result.remaining_balance);
          } else {
            // Fallback to frontend calculation if backend doesn't return remaining balance
            setRemainingPixels((prev) => prev - 1);
          }
          
          // If we get here, the backend call was successful
          // Removing the toast notification for successful pixel placement
          // toast({
          //   title: isOverwriting ? "Pixel updated!" : "Pixel placed!",
          //   description: "Your pixel was saved to the server.",
          // });
        } catch (error: any) {
          console.error("Error placing pixel on backend:", error);
          
          // Check for insufficient balance error
          if (error.message && error.message.includes("Insufficient pixel balance")) {
            toast({
              title: "Out of pixels",
              description: "You've used all your pixels. Buy more to continue placing.",
              variant: "destructive",
            });
            
            // Set remaining pixels to 0
            setRemainingPixels(0);
            
            // Show purchase modal
            setShowPurchaseModal(true);
          } else {
            // Show a more specific error message for other errors
            toast({
              title: "Backend Error",
              description: `Could not save pixel to server: ${error.message}`,
              variant: "destructive",
            });
          }
        }
      } else {
        // Backend is offline, just show a message
        toast({
          title: "Local Mode",
          description: "Pixel placed locally. Backend is offline.",
        });
        
        // Still decrement remaining pixels in local state
        setRemainingPixels((prev) => prev - 1);
      }
      
      // If this was the last pixel, show a message
      if (remainingPixels === 1) {
        toast({
          title: "Out of pixels",
          description: "You've used all your pixels. Buy more to continue placing.",
        });
      }
    } catch (error) {
      console.error("Error placing pixel:", error);
      
      toast({
        title: "Backend Connection Issue",
        description: "Your pixel was placed locally but couldn't be saved to the server.",
        variant: "destructive",
      });
    }
  };

  // Handle payment for pixel packs
  const handleBuyPixels = async () => {
    if (!isConnected) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your KasWare wallet to buy pixels.",
        variant: "destructive",
      });
      return;
    }

    // Calculate the total cost
    const totalCost = packsToBuy * pixelPackCost;
    
    // Check if user has enough balance
    if (balance < totalCost) {
      toast({
        title: "Insufficient balance",
        description: `You need at least ${formatKasPrice(totalCost)} KAS to buy ${packsToBuy} pixel pack(s).`,
        variant: "destructive",
      });
      return;
    }

    // Fetch the current pixel balance from the backend BEFORE starting the transaction
    // This ensures we have the most up-to-date balance as our baseline
    let initialPixelBalance = remainingPixels;
    if (isConnected && address) {
      try {
        console.log(`Fetching current pixel balance before purchase...`);
        const currentBalance = await getWalletBalance(address);
        console.log(`Current pixel balance before purchase: ${currentBalance}`);
        initialPixelBalance = currentBalance;
        setRemainingPixels(currentBalance);
      } catch (error) {
        console.error("Error fetching current balance before purchase:", error);
      }
    }

    setIsPaying(true);
    setCurrentTransaction(null);
    setTransactionVerified(false);
    setTransactionTime(null);

    try {
      // Add transaction options to handle the "Storage mass exceeds maximum" error
      const options = {
        priorityFee: 1, // Add a small priority fee (1 sompi)
      };
      
      // Ensure totalCost is a number
      const totalCostNumber = Number(totalCost);
      
      // Send transaction using the wallet provider
      const txId = await sendTransaction(receiverAddress, totalCostNumber, options);
      
      // If we get here, the transaction was sent successfully
      console.log("Transaction sent successfully:", txId);
      
      if (txId) {
        // Store the transaction ID
        setCurrentTransaction(txId);
        
        // Verify transaction with backend
        verifyTransactionWithBackend(txId, packsToBuy, initialPixelBalance);
        
        // Process the purchase on the backend
        try {
          const purchaseResult = await purchasePixels(
            address || 'unknown-wallet',
            txId,
            totalCostNumber
          );
          
          console.log("Purchase processed:", purchaseResult);
          
          // The backend now returns different data based on the verification status
          if (purchaseResult.status === "pending") {
            // Transaction is pending verification on the backend
            console.log("Purchase pending backend verification");
            
            // Don't update the pixel balance yet - it will be updated by the polling
            // Just show the transaction metrics popup
            setIsPaying(false);
            setShowPurchaseModal(false);
            setShowTransactionMetrics(true);
            
            // Store the expected new balance for verification
            const expectedNewBalance = remainingPixels + packsToBuy * pixelPackSize;
            console.log(`Transaction pending. Current balance: ${remainingPixels}, Expected after verification: ${expectedNewBalance}`);
            
            // Removing the toast notification for transaction sent
            // toast({
            //   title: "Transaction sent",
            //   description: "Your transaction is being processed. Pixels will be added to your balance shortly.",
            // });
          } else {
            // For backward compatibility or if the backend immediately verifies
            // Update remaining pixels from the backend response
            if (purchaseResult.new_balance) {
              console.log(`Updating balance from backend: ${remainingPixels} -> ${purchaseResult.new_balance}`);
              setRemainingPixels(purchaseResult.new_balance);
            } else {
              // Fallback to frontend calculation if backend doesn't return new balance
              const newBalance = remainingPixels + packsToBuy * pixelPackSize;
              console.log(`Updating balance from calculation: ${remainingPixels} -> ${newBalance}`);
              setRemainingPixels(newBalance);
            }
            
            // Show transaction metrics
            setIsPaying(false);
            setShowPurchaseModal(false);
            setShowTransactionMetrics(true);
            
            toast({
              title: "Purchase successful",
              description: `You've purchased ${purchaseResult.pixels_added || (packsToBuy * pixelPackSize)} pixels!`,
            });
          }
        } catch (purchaseError) {
          console.error("Error processing purchase on backend:", purchaseError);
          
          // Still show success since the KAS transaction went through
          // The user can try again to process the purchase
          toast({
            title: "Transaction sent, but purchase processing failed",
            description: "Your KAS was sent, but there was an error processing your pixel purchase. Please contact support.",
            variant: "destructive",
          });
          
          // Still show the transaction metrics popup
          setIsPaying(false);
          setShowPurchaseModal(false);
          setShowTransactionMetrics(true);
        }
      } else {
        throw new Error("Failed to send transaction");
      }
    } catch (error) {
      console.error("Error buying pixels:", error);
      setIsPaying(false);
      setShowPurchaseModal(false);
      
      toast({
        title: "Purchase failed",
        description: error instanceof Error ? error.message : "There was an error processing your payment. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle transaction metrics close
  const handleTransactionMetricsClose = () => {
    setShowTransactionMetrics(false)
  }

  // Increment/decrement packs to buy
  const incrementPacks = () => setPacksToBuy((prev) => Math.min(prev + 1, 10))
  const decrementPacks = () => setPacksToBuy((prev) => Math.max(prev - 1, 1))

  // Handle canvas panning
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start dragging if it's not a canvas click
    if (e.target === canvasRef.current) {
      return;
    }
    
    setIsDragging(true)
    setStartPosition({ x: e.clientX - position.x, y: e.clientY - position.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - startPosition.x,
        y: e.clientY - startPosition.y,
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Handle zoom in/out
  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev * 1.5, 50))
  }

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev / 1.5, 0.25))
  }

  // Handle touch events for mobile dragging
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true)
      setStartPosition({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y
      })
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      setPosition({
        x: e.touches[0].clientX - startPosition.x,
        y: e.touches[0].clientY - startPosition.y
      })
    } else if (e.touches.length === 2) {
      // Handle pinch-to-zoom
      e.preventDefault() // Prevent default browser pinch zoom
      
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      
      // Calculate the distance between the two touch points
      const currentDistance = Math.hypot(
        touch1.clientX - touch2.clientX,
        touch1.clientY - touch2.clientY
      )
      
      if (e.target instanceof HTMLElement) {
        // Store the initial distance in a data attribute
        const initialDistance = parseFloat(e.target.dataset.initialPinchDistance || '0')
        
        if (initialDistance === 0) {
          // First time in this pinch gesture, store the initial distance
          e.target.dataset.initialPinchDistance = currentDistance.toString()
          e.target.dataset.initialZoom = zoom.toString()
        } else {
          // Calculate the zoom factor based on the change in distance
          const initialZoom = parseFloat(e.target.dataset.initialZoom || '1')
          const zoomFactor = currentDistance / initialDistance
          const newZoom = Math.max(0.5, Math.min(5, initialZoom * zoomFactor))
          
          setZoom(newZoom)
        }
      }
    }
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
    
    // Reset pinch zoom data
    if (containerRef.current) {
      containerRef.current.dataset.initialPinchDistance = '0'
    }
  }

  // Toggle mobile message
  const toggleMobileMessage = () => {
    setShowMobileMessage(prev => !prev)
  }

  return (
    <div className="relative w-full h-full">
      {/* Mobile message */}
      {isMobile && showMobileMessage && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
          <div className="bg-white p-6 rounded-lg max-w-md">
            <h2 className="text-xl font-bold mb-4">Mobile Experience</h2>
            <p className="mb-4">
              The Kaspa Pixel Canvas is designed for desktop use. On mobile, you can view the canvas but cannot place pixels.
            </p>
            <p className="mb-4">
              For the best experience, please use a desktop browser.
            </p>
            <button
              className="px-4 py-2 bg-[#70C7BA] text-white rounded hover:bg-[#5bb3a6]"
              onClick={toggleMobileMessage}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col items-center w-full max-w-4xl mx-auto">
        <div className="w-full mb-4 flex justify-between items-center">
          {/* Removed the Select Color label and input */}
          {/* Removed the WebSocket connection status display */}
        </div>

        {/* Canvas container - added touch events */}
        <div
          ref={containerRef}
          className="w-full h-[calc(100vh-200px)] overflow-hidden relative bg-neutral-900 rounded-lg"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {isMobile && !showMobileMessage && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-medium z-10 animate-fade-out pointer-events-none">
              Drag to move • Pinch to zoom
            </div>
          )}
          <div
            className="absolute transition-transform duration-100 ease-out"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
              transformOrigin: "top left",
            }}
          >
            <canvas
              ref={canvasRef}
              width={canvasWidth}
              height={canvasHeight}
              onClick={handlePixelClick}
              className={isMobile ? "cursor-grab" : "cursor-crosshair"}
              style={{
                imageRendering: 'pixelated',
                border: '1px solid rgba(255, 255, 255, 0.5)'
              }}
            />
          </div>
        </div>

        {/* Control bar - positioned under the canvas */}
        <div className="w-full mt-4 flex justify-center">
          <div className="bg-background/90 backdrop-blur-sm border rounded-full shadow-lg p-2 flex items-center gap-2">
            {!isMobile && !isConnected ? (
              <Button
                onClick={connect}
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full"
                size="sm"
              >
                Connect Wallet
              </Button>
            ) : !isMobile && isConnected ? (
              <div className="flex items-center gap-2 bg-card px-3 py-1.5 rounded-full border">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs font-medium">{formatKasPrice(balance)}</span>
              </div>
            ) : null}

            {!isMobile && <div className="h-6 w-px bg-border mx-1"></div>}

            {!isMobile && <ColorPicker selectedColor={selectedColor} onColorChange={setSelectedColor} />}

            {!isMobile && <div className="h-6 w-px bg-border mx-1"></div>}

            <Button variant="ghost" size="icon" onClick={handleZoomOut} className="rounded-full h-8 w-8">
              <ZoomOut className="h-4 w-4" />
            </Button>

            <span className="text-xs font-mono w-12 text-center">{Math.round(zoom * 100)}%</span>

            <Button variant="ghost" size="icon" onClick={handleZoomIn} className="rounded-full h-8 w-8">
              <ZoomIn className="h-4 w-4" />
            </Button>

            {!isMobile && (
              <>
                <div className="h-6 w-px bg-border mx-1"></div>

                <div className="flex items-center gap-1 px-3 py-1 bg-primary/10 rounded-full">
                  <span className="text-xs font-medium">Pixels:</span>
                  <span className="text-xs font-mono font-bold">{remainingPixels}</span>
                </div>

                <Button
                  onClick={() => setShowPurchaseModal(true)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full"
                  size="sm"
                >
                  Buy Pixels
                </Button>
              </>
            )}
            
            {isMobile && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={toggleMobileMessage} 
                className="rounded-full h-8 w-8 ml-1"
              >
                <Info className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Purchase modal */}
        {showPurchaseModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-bold mb-4">Buy Pixel Packs</h3>
              <p className="mb-4">
                Each pack contains {pixelPackSize} pixels and costs {formatKasPrice(pixelPackCost)}.
              </p>

              <div className="flex items-center justify-between mb-6 bg-card p-3 rounded-lg">
                <Button variant="outline" size="icon" onClick={decrementPacks} disabled={packsToBuy <= 1}>
                  <Minus className="h-4 w-4" />
                </Button>
                <div className="text-center">
                  <div className="text-2xl font-bold">{packsToBuy}</div>
                  <div className="text-xs text-muted-foreground">Pack{packsToBuy > 1 ? "s" : ""}</div>
                </div>
                <Button variant="outline" size="icon" onClick={incrementPacks} disabled={packsToBuy >= 10}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex justify-between items-center mb-6">
                <span className="text-sm">Total pixels:</span>
                <span className="font-bold">{packsToBuy * pixelPackSize}</span>
              </div>

              <div className="flex justify-between items-center mb-6">
                <span className="text-sm">Total cost:</span>
                <span className="font-bold">{formatKasPrice(packsToBuy * pixelPackCost)}</span>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowPurchaseModal(false)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleBuyPixels}
                  disabled={isPaying || !isConnected || packsToBuy * pixelPackCost <= 0}
                >
                  {isPaying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
                    </>
                  ) : (
                    `Buy for ${formatKasPrice(packsToBuy * pixelPackCost)}`
                  )}
                </Button>
              </div>
              
              {!isInstalled && (
                <div className="mt-4 p-3 bg-yellow-100 text-yellow-800 rounded-md text-sm">
                  KasWare wallet is not installed. Please install the KasWare wallet extension to buy pixels.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Transaction metrics modal */}
        {showTransactionMetrics && (
          <TransactionMetrics
            transactionId={currentTransaction}
            verified={transactionVerified}
            transactionTime={transactionTime}
            fastestTime={fastestTransactionTime}
            onClose={handleTransactionMetricsClose}
          />
        )}
      </div>
    </div>
  )
}

