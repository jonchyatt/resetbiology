'use client'

import type { PitchforksPresentationJourney } from './pitchforksCurriculum'
import type { PitchforksMasteryProjection } from './pitchforksMasteryProjection'

/** Read-only account of earned passage and the work that remains. */
export default function PitchforksCampaignJournal({ journey, projection }: {
  journey: PitchforksPresentationJourney
  projection: PitchforksMasteryProjection
}) {
  const bindings = journey.villageCurriculum?.bindings ?? []
  const today = Date.now()
  const weekStart = today - 7 * 24 * 60 * 60 * 1000
  const thisWeek = projection.notes.filter(note => note.voiceEverMastered
    && note.voiceMastery.masteredAt !== null && note.voiceMastery.masteredAt >= weekStart
    && note.voiceMastery.masteredAt <= today).map(note => note.note)
  const reviewNotes = projection.notes.filter(note => note.voiceDue).map(note => note.note)
  const practiced = (binding: typeof bindings[number]) => journey.villagePractice?.some(receipt =>
    receipt.journeyId === journey.startedAt && receipt.support === 'UNAIDED_RETURN'
    && receipt.objective === binding.objective && receipt.contextNote === binding.contextNote
    && receipt.targetNote === binding.targetNote) ?? false
  const next = journey.cathedralClear ? 'Your adventure is complete. Keep your music alive with review and Songcraft.'
    : journey.bellTowerClear ? 'The Cathedral is open. Learn the final recital, then sing it without hints.'
      : journey.villageClear ? 'The Bell Tower is open. Learn the Bellringer’s recital, then sing it without hints.'
        : journey.dungeonClear ? 'Explore the Village. Learn its intervals, then return to sing them with only the starting note.'
          : 'Build your singing history in the Dungeon. Level victories and lasting note mastery are separate achievements.'
  const saveRecord = () => {
    const record = {
      format: 'pitchforks-learning-record/v1', savedAt: new Date().toISOString(),
      campaignComplete: Boolean(journey.cathedralClear), level: journey.currentLevel,
      worlds: { dungeon: journey.dungeonClear?.clearedAt ?? null, village: journey.villageClear?.clearedAt ?? null,
        bellTower: journey.bellTowerClear?.clearedAt ?? null, cathedral: journey.cathedralClear?.clearedAt ?? null },
      notes: projection.notes.map(note => ({ note: note.note, singingMastered: note.voiceEverMastered,
        singingReviewDue: note.voiceDue, listeningReviewDue: note.earDue })),
      intervals: bindings.map(binding => ({ ...binding, unaidedPracticeRecorded: practiced(binding) })),
      explanation: 'Recorded game history. Interval practice is not a separate retained-mastery certification. No microphone recording is included.',
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'pitchforks-learning-record.json'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <section className="mb-5 border border-cyan-800 bg-cyan-950/20 p-4 text-left" aria-labelledby="pf3-journal-heading">
    <h2 id="pf3-journal-heading" className="text-sm font-black text-cyan-100">YOUR ADVENTURE</h2>
    <p className="mt-2 text-sm leading-relaxed text-gray-200">{next}</p>
    {bindings.length > 0 && !journey.villageClear && <ul className="my-3 space-y-2 text-sm text-cyan-100">
      {bindings.map(binding => <li key={binding.objective}>{binding.contextNote} → {binding.targetNote}: {practiced(binding) ? 'Unaided return recorded' : 'Return practice ahead'}</li>)}
    </ul>}
    <details className="mt-3 text-sm text-gray-200">
      <summary className="min-h-12 cursor-pointer py-3 font-bold text-cyan-100">THIS WEEK · Learning card</summary>
      <p className="mb-2">For you, or to share with a parent or teacher. Last seven days, on this device.</p>
      <p>New singing milestones: {thisWeek.length ? thisWeek.join(', ') : 'None recorded this week.'}</p>
      <p className="mt-2">Ready to revisit: {reviewNotes.length ? reviewNotes.join(', ') : 'No singing reviews due in this snapshot.'}</p>
      <p className="mt-2 text-xs text-gray-400">A snapshot of saved learning, not a grade or a measure of effort. Practice time and microphone recordings are not collected here.</p>
    </details>
    <button type="button" onClick={saveRecord} className="mt-3 min-h-12 w-full border border-cyan-700 px-3 py-2 text-sm font-bold text-cyan-100">SAVE LEARNING RECORD</button>
  </section>
}
