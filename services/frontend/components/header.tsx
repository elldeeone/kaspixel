"use client"

import { useState } from "react"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useWallet } from "@/components/wallet-provider"
import Image from "next/image"

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { isConnected, connect, disconnect, address } = useWallet()

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <Image src="/kaspa-logo.svg" alt="KasPixel Logo" width={40} height={40} className="h-10 w-auto" />
          <span className="text-xl font-bold font-rubik">KasPixel</span>
        </div>

        <nav className="hidden md:flex items-center gap-6">
          <a href="#" className="text-muted-foreground hover:text-foreground transition-colors font-oswald">
            About
          </a>
          <a href="#" className="text-muted-foreground hover:text-foreground transition-colors font-oswald">
            Gallery
          </a>
          <a href="#" className="text-muted-foreground hover:text-foreground transition-colors font-oswald">
            FAQ
          </a>
        </nav>

        <div className="flex items-center gap-4">
          {isConnected ? (
            <div className="flex items-center gap-2">
              <span className="hidden md:inline text-sm text-muted-foreground font-lato">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </span>
              <Button variant="outline" onClick={disconnect}>
                Disconnect
              </Button>
            </div>
          ) : (
            <Button onClick={connect} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Connect Wallet
            </Button>
          )}

          <button className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="Toggle menu">
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden border-t">
          <div className="container py-4 flex flex-col gap-4">
            <a href="#" className="py-2 text-foreground font-oswald">
              About
            </a>
            <a href="#" className="py-2 text-foreground font-oswald">
              Gallery
            </a>
            <a href="#" className="py-2 text-foreground font-oswald">
              FAQ
            </a>
          </div>
        </div>
      )}
    </header>
  )
}

