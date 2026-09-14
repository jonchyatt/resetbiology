'use client'

import React from 'react'
import { noteToFreq } from './pitchMath'

export type PitchforksVillageLessonObjective = 'minor-third' | 'major-third' | 'perfect-fifth'
export type PitchforksVillageLessonSupport = 'SUPPORTED' | 'UNAIDED_RETURN'

export type PitchforksVillageLessonProps = Readonly<{
  objective: PitchforksVillageLessonObjective
  contextNote: string
  targetNote: string
  support: PitchforksVillageLessonSupport
  onReplay: () => void
}>

const OBJECTIVE_LABELS: Readonly<Record<PitchforksVillageLessonObjective, string>> = {
  'minor-third': 'MINOR THIRD',
  'major-third': 'MAJOR THIRD',
  'perfect-fifth': 'PERFECT FIFTH',
}

type IntervalDirection = 'above' | 'below'

function intervalDirection(contextNote: string, targetNote: string): IntervalDirection {
  return noteToFreq(targetNote) > noteToFreq(contextNote) ? 'above' : 'below'
}

function intervalCurve(direction: IntervalDirection): string {
  return direction === 'above'
    ? 'M 18 52 C 52 52, 92 47, 152 18'
    : 'M 18 18 C 52 18, 92 23, 152 52'
}

function intervalArrow(direction: IntervalDirection): string {
  return direction === 'above'
    ? 'M 142 18 L 152 18 L 148 28'
    : 'M 142 52 L 152 52 L 148 42'
}

/**
 * Present one source-bound Village interval lesson without owning lesson state.
 * The parent decides when a return is still protected and owns replay/audio.
 */
export function PitchforksVillageLesson(props: PitchforksVillageLessonProps) {
  const blindProtected = props.support === 'UNAIDED_RETURN'
  const direction = intervalDirection(props.contextNote, props.targetNote)
  const objectiveLabel = OBJECTIVE_LABELS[props.objective]
  const directionLabel = direction.toUpperCase()
  const shapeLabel = blindProtected
    ? `Directional interval shape: from ${props.contextNote} ${direction} by a ${objectiveLabel.toLowerCase()}`
    : `Directional interval shape: from ${props.contextNote} ${direction} to ${props.targetNote}, a ${objectiveLabel.toLowerCase()}`

  return (
    <section
      data-testid="pf3-village-lesson"
      data-support={props.support}
      aria-labelledby="pf3-village-lesson-heading"
      className="w-full max-w-[760px] border border-amber-700/70 bg-amber-950/20 px-3 py-2 text-amber-50"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="pf3-village-lesson-heading" className="text-[11px] font-black tracking-[0.2em] text-amber-100">
          VILLAGE INTERVAL LESSON
        </h2>
        <span data-testid="pf3-village-lesson-support" className="text-[10px] font-black tracking-widest text-cyan-200">
          {blindProtected ? 'UNAIDED RETURN' : 'SUPPORTED PRACTICE'}
        </span>
      </div>

      <div
        data-testid="pf3-village-lesson-shape"
        data-direction={direction}
        role="img"
        aria-label={shapeLabel}
        className="mt-2 flex min-w-0 items-center justify-center gap-2"
      >
        <div data-testid="pf3-village-lesson-context" className="min-w-16 border border-cyan-300/70 bg-cyan-950/35 px-2 py-1 text-center">
          <span className="block text-[9px] font-black tracking-widest text-cyan-200">START</span>
          <strong className="block text-sm font-black text-cyan-50">{props.contextNote}</strong>
        </div>

        <svg viewBox="0 0 170 70" width="170" height="70" aria-hidden="true" focusable="false" className="h-14 min-w-24 max-w-[42vw] text-amber-200">
          <path d={intervalCurve(direction)} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <path d={intervalArrow(direction)} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="18" cy={direction === 'above' ? 52 : 18} r="5" fill="currentColor" />
          <circle cx="152" cy={direction === 'above' ? 18 : 52} r="5" fill="currentColor" />
        </svg>

        <div className="min-w-20 border border-amber-300/70 bg-amber-950/35 px-2 py-1 text-center">
          <span className="block text-[9px] font-black tracking-widest text-amber-200">TARGET</span>
          {blindProtected ? (
            <strong data-testid="pf3-village-lesson-target-hidden" className="block text-xs font-black text-amber-50">HIDDEN</strong>
          ) : (
            <strong data-testid="pf3-village-lesson-target" className="block text-sm font-black text-amber-50">{props.targetNote}</strong>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-[10px] font-black tracking-widest">
        <span data-testid="pf3-village-lesson-objective" className="border border-fuchsia-300/60 px-2 py-1 text-fuchsia-100">{objectiveLabel}</span>
        <span data-testid="pf3-village-lesson-direction" className="border border-lime-300/60 px-2 py-1 text-lime-100">{directionLabel}</span>
      </div>

      <p data-testid="pf3-village-lesson-instruction" className="mt-2 text-center text-xs leading-relaxed text-gray-200">
        {blindProtected
          ? `Start on ${props.contextNote}. Move ${direction} a ${objectiveLabel.toLowerCase()}. Sing the return from memory.`
          : `Hear ${props.contextNote}, then sing ${props.targetNote}: a ${objectiveLabel.toLowerCase()} ${direction}.`}
      </p>

      <button
        type="button"
        data-testid="pf3-village-lesson-replay"
        onClick={props.onReplay}
        className="mt-2 min-h-11 w-full border border-yellow-300/80 bg-yellow-950/35 px-3 py-2 text-xs font-black tracking-widest text-yellow-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-100"
      >
        {blindProtected ? 'REPLAY WITH HELP' : 'REPLAY LESSON'}
      </button>
    </section>
  )
}
