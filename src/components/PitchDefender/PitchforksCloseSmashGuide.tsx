'use client'

import type { ReactElement } from 'react'

export interface PitchforksCloseSmashGuideProps {
  /** Parent-owned disclosure state. Keep this false until the first-use cue is appropriate. */
  readonly open: boolean
  /** Called when the player opens or closes the guide so the parent can pause gameplay. */
  readonly onOpenChange: (open: boolean) => void
  /** The power is available only on the voice lane; button mode gets an explicit explanation. */
  readonly voiceMode?: boolean
}

const steps = [
  {
    number: '1',
    title: 'Hold the exact note',
    body: 'Sing and hold the exact note while a villager is near Frank. That earns the close-range lock.',
  },
  {
    number: '2',
    title: 'Wait for READY',
    body: 'When the dock says READY, press SMASH. The action must still be aimed at that same villager and tine.',
  },
  {
    number: '3',
    title: 'Frank commits the hit',
    body: 'Frank turns into a two-handed physical/electrical attack. It resolves one close-target tine and spends the lock.',
  },
] as const

/**
 * Compact, controlled teaching surface for the existing Close Smash power.
 * It explains the live contract only; it does not inspect or mutate gameplay state.
 */
export function PitchforksCloseSmashGuide({
  open,
  onOpenChange,
  voiceMode = true,
}: PitchforksCloseSmashGuideProps): ReactElement {
  const headingId = 'pitchforks-close-smash-guide-heading'
  const panelId = 'pitchforks-close-smash-guide-panel'

  return (
    <section
      data-testid="pitchforks-close-smash-guide"
      aria-labelledby={headingId}
      className="w-full max-w-[760px] border border-fuchsia-900/70 bg-fuchsia-950/15 text-fuchsia-50"
    >
      <div className="flex min-w-0 items-center justify-between gap-3 px-3 py-2">
        <div className="min-w-0">
          <h2 id={headingId} className="truncate text-xs font-black tracking-widest text-fuchsia-100">
            CLOSE SMASH
          </h2>
          {!open && <p className="mt-0.5 text-[11px] text-fuchsia-200/80">Three steps · voice only</p>}
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => onOpenChange(!open)}
          className="min-h-10 shrink-0 border border-fuchsia-200/80 px-3 py-2 text-xs font-black tracking-wide text-fuchsia-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-100"
        >
          {open ? 'Close guide' : 'How it works'}
        </button>
      </div>

      {open && (
        <div id={panelId} className="border-t border-fuchsia-900/70 px-3 pb-3 pt-2">
          <p className="mb-3 text-xs leading-relaxed text-fuchsia-100">
            {voiceMode
              ? 'Voice only: Close Smash is earned from an exact sung lock at close range.'
              : 'Close Smash is voice only. Switch to voice mode to earn and use it.'}
          </p>

          <ol className="grid gap-2 sm:grid-cols-3" aria-label="Close Smash steps">
            {steps.map(step => (
              <li key={step.number} className="min-w-0 border border-fuchsia-900/80 bg-black/10 p-2.5">
                <div className="flex items-start gap-2">
                  <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fuchsia-200 text-xs font-black text-[#180719]">
                    {step.number}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-xs font-black text-white">{step.title}</h3>
                    <p className="mt-1 text-[11px] leading-relaxed text-gray-200">{step.body}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-3 border-t border-fuchsia-900/70 pt-2 text-[11px] leading-relaxed text-fuchsia-100/90">
            <p><strong className="text-white">If the moment lapses:</strong> the lock can resolve as ordinary lightning, with no Smash pose or penalty.</p>
            <p className="mt-1"><strong className="text-white">What it does not do:</strong> it does not bypass the exact-note lock, clear a bystander, or create an extra musical hit.</p>
          </div>
        </div>
      )}
    </section>
  )
}

export default PitchforksCloseSmashGuide
