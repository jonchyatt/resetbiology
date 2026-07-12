'use client'

import { useMemo, useState } from 'react'
import { Sparkles, Eye, Ruler, CheckCircle2, PartyPopper } from 'lucide-react'

/**
 * WeeklyAssessment — end-of-phase before/after ritual (W2.6).
 * Plan-of-record: docs/plans/vision-training-interactive-overhaul.md §Tier 2 W2.6.
 *
 * Guided re-baseline (near/far Snellen self-test + optional NPC) with a
 * before/after reveal. This is the retention hook — visible proof it's working.
 * Copy rule (plan §4.9): these are training-performance numbers / the user's own
 * logged Snellen self-tests — never imply clinically measured acuity improvement.
 * The orchestrator wires this into the session flow; it is NOT self-wiring.
 */

export interface WeeklyAssessmentEnrollment {
  initialNearSnellen?: string | null
  initialFarSnellen?: string | null
  currentNearSnellen?: string | null
  currentFarSnellen?: string | null
  currentWeek: number
}

export interface WeeklyAssessmentResult {
  nearSnellen: string
  farSnellen: string
  npcCm?: number
}

export interface WeeklyAssessmentProps {
  enrollment: WeeklyAssessmentEnrollment
  /** Best metrics logged so far this phase (from guided-session engine results). Informational — not re-measured here. */
  lastWeekMetrics?: Record<string, number>
  onComplete: (results: WeeklyAssessmentResult) => void
  onSkip: () => void
  /** Optional affordance — parent may open the full Snellen trainer instead of the quick select. */
  onOpenTrainer?: () => void
}

const SNELLEN_OPTIONS = ['20/200', '20/100', '20/70', '20/50', '20/40', '20/30', '20/25', '20/20', '20/15']

type Step = 'intro' | 'snellen' | 'npc' | 'reveal'

function snellenIndex(raw: string | null | undefined): number | null {
  if (!raw) return null
  const idx = SNELLEN_OPTIONS.indexOf(raw)
  return idx === -1 ? null : idx
}

function phaseOf(week: number): number {
  return Math.min(6, Math.max(1, Math.ceil(week / 2)))
}

function formatMetricLabel(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, c => c.toUpperCase())
}

function snellenDeltaCopy(beforeRaw: string | null | undefined, afterRaw: string): { headline: string; tone: 'up' | 'flat' | 'steady' } {
  const before = snellenIndex(beforeRaw)
  const after = snellenIndex(afterRaw)
  if (before === null || after === null) {
    return { headline: 'This becomes your reference point.', tone: 'flat' }
  }
  const delta = after - before // higher index = smaller denominator = sharper line
  if (delta > 0) {
    return { headline: `Sharper by ${delta} line${delta > 1 ? 's' : ''}`, tone: 'up' }
  }
  if (delta === 0) {
    return { headline: 'Holding steady — consistency is the win.', tone: 'steady' }
  }
  return { headline: 'Some day-to-day variation is normal — stay consistent.', tone: 'flat' }
}

export default function WeeklyAssessment({
  enrollment,
  lastWeekMetrics,
  onComplete,
  onSkip,
  onOpenTrainer,
}: WeeklyAssessmentProps) {
  const [step, setStep] = useState<Step>('intro')
  const [nearSnellen, setNearSnellen] = useState(enrollment.currentNearSnellen || '')
  const [farSnellen, setFarSnellen] = useState(enrollment.currentFarSnellen || '')
  const [npcCm, setNpcCm] = useState<number | null>(null)
  const [npcSlider, setNpcSlider] = useState(15)

  const phase = phaseOf(enrollment.currentWeek)
  const canContinueSnellen = nearSnellen.length > 0 && farSnellen.length > 0

  const nearDelta = useMemo(
    () => (nearSnellen ? snellenDeltaCopy(enrollment.initialNearSnellen, nearSnellen) : null),
    [enrollment.initialNearSnellen, nearSnellen]
  )
  const farDelta = useMemo(
    () => (farSnellen ? snellenDeltaCopy(enrollment.initialFarSnellen, farSnellen) : null),
    [enrollment.initialFarSnellen, farSnellen]
  )

  const npcPrevious = typeof lastWeekMetrics?.npcCm === 'number' ? lastWeekMetrics.npcCm : null
  const npcDeltaCm = npcCm !== null && npcPrevious !== null ? npcPrevious - npcCm : null

  const otherBestMetrics = Object.entries(lastWeekMetrics || {}).filter(([key]) => key !== 'npcCm')

  const handleFinish = () => {
    onComplete({
      nearSnellen,
      farSnellen,
      ...(npcCm !== null ? { npcCm } : {}),
    })
  }

  return (
    <div className="max-w-md mx-auto w-full">
      <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-2xl">
        {/* Step dots */}
        <div className="flex items-center justify-center gap-2 mb-5">
          {(['intro', 'snellen', 'npc', 'reveal'] as Step[]).map(s => (
            <span
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s === step ? 'w-6 bg-primary-400' : 'w-1.5 bg-gray-600'
              }`}
            />
          ))}
        </div>

        {step === 'intro' && (
          <div className="text-center space-y-4">
            <Sparkles className="w-10 h-10 text-primary-400 mx-auto" />
            <h3 className="text-xl font-bold text-white">Phase {phase} check-in — let's see what changed</h3>
            <p className="text-gray-300 text-sm">
              Two quick self-tests, then a before/after reveal. This is your proof it's working.
            </p>
            <button
              onClick={() => setStep('snellen')}
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

        {step === 'snellen' && (
          <div className="space-y-5">
            <div className="text-center">
              <Eye className="w-8 h-8 text-primary-400 mx-auto mb-2" />
              <h3 className="text-lg font-bold text-white">Read your Snellen line</h3>
              <p className="text-gray-400 text-xs mt-1">Read as far down the chart as you clearly can, near and far.</p>
              {onOpenTrainer && (
                <button
                  onClick={onOpenTrainer}
                  className="text-primary-300 hover:text-primary-200 text-xs font-semibold underline underline-offset-2 mt-2"
                >
                  Open Snellen trainer first
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="text-gray-300 text-sm block mb-2">Near Vision Snellen</label>
                <select
                  value={nearSnellen}
                  onChange={e => setNearSnellen(e.target.value)}
                  className="w-full min-h-11 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                >
                  <option value="">Select...</option>
                  {SNELLEN_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-gray-300 text-sm block mb-2">Far Vision Snellen</label>
                <select
                  value={farSnellen}
                  onChange={e => setFarSnellen(e.target.value)}
                  className="w-full min-h-11 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                >
                  <option value="">Select...</option>
                  {SNELLEN_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onSkip}
                className="flex-1 min-h-11 px-5 py-3 bg-gray-700/80 hover:bg-gray-600/80 text-white rounded-lg font-semibold transition-all duration-300"
              >
                Skip
              </button>
              <button
                onClick={() => setStep('npc')}
                disabled={!canContinueSnellen}
                className="flex-1 min-h-11 px-5 py-3 bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white rounded-lg font-semibold transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 'npc' && (
          <div className="space-y-5 text-center">
            <Ruler className="w-8 h-8 text-primary-400 mx-auto" />
            <h3 className="text-lg font-bold text-white">Quick check (optional)</h3>
            <p className="text-gray-300 text-sm">How close before the letters blur?</p>
            <input
              type="range"
              min={3}
              max={30}
              value={npcSlider}
              onChange={e => setNpcSlider(Number(e.target.value))}
              className="w-full mb-1 accent-primary-400 h-11"
            />
            <p className="text-primary-300 text-center font-semibold">{npcSlider} cm</p>
            <div className="flex gap-3">
              <button
                onClick={() => { setNpcCm(null); setStep('reveal') }}
                className="flex-1 min-h-11 px-5 py-3 bg-gray-700/80 hover:bg-gray-600/80 text-white rounded-lg font-semibold transition-all duration-300"
              >
                Skip
              </button>
              <button
                onClick={() => { setNpcCm(npcSlider); setStep('reveal') }}
                className="flex-1 min-h-11 px-5 py-3 bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white rounded-lg font-semibold transition-all duration-300"
              >
                Log & Continue
              </button>
            </div>
          </div>
        )}

        {step === 'reveal' && (
          <div className="space-y-5">
            <div className="text-center">
              <PartyPopper className="w-9 h-9 text-secondary-400 mx-auto mb-2" />
              <h3 className="text-lg font-bold text-white">Here's what changed</h3>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {/* Near vision before/after */}
              <div className="bg-gray-900/50 rounded-lg p-4 border border-primary-400/20">
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2">Near Vision</p>
                <div className="flex items-center justify-between">
                  <div className="text-center flex-1">
                    <p className="text-gray-500 text-xs mb-1">When you started</p>
                    <p className="text-gray-300 font-bold">{enrollment.initialNearSnellen || '—'}</p>
                  </div>
                  <div className="text-primary-400 px-2">→</div>
                  <div className="text-center flex-1">
                    <p className="text-gray-500 text-xs mb-1">Today</p>
                    <p className="text-white font-bold text-lg">{nearSnellen}</p>
                  </div>
                </div>
                {nearDelta && (
                  <p className={`text-center text-xs font-semibold mt-2 ${nearDelta.tone === 'up' ? 'text-secondary-400' : 'text-primary-300'}`}>
                    {nearDelta.headline}
                  </p>
                )}
              </div>

              {/* Far vision before/after */}
              <div className="bg-gray-900/50 rounded-lg p-4 border border-primary-400/20">
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2">Far Vision</p>
                <div className="flex items-center justify-between">
                  <div className="text-center flex-1">
                    <p className="text-gray-500 text-xs mb-1">When you started</p>
                    <p className="text-gray-300 font-bold">{enrollment.initialFarSnellen || '—'}</p>
                  </div>
                  <div className="text-primary-400 px-2">→</div>
                  <div className="text-center flex-1">
                    <p className="text-gray-500 text-xs mb-1">Today</p>
                    <p className="text-white font-bold text-lg">{farSnellen}</p>
                  </div>
                </div>
                {farDelta && (
                  <p className={`text-center text-xs font-semibold mt-2 ${farDelta.tone === 'up' ? 'text-secondary-400' : 'text-primary-300'}`}>
                    {farDelta.headline}
                  </p>
                )}
              </div>

              {/* NPC delta, if measured */}
              {npcCm !== null && (
                <div className="bg-gray-900/50 rounded-lg p-4 border border-primary-400/20">
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2">Near Point (Convergence)</p>
                  <p className="text-white font-bold text-lg text-center">{npcCm} cm</p>
                  <p className="text-center text-xs font-semibold mt-2 text-primary-300">
                    {npcDeltaCm === null
                      ? 'Logged — this becomes your reference point.'
                      : npcDeltaCm > 0
                        ? `${npcDeltaCm}cm closer than last check-in`
                        : npcDeltaCm === 0
                          ? 'Holding steady — consistency is the win.'
                          : 'Some day-to-day variation is normal — stay consistent.'}
                  </p>
                </div>
              )}

              {/* Personal bests this phase (informational, no invented deltas) */}
              {otherBestMetrics.length > 0 && (
                <div className="bg-gray-900/50 rounded-lg p-4 border border-primary-400/20">
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-secondary-400" />
                    Personal bests this phase
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
            </div>

            <button
              onClick={handleFinish}
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
