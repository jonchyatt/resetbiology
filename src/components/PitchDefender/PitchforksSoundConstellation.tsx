'use client'

import React, { type ReactElement } from 'react'
import { projectPitchforksSoundConstellation, type PitchforksConstellationNode } from './pitchforksSoundConstellation'
import type { PitchforksMasteryProjection } from './pitchforksMasteryProjection'

export type PitchforksSoundConstellationProps = Readonly<{
  projection?: PitchforksMasteryProjection | null
  onStartDuePractice?: (node: PitchforksConstellationNode) => void
}>

function statusLabel(status: PitchforksConstellationNode['status']): string {
  return status === 'due' ? 'DUE' : status === 'earned' ? 'EARNED' : status.toUpperCase()
}

export function PitchforksSoundConstellation({ projection, onStartDuePractice }: PitchforksSoundConstellationProps): ReactElement {
  const constellation = projectPitchforksSoundConstellation(projection)
  return (
    <section data-testid="pf3-sound-constellation" aria-labelledby="pf3-sound-constellation-heading" className="mb-5 border border-violet-700/70 bg-violet-950/15 p-4 text-gray-100">
      <header>
        <h2 id="pf3-sound-constellation-heading" className="text-sm font-black tracking-widest text-violet-100">SOUND CONSTELLATION</h2>
        <p className="mt-1 text-xs leading-relaxed text-gray-300">A read-only map of real listening, singing, and earned storm evidence. No second mastery or XP store.</p>
      </header>
      <div data-testid="pf3-constellation-nodes" className="mt-3 grid gap-2 sm:grid-cols-2">
        {constellation.nodes.map(node => (
          <article key={node.id} data-testid={`pf3-constellation-node-${node.id.replaceAll(':', '-')}`} data-status={node.status} data-evidence-ids={node.evidenceIds.join('|')} className="border border-gray-700/80 bg-black/25 p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-black tracking-widest"><span aria-hidden="true" className="mr-2">{node.rune}</span>{node.title}{node.note ? ` · ${node.note}` : ''}</h3>
              <span className="text-[10px] font-black tracking-widest">{statusLabel(node.status)}</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-gray-300">{node.detail}</p>
            <p className="mt-1 text-[10px] leading-relaxed text-gray-500">Evidence: {node.evidenceIds.length ? node.evidenceIds.join(', ') : 'none'}</p>
            {node.due && <button type="button" data-testid={`pf3-constellation-practice-${node.track}-${node.note}`} onClick={() => onStartDuePractice?.(node)} className="mt-2 min-h-11 w-full border border-amber-300 bg-amber-950/30 px-3 py-2 text-xs font-black tracking-widest text-amber-100">PRACTICE {node.note ?? 'DUE NOTE'}</button>}
          </article>
        ))}
      </div>
      <p data-testid="pf3-constellation-evidence-total" className="mt-3 text-[10px] font-bold tracking-widest text-gray-400">{constellation.evidenceNodeTotal} evidence-backed nodes · absent days carry no penalty</p>
    </section>
  )
}

export default PitchforksSoundConstellation
