'use client'

import React, { type ReactElement } from 'react'

import type {
  PitchforksBellPowerNotePair,
  PitchforksBellPowerPhase,
} from './pitchforksBellPower'
import type { PitchforksBellWavePhase } from './pitchforksBellWave'

export interface PitchforksBellTowerLessonProps {
  /** Parent-owned disclosure state. The parent pauses the run before opening. */
  readonly open: boolean
  /** Parent-owned open/close action; this leaf never mutates gameplay state. */
  readonly onOpenChange: (open: boolean) => void
  /** Bell is only charged and activated from the voice lane. */
  readonly voiceMode?: boolean
  /** Live normal-Bell state, when the parent has a route snapshot available. */
  readonly charge?: number
  readonly requiredResponses?: number
  readonly taughtPair?: PitchforksBellPowerNotePair | null
  readonly powerPhase?: PitchforksBellPowerPhase | null
  /** Live wave projection, used only for truthful status copy. */
  readonly wavePhase?: PitchforksBellWavePhase
  readonly contactCount?: number
}

const DEFAULT_REQUIRED_RESPONSES = 3
const HEADING_ID = 'pitchforks-bell-tower-lesson-heading'
const PANEL_ID = 'pitchforks-bell-tower-lesson-panel'

function pairLabel(taughtPair: PitchforksBellPowerNotePair | null | undefined): string {
  return taughtPair?.length === 2
    ? taughtPair.join(' → ')
    : 'the current pair shown in the Bell dock'
}

function contactLabel(contactCount: number): string {
  return `${contactCount} contact${contactCount === 1 ? '' : 's'}`
}

function statusCopy({
  voiceMode,
  charge,
  requiredResponses,
  taughtPair,
  powerPhase,
  wavePhase,
  contactCount,
}: Pick<
  PitchforksBellTowerLessonProps,
  'voiceMode' | 'charge' | 'requiredResponses' | 'taughtPair' | 'powerPhase' | 'wavePhase' | 'contactCount'
>): string {
  if (voiceMode === false) return 'VOICE ONLY · switch to voice mode to charge, activate, or ring.'

  const pair = pairLabel(taughtPair)
  const contacts = contactLabel(contactCount ?? 0)
  if (wavePhase === 'active') return `WAVE ACTIVE · ${contacts}`
  if (wavePhase === 'finished') return `WAVE FINISHED · ${contacts}`
  if (powerPhase === 'pending') return `PAIR READY · ${pair} · RING BELLS`
  if (powerPhase === 'activating') return `ACTIVATING · SING THE PAIR IN ORDER`
  if (powerPhase === 'ready') return `READY · ${pair} · TEACH PAIR`
  if (typeof charge === 'number') return `CHARGE ${charge}/${requiredResponses ?? DEFAULT_REQUIRED_RESPONSES} · ${pair}`
  return `CHARGE THE BELL · ${requiredResponses ?? DEFAULT_REQUIRED_RESPONSES} EXACT VOICE RESPONSES`
}

/**
 * Compact, controlled teaching surface for the normal Bell ability.
 *
 * The parent owns the pause gate and all gameplay authority. This component
 * only explains the live contract and presents the parent's state snapshot.
 */
export function PitchforksBellTowerLesson({
  open,
  onOpenChange,
  voiceMode = true,
  charge,
  requiredResponses = DEFAULT_REQUIRED_RESPONSES,
  taughtPair = null,
  powerPhase = null,
  wavePhase = 'idle',
  contactCount = 0,
}: PitchforksBellTowerLessonProps): ReactElement {
  const pair = pairLabel(taughtPair)
  const status = statusCopy({
    voiceMode,
    charge,
    requiredResponses,
    taughtPair,
    powerPhase,
    wavePhase,
    contactCount,
  })

  return (
    <section
      data-testid="pitchforks-bell-tower-lesson"
      aria-labelledby={HEADING_ID}
      className="w-full max-w-[760px] border border-amber-800/80 bg-amber-950/20 text-amber-50"
    >
      <div className="flex min-w-0 items-center justify-between gap-3 px-3 py-2">
        <div className="min-w-0">
          <h2 id={HEADING_ID} className="truncate text-xs font-black tracking-widest text-amber-100">
            BELL TOWER · HOW TO PLAY
          </h2>
          {!open && <p className="mt-0.5 text-[11px] text-amber-200/80">3 voice responses → 2-note pair → expanding wave</p>}
        </div>
        <button
          type="button"
          data-testid="pitchforks-bell-tower-lesson-toggle"
          aria-expanded={open}
          aria-controls={PANEL_ID}
          onClick={() => onOpenChange(!open)}
          className="min-h-10 shrink-0 border border-amber-200/80 px-3 py-2 text-xs font-black tracking-wide text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100"
        >
          {open ? 'Close lesson' : 'How it works'}
        </button>
      </div>

      {open && (
        <div
          id={PANEL_ID}
          role="region"
          aria-labelledby={HEADING_ID}
          className="border-t border-amber-800/80 px-3 pb-3 pt-2"
        >
          <p className="mb-2 text-xs leading-relaxed text-amber-100">
            {voiceMode
              ? 'Voice only, on an unlocked normal Village Gate, Bell Tower, or Cathedral run after Dungeon clear: the Bell stores accepted exact voice-combat responses, then teaches a two-note ring.'
              : 'Bell is voice only. Switch to voice mode; button responses cannot charge, activate, or ring it.'}
          </p>

          <p
            data-testid="pitchforks-bell-tower-lesson-status"
            data-power-phase={powerPhase ?? 'unknown'}
            data-wave-phase={wavePhase}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="mb-3 border border-amber-800/70 bg-black/10 px-2.5 py-2 text-[11px] font-black tracking-wide text-amber-100"
          >
            {status}
          </p>

          <ol className="grid gap-2 sm:grid-cols-2" aria-label="Bell Tower steps">
            <li className="min-w-0 border border-amber-800/80 bg-black/10 p-2.5">
              <div className="flex items-start gap-2">
                <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-black text-[#1a1102]">1</span>
                <div className="min-w-0">
                  <h3 className="text-xs font-black text-white">Charge with real combat</h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-gray-200">
                    Earn {requiredResponses} accepted exact voice-combat responses in the normal run. The active target must be an admitted note at the exact octave; buttons, replay, demo, simulated, stale, and duplicate events do not charge Bell.
                  </p>
                </div>
              </div>
            </li>

            <li className="min-w-0 border border-amber-800/80 bg-black/10 p-2.5">
              <div className="flex items-start gap-2">
                <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-black text-[#1a1102]">2</span>
                <div className="min-w-0">
                  <h3 className="text-xs font-black text-white">Wait for READY</h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-gray-200">
                    When the Bell dock says READY, press TEACH PAIR. The pair comes from your admitted notes and stays visible in order: <strong className="text-amber-100">{pair}</strong>.
                  </p>
                </div>
              </div>
            </li>

            <li className="min-w-0 border border-amber-800/80 bg-black/10 p-2.5">
              <div className="flex items-start gap-2">
                <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-black text-[#1a1102]">3</span>
                <div className="min-w-0">
                  <h3 className="text-xs font-black text-white">Sing the pair in order</h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-gray-200">
                    Sing and hold the first note, then the second, exactly as shown. The live microphone needs healthy, fresh samples; a wrong note or octave clears only this attempt, not the earned charge.
                  </p>
                </div>
              </div>
            </li>

            <li className="min-w-0 border border-amber-800/80 bg-black/10 p-2.5">
              <div className="flex items-start gap-2">
                <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-black text-[#1a1102]">4</span>
                <div className="min-w-0">
                  <h3 className="text-xs font-black text-white">Ring the wave</h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-gray-200">
                    When the dock says PAIR READY, press RING BELLS. One accepted release spends the pending Bell receipt and sends one expanding wave from the bells.
                  </p>
                </div>
              </div>
            </li>
          </ol>

          <div className="mt-3 border-t border-amber-800/80 pt-2 text-[11px] leading-relaxed text-amber-100/90">
            <p>
              <strong className="text-white">Wave result:</strong> the front travels outward and contacts each live walking villager from the release snapshot as it reaches them, applying bounded knockback. It is causal crowd control, not an instant board clear.
            </p>
            <p className="mt-1">
              <strong className="text-white">Limits:</strong> Bell never grants tine credit, burns forks, adds mastery, unlocks notes, or creates an extra musical hit. Villagers absent, dead, stopped, or spawned after release do not join that wave; a failed release keeps the receipt available for retry.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}

export default PitchforksBellTowerLesson
