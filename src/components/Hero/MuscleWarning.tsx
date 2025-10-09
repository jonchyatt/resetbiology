"use client"

import { useState } from "react"

export function MuscleWarning() {
  const [showTooltip, setShowTooltip] = useState(false)
  const [showTicker, setShowTicker] = useState(false)

  // Clinical evidence data for streaming ticker
  const evidenceItems = [
    "STEP-1 Trial: Semaglutide patients lost 40% muscle (6.9 kg of 17.3 kg total)",
    "Equivalent to 20 YEARS of normal age-related muscle decline",
    "SURMOUNT-1: Tirzepatide - 25% of weight lost was lean muscle mass",
    "Sarcopenia increases mortality risk by 1.9× in older adults",
    "2× higher hospitalization rates with muscle loss",
    "Older adults regain only ~80% of lost muscle after disuse",
    "Anabolic resistance: Older muscles respond 50% less to protein",
    "Prevention is FAR easier than reversal of muscle loss"
  ]

  return (
    <div className="relative">
      {/* Glass Rectangle Container - matches WhenToStart styling */}
      <div
        className="relative overflow-visible rounded-xl bg-gradient-to-br from-red-900/70 to-red-800/70 backdrop-blur-sm border border-red-500/50 p-6 min-h-[280px] flex items-center justify-center cursor-help group"
        onMouseEnter={() => { setShowTooltip(true); setShowTicker(true); }}
        onMouseLeave={() => { setShowTooltip(false); setShowTicker(false); }}
      >
        {/* Content */}
        <div className="relative z-10 text-center">
          <div className="text-white font-black text-4xl md:text-5xl mb-3 drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
            STOP!
          </div>
          <div className="space-y-2">
            <p className="text-white text-base md:text-lg font-semibold drop-shadow-lg">You're not losing weight...</p>
            <p className="text-white text-xl md:text-2xl font-black drop-shadow-lg">you're losing</p>
            <p className="text-yellow-300 text-2xl md:text-3xl font-black drop-shadow-[0_0_15px_rgba(253,224,71,0.6)] underline decoration-2">
              MUSCLE!
            </p>
          </div>
          <p className="text-white/80 text-xs mt-4 font-medium drop-shadow-lg">Hover for evidence</p>
        </div>
      </div>

      {/* Streaming Ticker with Clinical Evidence */}
      <div
        className={`absolute left-0 top-full mt-2 w-full max-w-2xl z-50 transition-all duration-300 ${
          showTicker
            ? 'opacity-100 transform translate-y-0 pointer-events-auto'
            : 'opacity-0 transform -translate-y-2 pointer-events-none'
        }`}
      >
        <div className="bg-green-500/10 backdrop-blur-sm border border-green-500/30 rounded-lg overflow-hidden">
          {/* Ticker Container */}
          <div className="relative h-10 flex items-center overflow-hidden">
            {/* Scrolling Text */}
            <div className="ticker-content whitespace-nowrap animate-ticker">
              {evidenceItems.map((item, idx) => (
                <span key={idx} className="inline-block text-red-400 font-semibold text-sm mx-8">
                  🚨 {item}
                </span>
              ))}
              {/* Duplicate for seamless loop */}
              {evidenceItems.map((item, idx) => (
                <span key={`dup-${idx}`} className="inline-block text-red-400 font-semibold text-sm mx-8">
                  🚨 {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Add ticker animation CSS */}
      <style jsx>{`
        @keyframes ticker {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-ticker {
          display: inline-block;
          animation: ticker 60s linear infinite;
        }
        .animate-ticker:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  )
}
