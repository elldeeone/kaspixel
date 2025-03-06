import type { Metadata } from "next"
import PixelCanvas from "@/components/pixel-canvas"
import { WalletProvider } from "@/components/wallet-provider"
import Link from "next/link"
import Script from "next/script"

export const metadata: Metadata = {
  title: "KasPixel - Place Your Pixels",
  description: "Connect your KasWare wallet, pay for pixels, and leave your mark on the Kaspa community canvas.",
}

export default function Home() {
  const fullAddress = "kaspa:qqe57lvu4p4zhdlnlj6ne8hu0hgcfwwfzrhcgaenpt056k0hge85k7qtaw3m9"

  return (
    <WalletProvider>
      <div className="flex min-h-screen flex-col bg-background">
        <main className="flex-1 container mx-auto px-4 py-6">
          <section className="text-center">
            <h1 className="text-3xl md:text-4xl font-bold mb-2 font-rubik" style={{ color: "#70C7BA" }}>KasPixel</h1>
            <p className="text-lg md:text-xl text-muted-foreground font-oswald mb-1">
              Connect, Place, and Make Your Mark
            </p>
          </section>

          <section className="-mt-1">
            <PixelCanvas />
          </section>

          <footer className="py-3 px-6 text-center text-xs text-slate-500 mt-8">
            <p className="mb-2 font-inter">
              Made with <span className="text-red-500">❤</span> by{" "}
              <Link href="https://luke.dunshea.au" target="_blank" className="text-slate-500 hover:text-slate-400 transition-colors">
                Luke Dunshea
              </Link>
            </p>
            <p className="text-xs">
              Consider donating:
              <br />
              <Link 
                href={fullAddress} 
                className="hover:text-slate-400 transition-colors break-all"
              >
                {fullAddress}
              </Link>
            </p>
          </footer>
        </main>
      </div>
      
      {/* Structured Data for SEO */}
      <Script id="structured-data" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "name": "KasPixel",
        "description": "Connect your KasWare wallet, pay for pixels, and leave your mark on the Kaspa community canvas.",
        "url": "https://kaspixel.xyz",
        "applicationCategory": "Art",
        "operatingSystem": "Any",
        "offers": {
          "@type": "Offer",
          "price": "0.2",
          "priceCurrency": "KAS"
        },
        "author": {
          "@type": "Person",
          "name": "Luke Dunshea",
          "url": "https://luke.dunshea.au"
        }
      })}} />
    </WalletProvider>
  )
}

