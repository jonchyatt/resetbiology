'use client'

import { useState } from 'react'
import { CheckCircle2, PartyPopper, Ruler, Sparkles } from 'lucide-react'

export interface WeeklyAssessmentEnrollment {
  initialNearSnellen?: string | null
  initialFarSnellen?: string | null
  currentNearSnellen?: string | null
  currentFarSnellen?: string | null
  currentWeek: number
}

export interface WeeklyAssessmentResult {
  npcCm?: number
}

export interface WeeklyAssessmentProps {
  enrollment: WeeklyAssessmentEnrollment
  lastWeekMetrics?: Record<string, number>
  onComplete: (results: WeeklyAssessmentResult) => void
  onSkip: () => void
  onOpenTrainer?: () => void
}

type Step = 'intro' | 'npc' | 'reveal'

function phaseOf(week: number): number {
  return Math.min(6, Math.max(1, Math.ceil(week / 2)))
}

function formatMetricLabel(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, character => character.toUpperCase())
}

export default function WeeklyAssessment({
  enrollment,
  lastWeekMetrics,
  onComplete,
  onSkip,
}: WeeklyAssessmentProps) {
  const [step, setStep] = useState<Step>('intro')
  const [npcCm, setNpcCm] = useState<number | null>(null)
  const [npcSlider, setNpcSlider] = useState(15)

  const phase = phaseOf(enrollment.currentWeek)
  const previousNpcCm = typeof lastWeekMetrics?.npcCm === 'number' ? lastWeekMetrics.npcCm : null
  const npcDeltaCm = npcCm !== null && previousNpcCm !== null ? previousNpcCm - npcCm : null
  const otherBestMetrics = Object.entries(lastWeekMetrics || {}).filter(([key]) => key !== 'npcCm')

  return (
    <div className="max-w-md mx-auto w-full">
      <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-2xl">
        <div className="flex items-center justify-center gap-2 mb-5">
          {(['intro', 'npc', 'reveal'] as Step[]).map(item => (
            <span
              key={item}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                item === step ? 'w-6 bg-primary-400' : 'w-1.5 bg-gray-600'
              }`}
            />
          ))}
        </div>

        {step === 'intro' && (
          <div className="text-center space-y-4">
            <Sparkles className="w-10 h-10 text-primary-400 mx-auto" />
            <h3 className="text-xl font-bold text-white">Phase {phase} check-in</h3>
            <p className="text-gray-300 text-sm leading-6">
              Review what this phase actually recorded. A ruler-based near-point check is
              optional; screen pixels alone will never be presented as clinical acuity.
            </p>
            <button
              onClick={() => setStep('npc')}
              className="w-full min-h-11 px-6 py-3 bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-primary-500/30"
            >
              Start Check-In
            </button>
            <button
              onClick={onSkip}
              className="w-full min-h-11 text-gray-400 hover:text-gray-300 text-sm font-medium transition-colors"
            >
              Skip this check-in
            </button>
          </div>
        )}

        {step === 'npc' && (
          <div className="space-y-5 text-center">
            <Ruler className="w-8 h-8 text-primary-400 mx-auto" />
            <h3 className="text-lg font-bold text-white">Measured near point (optional)</h3>
            <p className="text-gray-300 text-sm">
              If you used a physical ruler, choose the distance where the target first blurred.
              Otherwise, skip this measurement.
            </p>
            <input
              type="range"
              min={3}
              max={30}
              value={npcSlider}
              onChange={event => setNpcSlider(Number(event.target.value))}
              aria-label="Measured near-point distance"
              aria-valuetext={`${npcSlider} centimeters`}
              className="w-full mb-1 accent-primary-400 h-11"
            />
            <p className="text-primary-300 text-center font-semibold">{npcSlider} cm</p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setNpcCm(null)
                  setStep('reveal')
                }}
                className="flex-1 min-h-11 px-5 py-3 bg-gray-700/80 hover:bg-gray-600/80 text-white rounded-lg font-semibold transition-all duration-300"
              >
                Skip
              </button>
              <button
                onClick={() => {
                  setNpcCm(npcSlider)
                  setStep('reveal')
                }}
                className="flex-1 min-h-11 px-5 py-3 bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white rounded-lg font-semibold transition-all duration-300"
              >
                Log measured distance
              </button>
            </div>
          </div>
        )}

        {step === 'reveal' && (
          <div className="space-y-5">
            <div className="text-center">
              <PartyPopper className="w-9 h-9 text-secondary-400 mx-auto mb-2" />
              <h3 className="text-lg font-bold text-white">Your honest phase record</h3>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {npcCm !== null && (
                <div className="bg-gray-900/50 rounded-lg p-4 border border-primary-400/20">
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2">
                    Ruler-measured near point
                  </p>
                  <p className="text-white font-bold text-lg text-center">{npcCm} cm</p>
                  <p className="text-center text-xs font-semibold mt-2 text-primary-300">
                    {npcDeltaCm === null
                      ? 'Logged—this becomes your measured reference point.'
                      : npcDeltaCm > 0
                        ? `${npcDeltaCm} cm closer than the previous measured check`
                        : npcDeltaCm === 0
                          ? 'Holding steady.'
                          : 'Day-to-day variation is visible; keep the next comparison measured the same way.'}
                  </p>
                </div>
              )}

              {otherBestMetrics.length > 0 && (
                <div className="bg-gray-900/50 rounded-lg p-4 border border-primary-400/20">
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-secondary-400" />
                    Recorded training signals
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {otherBestMetrics.map(([key, value]) => (
                      <div key={key} className="flex justify-between text-xs">
                        <span className="text-gray-400">{formatMetricLabel(key)}</span>
                        <span className="text-white font-semibold">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {npcCm === null && otherBestMetrics.length === 0 && (
                <p className="text-gray-300 text-sm text-center leading-6">
                  Nothing was invented to fill this card. Complete guided exercises and future
                  check-ins will add real training signals here.
                </p>
              )}
            </div>

            <button
              onClick={() => onComplete(npcCm === null ? {} : { npcCm })}
              className="w-full min-h-11 px-6 py-3 bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-primary-500/30"
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
