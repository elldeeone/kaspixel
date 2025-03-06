"use client"

import { useState, useEffect, useRef } from 'react'

interface WebSocketMessage {
  type: string;
  data: any;
}

export function useWebSocket(url: string) {
  const [isConnected, setIsConnected] = useState(false)
  const [canvasState, setCanvasState] = useState<Record<string, string>>({})
  const [isConnecting, setIsConnecting] = useState(false)
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastPongRef = useRef<number>(Date.now())

  useEffect(() => {
    const connectWebSocket = () => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        return
      }

      setIsConnecting(true)
      console.log('Connecting to WebSocket...')
      
      try {
        // Fix the WebSocket URL format
        // Make sure we're using a proper WebSocket URL
        let wsUrl = url;
        
        // If we're in a browser environment
        if (typeof window !== 'undefined') {
          // If the URL is already a full URL, use it directly
          if (url.startsWith('ws://') || url.startsWith('wss://')) {
            wsUrl = url;
          } 
          // If it's a relative URL, construct it based on the current host
          else if (url.startsWith('/')) {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.host;
            wsUrl = `${protocol}//${host}${url}`;
          }
          // For any other URL format, use the current host
          else {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.host;
            wsUrl = `${protocol}//${host}/ws`;
          }
        }
        
        console.log(`Connecting to WebSocket: ${wsUrl}`);
        
        const socket = new WebSocket(wsUrl)

        socket.onopen = () => {
          console.log('WebSocket connected')
          setIsConnected(true)
          setIsConnecting(false)
          
          // Start sending ping messages to keep the connection alive
          if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current)
          }
          
          pingIntervalRef.current = setInterval(() => {
            try {
              if (socket.readyState === WebSocket.OPEN) {
                // Send a ping message every 15 seconds
                socket.send(JSON.stringify({ type: 'ping' }))
                console.log('Sent ping to server')
                
                // Check if we've received a pong recently
                const now = Date.now()
                if (now - lastPongRef.current > 45000) {
                  // No pong received in 45 seconds, reconnect
                  console.log('No pong received in 45 seconds, reconnecting...')
                  socket.close()
                }
              }
            } catch (error) {
              console.error('Error sending ping:', error)
            }
          }, 15000)
        }

        socket.onclose = (event) => {
          console.log(`WebSocket disconnected: ${event.code} ${event.reason}`)
          setIsConnected(false)
          setIsConnecting(false)
          
          // Clear ping interval
          if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current)
            pingIntervalRef.current = null
          }
          
          // Try to reconnect after a delay
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current)
          }
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Attempting to reconnect WebSocket...')
            connectWebSocket()
          }, 3000)
        }

        socket.onerror = (error) => {
          console.error('WebSocket error:', error)
          socket.close()
        }

        socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            console.log('Received WebSocket message:', message)

            if (message.type === 'canvas_state') {
              console.log(`Received canvas state with ${Object.keys(message.data).length} pixels`)
              setCanvasState(message.data)
            } else if (message.type === 'pixel_update') {
              const { x, y, color } = message.data
              console.log(`Received pixel update: (${x},${y}) -> ${color}`)
              
              // Update canvas state with the new pixel
              setCanvasState((prev) => {
                const newState = { ...prev };
                newState[`${x},${y}`] = color;
                console.log(`Updated canvas state with pixel at (${x},${y}) -> ${color}`);
                return newState;
              })
            } else if (message.type === 'pong' || message.type === 'ping') {
              // Update last pong time
              lastPongRef.current = Date.now()
              console.log('Received pong from server')
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error)
          }
        }

        socketRef.current = socket

        // Clean up on unmount
        return () => {
          if (socketRef.current) {
            socketRef.current.close()
          }
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current)
          }
          if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current)
          }
        }
      } catch (error) {
        console.error('Error connecting to WebSocket:', error)
        // Try to reconnect after a delay
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect WebSocket...')
          connectWebSocket()
        }, 3000)
      }
    }

    connectWebSocket()

    return () => {
      if (socketRef.current) {
        socketRef.current.close()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
      }
    }
  }, [url])

  return {
    canvasState,
    isConnected,
    isConnecting
  }
} 