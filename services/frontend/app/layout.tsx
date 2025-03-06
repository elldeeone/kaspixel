import type React from "react"
import "./globals.css"
import type { Metadata, Viewport } from "next"
import { Toaster } from "@/components/ui/toaster"
import { Rubik, Oswald, Lato } from "next/font/google"

// Initialize the fonts
const rubik = Rubik({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-rubik",
})

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-oswald",
})

const lato = Lato({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  variable: "--font-lato",
})

export const viewport: Viewport = {
  themeColor: '#70C7BA',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  title: "KasPixel - Place Your Pixels",
  description: "Connect your KasWare wallet, pay for pixels, and leave your mark on the Kaspa community canvas. Join the collaborative pixel art project using Kaspa.",
  generator: 'Next.js',
  applicationName: 'KasPixel',
  keywords: ['Kaspa', 'KasPixel', 'cryptocurrency', 'pixel art', 'NFT', 'crypto art', 'digital canvas', 'community art', 'KasWare'],
  authors: [{ name: 'Luke Dunshea', url: 'https://luke.dunshea.au' }],
  creator: 'Luke Dunshea',
  publisher: 'Luke Dunshea',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://kaspixel.xyz'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'KasPixel - Place Your Pixels',
    description: 'Connect your KasWare wallet, pay for pixels, and leave your mark on the Kaspa community canvas.',
    url: 'https://kaspixel.xyz',
    siteName: 'KasPixel',
    images: [
      {
        url: '/favicons/android-chrome-512x512.png',
        width: 512,
        height: 512,
        alt: 'KasPixel Logo',
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'KasPixel - Place Your Pixels',
    description: 'Connect your KasWare wallet, pay for pixels, and leave your mark on the Kaspa community canvas.',
    images: ['/favicons/android-chrome-512x512.png'],
    creator: '@lukedunshea',
  },
  icons: {
    icon: [
      { url: '/favicon.png', sizes: '192x192', type: 'image/png' },
      { url: '/favicon.ico', sizes: '192x192' },
      { url: '/favicons/favicon-512x512.png', sizes: '512x512', type: 'image/png' },
      { url: '/favicons/favicon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/favicons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [
      { url: '/favicons/apple-touch-icon.png' },
    ],
    other: [
      {
        rel: 'mask-icon',
        url: '/favicons/favicon-192x192.png',
      },
    ],
  },
  manifest: '/favicons/site.webmanifest',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${rubik.variable} ${oswald.variable} ${lato.variable}`}>
      <head>
        <link rel="icon" href="/favicon.png" sizes="192x192" type="image/png" />
        <link rel="icon" href="/favicon.ico" sizes="192x192" />
        <link rel="icon" href="/favicons/favicon-512x512.png" sizes="512x512" type="image/png" />
        <link rel="icon" href="/favicons/favicon-192x192.png" sizes="192x192" type="image/png" />
        <link rel="icon" href="/favicons/favicon-32x32.png" sizes="32x32" type="image/png" />
        <link rel="icon" href="/favicons/favicon-16x16.png" sizes="16x16" type="image/png" />
        <link rel="apple-touch-icon" href="/favicons/apple-touch-icon.png" />
        <link rel="manifest" href="/favicons/site.webmanifest" />
        <meta name="msapplication-config" content="/favicons/browserconfig.xml" />
        <meta name="theme-color" content="#70C7BA" />
      </head>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  )
}



import './globals.css'