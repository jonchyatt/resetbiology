"use client"

import { useState } from "react"

export function MuscleWarning() {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div className="relative">
      {/* Compact sidebar-style warning */}
      <div
        className="bg-red-500/10 border-l-4 border-red-400 rounded-r-lg p-3 backdrop-blur-sm cursor-help hover:bg-red-500/15 transition-all duration-200"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-red-300 font-semibold text-sm">STOP!</p>
            <p className="text-red-200 text-xs">You're not losing weight...</p>
            <p className="text-red-100 font-bold text-sm">you're losing <span className="underline">MUSCLE!</span></p>
            <p className="text-red-300/60 text-[10px] mt-1">Hover for evidence</p>
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
