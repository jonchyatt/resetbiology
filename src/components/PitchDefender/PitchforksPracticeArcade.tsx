'use client'

import { useCallback } from 'react'

export type PitchforksPracticeWorld = 'dungeon' | 'village-gate' | 'bell-tower' | 'cathedral'

export type PitchforksPracticeArcadeProps = Readonly<{
  onEnterPractice: (world: PitchforksPracticeWorld) => void
}>

type PracticeCard = Readonly<{
  world: PitchforksPracticeWorld
  title: string
  encounter: string
  objective: string
  sound: string
  accent: string
}>

export const PITCHFORKS_PRACTICE_CARDS: readonly PracticeCard[] = [
  {
    world: 'dungeon',
    title: 'Dungeon · Torchmaster',
    encounter: 'One-note flame lock',
    objective: 'Listen, sing the exact note, and hold until the torch answers.',
    sound: 'Hear → sing → charge → strike',
    accent: 'border-orange-400/70 bg-orange-950/25',
  },
  {
    world: 'village-gate',
    title: 'Village Gate · Choirmaster',
    encounter: 'Short chorus phrase',
    objective: 'Sing the existing admitted-note phrase at your own pace.',
    sound: 'Hear the chorus → sing each answer',
    accent: 'border-amber-300/70 bg-amber-950/25',
  },
  {
    world: 'bell-tower',
    title: 'Bell Tower · Bellringer',
    encounter: 'Two-note bell interval',
    objective: 'Listen to each bell and sing back the exact note.',
    sound: 'Bell cue → voice lock → bell release',
    accent: 'border-cyan-300/70 bg-cyan-950/25',
  },
  {
    world: 'cathedral',
    title: 'Cathedral · Final Storm',
    encounter: 'Out-and-back recital',
    objective: 'Sing the existing cathedral sequence out, then back.',
    sound: 'Storm phrase → voice lock → return phrase',
    accent: 'border-violet-300/70 bg-violet-950/25',
  },
]

/**
 * Entry-only practice surface. The host supplies the existing encounter entry
 * callback; this component owns no score, unlock, or storage.
 */
export default function PitchforksPracticeArcade({ onEnterPractice }: PitchforksPracticeArcadeProps) {
  const enter = useCallback((world: PitchforksPracticeWorld) => onEnterPractice(world), [onEnterPractice])

  return (
    <section data-testid="pitchforks-practice-arcade" className="mx-auto w-full max-w-5xl rounded-2xl border border-cyan-300/30 bg-[#070914]/95 p-4 text-gray-100 shadow-2xl sm:p-6" style={{ fontFamily: 'monospace' }}>
      <div className="mb-5 border-b border-cyan-300/20 pb-4">
        <p className="text-[11px] font-black uppercase tracking-[0.25em] text-cyan-200">Pitchforks Practice Arcade</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-white">Enter any existing chamber</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-300">
          Four untimed music challenges. Choose one and sing through the encounter.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {PITCHFORKS_PRACTICE_CARDS.map(card => (
          <article key={card.world} className={`flex min-h-56 flex-col rounded-xl border p-4 ${card.accent}`}>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100">Practice chamber</p>
            <h2 className="mt-2 text-lg font-black text-white">{card.title}</h2>
            <p className="mt-1 text-sm font-bold text-amber-100">{card.encounter}</p>
            <p className="mt-3 flex-1 text-sm leading-6 text-gray-200">{card.objective}</p>
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-cyan-200">{card.sound}</p>
            <button type="button" data-testid={`pitchforks-practice-enter-${card.world}`} onClick={() => enter(card.world)} className="min-h-12 rounded border border-white/50 bg-black/30 px-4 py-3 text-left text-sm font-black text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200">
              PLAY THIS ENCOUNTER
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}
