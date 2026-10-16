'use client'

import { useRef } from 'react'
import type { PitchforksPresentationJourney } from './pitchforksCurriculum'
import type { PitchforksMasteryProjection } from './pitchforksMasteryProjection'
import PitchforksShareCard from './PitchforksShareCard'

/** Read-only account of earned passage and the work that remains. */
export default function PitchforksCampaignJournal({ journey, projection }: {
  journey: PitchforksPresentationJourney
  projection: PitchforksMasteryProjection
}) {
  const snapshotNowMs = useRef(Date.now()).current
  const bindings = journey.villageCurriculum?.bindings ?? []
  const practiced = (binding: typeof bindings[number]) => journey.villagePractice?.some(receipt =>
    receipt.journeyId === journey.startedAt && receipt.support === 'UNAIDED_RETURN'
    && receipt.objective === binding.objective && receipt.contextNote === binding.contextNote
    && receipt.targetNote === binding.targetNote) ?? false
  const next = journey.cathedralClear ? 'Your adventure is complete. Keep your music alive with review and Songcraft.'
    : journey.bellTowerClear ? 'The Cathedral is open. Learn the final recital, then sing it without hints.'
      : journey.villageClear ? 'The Bell Tower is open. Learn the Bellringer’s recital, then sing it without hints.'
        : journey.dungeonClear ? 'Explore the Village. Learn its intervals, then return to sing them with only the starting note.'
          : 'Build your singing history in the Dungeon. Level victories and lasting note mastery are separate achievements.'

  return <section className="mb-5 border border-cyan-800 bg-cyan-950/20 p-4 text-left" aria-labelledby="pf3-journal-heading">
    <h2 id="pf3-journal-heading" className="text-sm font-black text-cyan-100">YOUR ADVENTURE</h2>
    <p className="mt-2 text-sm leading-relaxed text-gray-200">{next}</p>
    {bindings.length > 0 && !journey.villageClear && <ul className="my-3 space-y-2 text-sm text-cyan-100">
      {bindings.map(binding => <li key={binding.objective}>{binding.contextNote} → {binding.targetNote}: {practiced(binding) ? 'Unaided return recorded' : 'Return practice ahead'}</li>)}
    </ul>}
    <details className="mt-3" open>
      <summary className="min-h-12 cursor-pointer py-3 text-sm font-bold text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-100">THIS WEEK · Private learning card</summary>
      <p className="mb-3 text-sm leading-relaxed text-gray-200">Choose whether to print or download this card. Nothing is posted or sent.</p>
      <PitchforksShareCard projection={projection} journey={journey} nowMs={snapshotNowMs} />
    </details>
  </section>
}
