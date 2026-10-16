import type { ReactElement } from 'react'
import type { PitchforksCathedralFinaleState } from './pitchforksCathedralSongcraftFinale'

export interface PitchforksCathedralSongcraftFinaleProps {
  readonly state: PitchforksCathedralFinaleState
  readonly onContinuePractice: () => void
  readonly onSaveQuit: () => void
}

export default function PitchforksCathedralSongcraftFinale({
  state,
  onContinuePractice,
  onSaveQuit,
}: PitchforksCathedralSongcraftFinaleProps): ReactElement {
  const saved = state.phase === 'saved'
  const reopened = state.phase === 'return-practice'
  const next = reopened
    ? 'Your Cathedral passage is still here. Continue practice whenever you are ready.'
    : saved
      ? 'Saved in the existing adventure record. Reopen Songcraft from the Cathedral route to continue.'
      : state.earEvidence
        ? 'The Cathedral heard your recognition. That is separate from voice mastery, and no voice evidence was created.'
        : 'The Cathedral heard your unaided voice phrase. Your exact-octave evidence remains separate from ear practice.'

  return (
    <section
      data-testid="pitchforks-cathedral-songcraft-finale"
      className="mx-auto mt-4 max-w-2xl border border-green-400/70 bg-green-950/25 p-4 text-left"
      aria-labelledby="pitchforks-cathedral-finale-heading"
    >
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-green-200">Cathedral finale</p>
      <h2 id="pitchforks-cathedral-finale-heading" className="mt-2 text-2xl font-black tracking-widest text-green-100">
        THE CASTLE SINGS AGAIN
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-gray-100">
        {state.phraseTitle} · Composer source · untimed {state.lane === 'ear' ? 'EAR' : 'VOICE'} phrase complete.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-green-100">{next}</p>
      <p className="mt-2 break-all text-[10px] text-gray-400">Source {state.sourceKey} · SHA-256 {state.sourceSha256}</p>
      {!saved && !reopened && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button type="button" className="min-h-12 border border-green-300 px-3 py-2 font-bold text-green-100" onClick={onContinuePractice}>
            CONTINUE PRACTICE
          </button>
          <button
            type="button"
            className="min-h-12 border border-amber-300 px-3 py-2 font-bold text-amber-100"
            onClick={onSaveQuit}
          >
            SAVE &amp; QUIT
          </button>
        </div>
      )}
      {saved && (
        <button type="button" className="mt-4 min-h-12 w-full border border-green-300 px-3 py-2 font-bold text-green-100" onClick={onContinuePractice}>
          REOPEN AND CONTINUE PRACTICE
        </button>
      )}
      {reopened && (
        <button type="button" className="mt-4 min-h-12 w-full border border-green-300 px-3 py-2 font-bold text-green-100" onClick={onContinuePractice}>
          CONTINUE PRACTICE
        </button>
      )}
    </section>
  )
}
