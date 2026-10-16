'use client'

import React, { type ReactElement } from 'react'
import type { PitchforksMasteryProjection } from './pitchforksMasteryProjection'
import type { PitchforksPresentationJourney } from './pitchforksCurriculum'
import {
  buildPitchforksMasteryCard,
  pitchforksMasteryCardStatusLabel,
  serializePitchforksMasteryCardCsv,
  serializePitchforksMasteryCardJson,
  type PitchforksMasteryCard,
} from './pitchforksMasteryCardModel'

export interface PitchforksShareCardProps {
  projection: PitchforksMasteryProjection
  journey: PitchforksPresentationJourney
  nowMs: number
  abilityEvidence?: Parameters<typeof buildPitchforksMasteryCard>[0]['abilityEvidence']
}

function download(name: string, body: string, type: string): void {
  const url = URL.createObjectURL(new Blob([body], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function Status({ value }: Readonly<{ value: Parameters<typeof pitchforksMasteryCardStatusLabel>[0] }>): ReactElement {
  return <span className="inline-flex border border-current px-2 py-1 text-[11px] font-black" data-status={value}>
    {pitchforksMasteryCardStatusLabel(value)}
  </span>
}

function CardContents({ card }: Readonly<{ card: PitchforksMasteryCard }>): ReactElement {
  return <>
    <header className="mb-4 border-b border-cyan-800/70 pb-3">
      <p className="text-[11px] font-black tracking-[0.2em] text-cyan-300">PITCHFORKS III · PRIVATE SHARE</p>
      <h2 className="mt-1 text-xl font-black tracking-widest text-cyan-50">{card.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-gray-200">{card.audienceNote}</p>
    </header>

    <section aria-labelledby="pf3-share-notes-heading">
      <h3 id="pf3-share-notes-heading" className="text-sm font-black tracking-widest text-cyan-100">NOTE PRACTICE</h3>
      <p className="mt-1 text-xs leading-relaxed text-gray-300">Singing and listening are shown as separate paths. A due label is an invitation to revisit, not a negative mark.</p>
      {card.rows.length === 0 ? <p data-testid="pf3-share-card-empty" role="status" className="mt-3 border border-amber-500/70 bg-amber-950/20 p-3 text-sm text-amber-100">No note evidence is ready yet. Start with a comfortable note when you choose.</p> : <div className="mt-3 grid gap-3">
        {card.rows.map(row => <article key={row.evidenceId} data-testid={`pf3-share-card-row-${row.note}`} className="border border-gray-700/80 bg-black/20 p-3">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-base font-black tracking-widest text-white">{row.note}</h4>
            {row.retainedMastery && <span className="border border-green-400/70 px-2 py-1 text-[11px] font-black text-green-100">Retained mastery</span>}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div data-testid={`pf3-share-card-voice-${row.note}`} className="border border-cyan-800/70 p-2 text-sm text-cyan-50">
              <div className="flex items-center justify-between gap-2"><strong>VOICE · singing</strong><Status value={row.voice} /></div>
              <p className="mt-2 text-xs leading-relaxed text-gray-300">{row.voice === 'guided-only' ? 'Guided practice is recorded separately; it does not become unaided mastery.' : row.voice === 'retained' ? 'Retained singing evidence is present.' : 'A comfortable return is the next step when you want one.'}</p>
            </div>
            <div data-testid={`pf3-share-card-ear-${row.note}`} className="border border-violet-800/70 p-2 text-sm text-violet-50">
              <div className="flex items-center justify-between gap-2"><strong>EAR · listening</strong><Status value={row.ear} /></div>
              <p className="mt-2 text-xs leading-relaxed text-gray-300">Listening evidence is tracked independently from singing.</p>
            </div>
          </div>
          <p className="mt-2 break-words text-[11px] text-gray-400">Evidence IDs: {row.evidenceIds.join(', ')}</p>
        </article>)}
      </div>}
    </section>

    <section className="mt-5" aria-labelledby="pf3-share-progress-heading">
      <h3 id="pf3-share-progress-heading" className="text-sm font-black tracking-widest text-cyan-100">ADVENTURE PROGRESS</h3>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {card.worlds.map(world => <div key={world.id} data-testid={`pf3-share-world-${world.id}`} className="border border-gray-700/80 p-2 text-sm">
          <div className="flex items-center justify-between gap-2"><span className="font-bold">{world.label}</span><span className="border border-current px-2 py-1 text-[11px] font-black">{world.status === 'completed' ? 'Completed' : 'Not started'}</span></div>
          <p className="mt-1 break-words text-[11px] text-gray-400">Evidence IDs: {world.evidenceIds.length ? world.evidenceIds.join(', ') : 'none yet'}</p>
        </div>)}
      </div>
      {card.abilities.length > 0 && <div className="mt-3" aria-label="Earned abilities"><h4 className="text-xs font-black tracking-widest text-cyan-100">ABILITIES</h4><ul className="mt-2 grid gap-2 sm:grid-cols-2">{card.abilities.map(ability => <li key={ability.id} data-testid={`pf3-share-ability-${ability.id}`} className="border border-gray-700/80 p-2 text-sm"><div className="flex justify-between gap-2"><span>{ability.label}</span><span>{ability.status === 'earned' ? 'Earned' : 'Not recorded'}</span></div><p className="mt-1 break-words text-[11px] text-gray-400">Evidence IDs: {ability.evidenceIds.length ? ability.evidenceIds.join(', ') : 'none'}</p></li>)}</ul></div>}
    </section>

    <section className="mt-5" aria-labelledby="pf3-share-next-heading">
      <h3 id="pf3-share-next-heading" className="text-sm font-black tracking-widest text-cyan-100">SUPPORTIVE NEXT STEPS</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-200">{card.nextActions.map(action => <li key={action}>{action}</li>)}</ul>
    </section>

    <footer className="mt-5 border-t border-cyan-900/70 pt-3 text-xs leading-relaxed text-gray-400">
      <h3 className="font-black tracking-widest text-cyan-100">PRIVATE BY DESIGN</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5">{card.privacy.map(item => <li key={item}>{item}</li>)}</ul>
    </footer>
  </>
}

export function PitchforksShareCard(props: PitchforksShareCardProps): ReactElement {
  const card = buildPitchforksMasteryCard(props)
  return <section data-testid="pf3-share-safe-mastery-card" aria-labelledby="pf3-share-card-title" className="w-full max-w-3xl border-2 border-cyan-600/70 bg-[#08111a] p-4 text-left text-white print:max-w-none print:border-black print:bg-white print:text-black">
    <div className="mb-4 flex flex-wrap gap-2 print:hidden" aria-label="Mastery card actions">
      <button type="button" data-testid="pf3-share-card-print" onClick={() => window.print()} className="min-h-12 border border-cyan-300 px-3 py-2 text-sm font-black text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-100">PRINT</button>
      <button type="button" data-testid="pf3-share-card-csv" onClick={() => download('pitchforks-weekly-learning-card.csv', serializePitchforksMasteryCardCsv(card), 'text/csv;charset=utf-8')} className="min-h-12 border border-cyan-300 px-3 py-2 text-sm font-black text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-100">DOWNLOAD CSV</button>
      <button type="button" data-testid="pf3-share-card-json" onClick={() => download('pitchforks-weekly-learning-card.json', serializePitchforksMasteryCardJson(card), 'application/json;charset=utf-8')} className="min-h-12 border border-cyan-300 px-3 py-2 text-sm font-black text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-100">DOWNLOAD CARD</button>
    </div>
    <div id="pf3-share-card-title"><CardContents card={card} /></div>
    <style>{`@media print { body { background: white !important; } [data-testid="pf3-share-safe-mastery-card"] { break-inside: avoid; } } @media (prefers-reduced-motion: reduce) { [data-testid="pf3-share-safe-mastery-card"] * { scroll-behavior: auto !important; transition: none !important; animation: none !important; } }`}</style>
  </section>
}

export default PitchforksShareCard
