"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Check, ChevronDown } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"

interface ColorPickerProps {
  selectedColor: string
  onColorChange: (color: string) => void
}

// Kaspa brand colors and some additional colors
const PRESET_COLORS = [
  "#70C7BA", // Kaspa primary
  "#49EACB", // Kaspa accent
  "#231F20", // Kaspa secondary
  "#B6B6B6", // Kaspa gray
  "#FFFFFF", // White
  "#000000", // Black
  "#FF5555", // Red
  "#55FF55", // Green
  "#5555FF", // Blue
  "#FFFF55", // Yellow
  "#FF55FF", // Magenta
  "#55FFFF", // Cyan
  "#FF9955", // Orange
  "#9955FF", // Purple
]

export default function ColorPicker({ selectedColor, onColorChange }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentColor, setCurrentColor] = useState(selectedColor)
  const colorWheelRef = useRef<HTMLDivElement>(null)

  // Reset internal color when selectedColor prop changes
  useEffect(() => {
    setCurrentColor(selectedColor)
  }, [selectedColor])

  // Handle color wheel interaction
  const handleColorWheelClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!colorWheelRef.current) return

    const rect = colorWheelRef.current.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2

    const x = e.clientX - rect.left - centerX
    const y = e.clientY - rect.top - centerY

    // Calculate hue from angle
    const angle = Math.atan2(y, x)
    const hue = ((angle * 180) / Math.PI + 360) % 360

    // Calculate saturation from distance
    const distance = Math.min(1, Math.sqrt(x * x + y * y) / centerX)
    const saturation = distance * 100

    // Fixed lightness for simplicity
    const lightness = 50

    // Convert HSL to hex
    setCurrentColor(hslToHex(hue, saturation, lightness))
  }

  // Handle lightness slider
  const handleLightnessChange = (value: number[]) => {
    // Extract current HSL from the color
    const hsl = hexToHsl(currentColor)
    // Update only the lightness
    setCurrentColor(hslToHex(hsl.h, hsl.s, value[0]))
  }

  // Handle hex input change
  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const formattedValue = value.startsWith("#") ? value : `#${value}`
    setCurrentColor(formattedValue)
  }

  // Apply the current color
  const applyCurrentColor = () => {
    if (isValidHex(currentColor)) {
      onColorChange(currentColor)
      setIsOpen(false)
    }
  }

  // Handle preset color selection
  const handlePresetSelect = (color: string) => {
    setCurrentColor(color)
    onColorChange(color)
    setIsOpen(false)
  }

  // Get HSL values for the current color
  const hsl = hexToHsl(currentColor)

  // Check if hex is valid
  function isValidHex(hex: string): boolean {
    return /^#[0-9A-Fa-f]{6}$/.test(hex)
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2 h-10 px-3">
          <div className="w-6 h-6 rounded-full border" style={{ backgroundColor: selectedColor }} />
          <span className="font-lato">{selectedColor}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4">
        <Tabs defaultValue="wheel">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="wheel">Color Wheel</TabsTrigger>
            <TabsTrigger value="presets">Presets</TabsTrigger>
          </TabsList>

          <TabsContent value="wheel" className="space-y-4">
            {/* Completely redesigned color wheel with solid white background */}
            <div className="w-full aspect-square rounded-full overflow-hidden border shadow-sm bg-white relative">
              {/* Add solid white background container */}
              <div className="absolute inset-0 bg-white"></div>
              <div
                ref={colorWheelRef}
                className="w-full h-full relative cursor-pointer"
                onClick={handleColorWheelClick}
              >
                {/* Color wheel gradient - using a pseudo-element to ensure it doesn't affect background */}
                <div
                  className="absolute inset-0 z-10"
                  style={{
                    background: `conic-gradient(
                      red, yellow, lime, aqua, blue, magenta, red
                    )`,
                    mixBlendMode: "normal",
                  }}
                ></div>

                {/* White radial gradient overlay */}
                <div
                  className="absolute inset-0 z-20"
                  style={{
                    background: "radial-gradient(circle, rgba(255,255,255,0) 0%, rgba(255,255,255,1) 100%)",
                    mixBlendMode: "normal",
                  }}
                ></div>

                {/* Color selection indicator */}
                <div
                  className="absolute w-4 h-4 rounded-full border-2 border-white transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30"
                  style={{
                    left: `${50 + Math.cos((hsl.h * Math.PI) / 180) * (hsl.s / 100) * 50}%`,
                    top: `${50 + Math.sin((hsl.h * Math.PI) / 180) * (hsl.s / 100) * 50}%`,
                    backgroundColor: currentColor,
                    boxShadow: "0 0 0 1px rgba(0,0,0,0.3)",
                  }}
                ></div>
              </div>
            </div>

            {/* Lightness slider */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm font-medium">Lightness</label>
                <span className="text-sm">{hsl.l}%</span>
              </div>
              <Slider
                value={[hsl.l]}
                min={0}
                max={100}
                step={1}
                onValueChange={handleLightnessChange}
                className="w-full"
              />
            </div>

            {/* Hex input */}
            <div className="flex gap-2 items-center">
              <Input value={currentColor} onChange={handleHexChange} className="flex-1" maxLength={7} />
              <div
                className="w-8 h-8 rounded-md border"
                style={{ backgroundColor: isValidHex(currentColor) ? currentColor : "#FF0000" }}
              />
            </div>

            <Button onClick={applyCurrentColor} className="w-full">
              Apply Color
            </Button>
          </TabsContent>

          <TabsContent value="presets">
            <div className="grid grid-cols-5 gap-2 mb-4">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  className="w-10 h-10 rounded-full border flex items-center justify-center transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary"
                  style={{ backgroundColor: color }}
                  onClick={() => handlePresetSelect(color)}
                  aria-label={`Select color ${color}`}
                >
                  {color === selectedColor && (
                    <Check className={`h-4 w-4 ${color === "#FFFFFF" ? "text-black" : "text-white"}`} />
                  )}
                </button>
              ))}
            </div>

            <Button onClick={() => setIsOpen(false)} className="w-full">
              Apply Color
            </Button>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  )
}

// Helper functions for color conversion
function hslToHex(h: number, s: number, l: number): string {
  h = h % 360
  s = Math.max(0, Math.min(100, s)) / 100
  l = Math.max(0, Math.min(100, l)) / 100

  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0,
    g = 0,
    b = 0

  if (0 <= h && h < 60) {
    r = c
    g = x
    b = 0
  } else if (60 <= h && h < 120) {
    r = x
    g = c
    b = 0
  } else if (120 <= h && h < 180) {
    r = 0
    g = c
    b = x
  } else if (180 <= h && h < 240) {
    r = 0
    g = x
    b = c
  } else if (240 <= h && h < 300) {
    r = x
    g = 0
    b = c
  } else if (300 <= h && h < 360) {
    r = c
    g = 0
    b = x
  }

  r = Math.round((r + m) * 255)
    .toString(16)
    .padStart(2, "0")
  g = Math.round((g + m) * 255)
    .toString(16)
    .padStart(2, "0")
  b = Math.round((b + m) * 255)
    .toString(16)
    .padStart(2, "0")

  return `#${r}${g}${b}`
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  // Default values in case of invalid hex
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    return { h: 0, s: 0, l: 0 }
  }

  // Convert hex to RGB
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0,
    s = 0,
    l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }

    h = Math.round(h * 60)
  }

  s = Math.round(s * 100)
  l = Math.round(l * 100)

  return { h, s, l }
}

