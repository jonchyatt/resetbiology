"use client"

import { useState, useEffect } from "react"
import { AlertTriangle, X } from "lucide-react"
import Link from "next/link"

export function UrgencyBanner() {
  const [isVisible, setIsVisible] = useState(true)
  const [spotsRemaining, setSpotsRemaining] = useState(12)

  useEffect(() => {
    // Simulate decreasing spots (for psychological urgency)
    const interval = setInterval(() => {
      setSpotsRemaining(prev => {
        const newValue = prev - Math.floor(Math.random() * 2)
        return newValue < 3 ? 3 : newValue
      })
    }, 30000) // Update every 30 seconds

    return () => clearInterval(interval)
  }, [])

  if (!isVisible) return null

  return (
    <div className="fixed top-16 left-0 right-0 z-30 bg-gradient-to-r from-orange-500 to-red-500 text-white py-3 px-4 shadow-lg">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm md:text-base font-medium">
            <strong>Limited Research Spots:</strong> Only {spotsRemaining} IRB-approved positions remaining this month
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          <Link 
            href="/assessment" 
            className="bg-white text-orange-600 hover:bg-gray-100 px-4 py-2 rounded-lg font-bold text-sm transition-colors"
          >
            Secure Spot
          </Link>
          <button
            onClick={() => setIsVisible(false)}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}