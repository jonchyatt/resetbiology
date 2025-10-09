"use client"

import { useState } from "react"

export function MuscleWarning() {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div className="relative">
      {/* Glass Stop Sign Design */}
      <div
        className="relative cursor-help group"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {/* Octagonal stop sign shape with glassmorphism */}
        <div className="relative aspect-square max-w-[200px] mx-auto">
          {/* Glow effect behind */}
          <div className="absolute inset-0 bg-red-500/30 blur-2xl rounded-full animate-pulse"></div>

          {/* Octagon stop sign */}
          <div className="relative w-full h-full" style={{ clipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)' }}>
            {/* Glass background */}
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/40 to-red-700/60 backdrop-blur-md border-4 border-white/30 shadow-2xl group-hover:border-white/50 transition-all duration-300"></div>

            {/* Content */}
            <div className="relative h-full flex flex-col items-center justify-center p-6 text-center">
              <div className="text-white font-black text-4xl mb-2 drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
                STOP
              </div>
              <div className="space-y-1">
                <p className="text-white text-xs font-semibold drop-shadow-lg">You're not losing</p>
                <p className="text-white text-xs font-semibold drop-shadow-lg">weight...</p>
                <p className="text-white text-sm font-black drop-shadow-lg">you're losing</p>
                <p className="text-yellow-300 text-lg font-black drop-shadow-lg underline decoration-2">MUSCLE!</p>
              </div>
              <p className="text-white/80 text-[10px] mt-3 font-medium drop-shadow-lg">Hover for evidence</p>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed tooltip with citations */}
      <div
        className={`absolute left-0 top-full mt-2 w-[420px] z-50 transition-all duration-300 ${
          showTooltip
            ? 'opacity-100 transform translate-y-0 pointer-events-auto'
            : 'opacity-0 transform -translate-y-2 pointer-events-none'
        }`}
      >
        <div className="bg-gray-900/98 backdrop-blur-md border border-red-400/40 rounded-lg p-5 shadow-2xl max-h-[500px] overflow-y-auto">
          <h4 className="text-red-300 font-bold mb-3 text-sm flex items-center">
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
            </svg>
            Clinical Evidence:
          </h4>

          <div className="space-y-3 text-xs text-gray-200">
            {/* Semaglutide */}
            <div className="border-l-2 border-red-400/30 pl-3">
              <p className="font-semibold text-red-300 mb-1">Semaglutide (Ozempic/Wegovy) - STEP-1 Trial</p>
              <p className="leading-relaxed mb-2">
                In the 68-week trial, patients lost 17.3 kg total weight, with <span className="text-red-300 font-bold">6.9 kg (40%) coming from lean muscle</span>.
                This represents approximately <span className="text-red-300 font-bold">10% total muscle loss</span> — equivalent to <span className="text-red-300 font-bold">20 years</span> of normal age-related decline.
              </p>
              <p className="text-gray-400 text-[10px] italic">
                Source: Wilding et al., NEJM (STEP-1); Drugs.com Medical Review, 2025
              </p>
            </div>

            {/* Tirzepatide */}
            <div className="border-l-2 border-orange-400/30 pl-3">
              <p className="font-semibold text-orange-300 mb-1">Tirzepatide (Mounjaro) - SURMOUNT-1</p>
              <p className="leading-relaxed mb-2">
                More favorable than semaglutide but still problematic: <span className="text-orange-300 font-bold">~25% of weight lost was lean mass</span>.
                Body composition showed 33.9% decrease in fat vs 10.9% decrease in lean mass over 72 weeks.
              </p>
              <p className="text-gray-400 text-[10px] italic">
                Source: Dr. Sue Pedersen, 2023; SURMOUNT-1 DEXA analysis; Henkel et al., Int. J. Nutrology, 2025
              </p>
            </div>

            {/* Sarcopenia Risks */}
            <div className="border-l-2 border-yellow-400/30 pl-3">
              <p className="font-semibold text-yellow-300 mb-1">Age-Related Muscle Loss (Sarcopenia)</p>
              <ul className="space-y-1 leading-relaxed mb-2">
                <li className="flex items-start gap-1">
                  <span className="text-yellow-400 mt-0.5">•</span>
                  <span><span className="text-yellow-300 font-bold">1.9× higher mortality risk</span> in older adults with sarcopenia</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-yellow-400 mt-0.5">•</span>
                  <span><span className="text-yellow-300 font-bold">2× hospitalization rates</span> compared to those with normal muscle</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-yellow-400 mt-0.5">•</span>
                  <span>Muscle loss accelerates after age 60: <span className="text-yellow-300 font-bold">3-8% per decade</span></span>
                </li>
              </ul>
              <p className="text-gray-400 text-[10px] italic">
                Source: Benz et al., JAMA Network Open, 2024; NIH News in Health, 2025
              </p>
            </div>

            {/* Recovery Difficulty */}
            <div className="border-l-2 border-purple-400/30 pl-3">
              <p className="font-semibold text-purple-300 mb-1">Why Lost Muscle is Hard to Regain</p>
              <ul className="space-y-1 leading-relaxed mb-2">
                <li className="flex items-start gap-1">
                  <span className="text-purple-400 mt-0.5">•</span>
                  <span><span className="font-bold">Anabolic resistance:</span> Older muscles respond 50% less to protein and exercise</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-purple-400 mt-0.5">•</span>
                  <span><span className="font-bold">Satellite cell decline:</span> Fewer muscle stem cells to rebuild tissue</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-purple-400 mt-0.5">•</span>
                  <span>Older adults regain only <span className="text-purple-300 font-bold">~80% of lost muscle</span> after disuse</span>
                </li>
              </ul>
              <p className="text-gray-400 text-[10px] italic">
                Source: Welle et al., J. Gerontol., 1996; Frontiers in Physiology, 2022; Damanti et al., Nutrients, 2024
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-700">
            <p className="text-gray-300 text-[11px] leading-relaxed">
              <span className="font-semibold text-white">Bottom line:</span> Prevention is far easier than reversal.
              Once muscle is lost with age, hormonal changes, inflammation, and mitochondrial dysfunction make recovery extremely difficult.
            </p>
            <p className="text-gray-400 text-[10px] mt-2 italic">
              Source: Huang et al., Front. Cell Dev. Biol., 2025
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
