"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { useToast } from "@/components/ui/use-toast"
import { useKasware } from "../lib/hooks/useKasware"

interface WalletContextType {
  isConnected: boolean
  isInstalled: boolean
  address: string | null
  balance: number
  error: string | null
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  sendTransaction: (toAddress: string, sompi: number, options?: { priorityFee?: number }) => Promise<string | undefined>
}

const WalletContext = createContext<WalletContextType>({
  isConnected: false,
  isInstalled: false,
  address: null,
  balance: 0,
  error: null,
  connect: async () => {},
  disconnect: async () => {},
  sendTransaction: async () => undefined,
})

export const useWallet = () => useContext(WalletContext)

export function WalletProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast()
  const {
    isInstalled,
    isConnected,
    address,
    balance,
    error: walletError,
    connect: connectKasware,
    disconnect: disconnectKasware,
    sendTransaction: sendKaswareTransaction,
  } = useKasware()

  // Connect wallet function
  const connect = async () => {
    if (!isInstalled) {
      toast({
        title: "Wallet not installed",
        description: "Please install the KasWare wallet extension to continue.",
        variant: "destructive",
      })
      return
    }
    
    try {
      await connectKasware()
      
      if (isConnected) {
        toast({
          title: "Wallet connected",
          description: "Your KasWare wallet has been successfully connected.",
        })
      }
    } catch (error) {
      toast({
        title: "Connection failed",
        description: "Failed to connect to your KasWare wallet. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Disconnect wallet function
  const disconnect = async () => {
    try {
      await disconnectKasware()
      
      toast({
        title: "Wallet disconnected",
        description: "Your KasWare wallet has been disconnected.",
      })
    } catch (error) {
      toast({
        title: "Disconnection failed",
        description: "Failed to disconnect your KasWare wallet. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Send transaction function
  const sendTransaction = async (toAddress: string, sompi: number, options?: { priorityFee?: number }) => {
    if (!isInstalled) {
      toast({
        title: "Wallet not installed",
        description: "Please install the KasWare wallet extension to continue.",
        variant: "destructive",
      })
      throw new Error("Wallet not installed")
    }
    
    if (!isConnected) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your KasWare wallet to continue.",
        variant: "destructive",
      })
      throw new Error("Wallet not connected")
    }
    
    try {
      console.log(`Sending transaction: ${sompi} sompi (${sompi / 100000000} KAS) to ${toAddress}`)
      
      // Ensure sompi is a number (not a string)
      const sompiAmount = Number(sompi)
      
      // Add transaction options to handle the "Storage mass exceeds maximum" error
      // Setting a small priority fee can help with this issue
      const txOptions = options || {
        priorityFee: 1, // Add a small priority fee (1 sompi)
      }
      
      console.log(`Debug - sompiAmount: ${sompiAmount}`)
      console.log(`Debug - sompiAmount type: ${typeof sompiAmount}`)
      console.log(`Debug - sompiAmount in KAS: ${sompiAmount / 100000000}`)
      console.log(`Debug - txOptions:`, txOptions)
      
      // Use the original sompiAmount without any adjustment
      const adjustedSompiAmount = sompiAmount
      console.log(`Debug - adjustedSompiAmount: ${adjustedSompiAmount} (${adjustedSompiAmount / 100000000} KAS)`)
      
      console.log(`Calling window.kasware.sendKaspa with:`, {
        toAddress,
        sompiAmount: adjustedSompiAmount,
        sompiType: typeof adjustedSompiAmount,
        options: txOptions
      })
      
      // Use the direct window.kasware object as per the documentation
      if (window.kasware) {
        // Ensure the amount is a number and not a string or other type
        const txId = await window.kasware.sendKaspa(toAddress, adjustedSompiAmount, txOptions)
        console.log("Transaction sent with ID:", txId)
        return txId
      } else {
        throw new Error("Kasware wallet not available")
      }
    } catch (error) {
      console.error("Transaction error:", error)
      toast({
        title: "Transaction failed",
        description: error instanceof Error ? error.message : "Failed to send transaction. Please try again.",
        variant: "destructive",
      })
      throw error
    }
  }

  // Show error toast when wallet error changes
  useEffect(() => {
    if (walletError) {
      toast({
        title: "Wallet error",
        description: walletError,
        variant: "destructive",
      })
    }
  }, [walletError, toast])

  return (
    <WalletContext.Provider 
      value={{ 
        isConnected, 
        isInstalled,
        address, 
        balance: balance?.total || 0, 
        error: walletError,
        connect, 
        disconnect,
        sendTransaction,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

