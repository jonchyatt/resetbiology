import React from 'react'
import { TIER_LABEL, visiblePatrons, type Patron, type PatronTier } from '@/config/patrons'

const TIERS: PatronTier[] = ['founding', 'supporter']

export function PatronWall({ patrons, sample = false }: { patrons: Patron[]; sample?: boolean }) {
  const shown = visiblePatrons(patrons)
  return (
    <div className="mt-8">
      {sample && (
        <p className="mb-6 rounded-lg border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-base text-amber-200">
          Sample names for a local preview. Not real people.
        </p>
      )}
      {shown.length === 0 ? (
        <p className="text-lg leading-8 text-slate-300">Our first patrons will be named here.</p>
      ) : (
        TIERS.map((tier) => {
          const names = shown.filter((p) => p.tier === tier)
          if (names.length === 0) return null
          return (
            <section key={tier} aria-labelledby={`tier-${tier}`} className="mb-8">
              <h2 id={`tier-${tier}`} className="text-2xl font-semibold text-white">{TIER_LABEL[tier]}</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {names.map((p) => (
                  <li key={p.displayName} className="rounded-xl border border-primary-400/20 bg-gray-800/40 px-4 py-3 text-lg text-slate-100 backdrop-blur-sm">
                    {p.displayName}
                  </li>
                ))}
              </ul>
            </section>
          )
        })
      )}
    </div>
  )
}
