"use client"

import { useState } from "react"
import { AlertTriangle, Info } from "lucide-react"

export function MuscleWarning() {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div className="relative">
      {/* Warning Box */}
      <div
        className="bg-red-500/10 border border-red-400/50 rounded-lg p-4 backdrop-blur-sm cursor-help transition-all duration-300 hover:bg-red-500/20 hover:border-red-400"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-300 font-semibold text-base lg:text-lg leading-tight">
              STOP!! You're not losing weight...
            </p>
            <p className="text-red-200 font-bold text-base lg:text-lg">
              you're losing <span className="underline">MUSCLE!</span>
            </p>
            <div className="flex items-center gap-1 mt-2">
              <Info className="w-4 h-4 text-red-300/70" />
              <span className="text-xs text-red-300/70">Hover for details</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      <div
        className={`absolute left-0 right-0 top-full mt-2 z-50 transition-all duration-300 ${
          showTooltip
            ? 'opacity-100 transform translate-y-0 pointer-events-auto'
            : 'opacity-0 transform -translate-y-2 pointer-events-none'
        }`}
      >
        <div className="bg-gray-900/95 backdrop-blur-md border border-red-400/30 rounded-lg p-4 shadow-2xl">
          <div className="space-y-3">
            <h4 className="text-red-300 font-semibold text-sm uppercase tracking-wider">
              The Hidden Danger of Lower-Tier GLP-1s
            </h4>

            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-1">•</span>
                <span className="text-gray-300">
                  <strong className="text-red-200">Studies show:</strong> GLP-1 users lose 25-39% of their weight as muscle mass
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-1">•</span>
                <span className="text-gray-300">
                  <strong className="text-red-200">Lower-tier GLP-1s</strong> like Semaglutide don't preserve lean tissue
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-1">•</span>
                <span className="text-gray-300">
                  <strong className="text-red-200">Result:</strong> Slower metabolism, weakness, and rapid weight regain
                </span>
              </li>
            </ul>

            <div className="pt-3 border-t border-gray-700">
              <p className="text-primary-300 text-sm font-medium">
                Learn how Retatrutide protects muscle while maximizing fat loss →
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}