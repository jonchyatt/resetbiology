'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { PeptideIndexEntry } from '@/data/peptide-education/generated';

const ORDERED_CATS = ['Fat Loss', 'Hormones', 'Growth Hormone', 'Healing', 'Longevity', 'Mitochondrial & Energy', 'Bioregulators', 'Immunity', 'Cognitive Enhancement', 'Sleep', 'Other'];

type Expert = 'hunter' | 'taylor' | 'bachmeyer';

export default function PeptideLibraryBrowser({ peptides }: { peptides: PeptideIndexEntry[] }) {
  const [query, setQuery] = useState('');
  const [cats, setCats] = useState<Set<string>>(new Set());
  const [experts, setExperts] = useState<Set<Expert>>(new Set());

  const catOf = (p: PeptideIndexEntry) => (p.category && p.category !== 'Uncategorized' ? p.category : 'Other');

  const byCategory: Record<string, PeptideIndexEntry[]> = {};
  for (const p of peptides) {
    const cat = catOf(p);
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(p);
  }
  const orderedCats = ORDERED_CATS.filter(c => byCategory[c]);

  const q = query.trim().toLowerCase();
  const filterActive = q.length > 0 || cats.size > 0 || experts.size > 0;

  const matches = (p: PeptideIndexEntry) => {
    if (cats.size > 0 && !cats.has(catOf(p))) return false;
    if (experts.has('taylor') && !p.has_taylor) return false;
    if (experts.has('bachmeyer') && !p.has_bachmeyer) return false;
    if (q.length > 0) {
      const hay = [p.peptide, ...p.aliases].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  };

  const filtered = useMemo(
    () => peptides.filter(matches).sort((a, b) => b.total_mentions - a.total_mentions),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [peptides, q, cats, experts]
  );

  const toggleCat = (cat: string) => {
    setCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const toggleExpert = (expert: Expert) => {
    setExperts(prev => {
      const next = new Set(prev);
      if (next.has(expert)) next.delete(expert);
      else next.add(expert);
      return next;
    });
  };

  return (
    <div>
      {/* Search + filters */}
      <div className="container mx-auto px-4 py-6">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-6 space-y-4">
          <div>
            <label htmlFor="peptide-search" className="block text-sm text-white/70 mb-2">
              Search peptides by name or alias
            </label>
            <input
              id="peptide-search"
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="e.g. BPC-157, TB-500, semaglutide..."
              className="w-full rounded-xl bg-black/30 border border-white/20 px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-[#3FBFB5]"
            />
          </div>

          <div>
            <div className="text-sm text-white/70 mb-2">Category</div>
            <div className="flex flex-wrap gap-2">
              {orderedCats.map(cat => (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={cats.has(cat)}
                  onClick={() => toggleCat(cat)}
                  className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                    cats.has(cat)
                      ? 'bg-[#3FBFB5] text-black border-[#3FBFB5] font-semibold'
                      : 'bg-white/5 text-white/70 border-white/20 hover:border-[#3FBFB5]/50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm text-white/70 mb-2">Expert coverage</div>
            <div className="flex flex-wrap gap-2">
              {(['hunter', 'taylor', 'bachmeyer'] as Expert[]).map(expert => (
                <button
                  key={expert}
                  type="button"
                  aria-pressed={experts.has(expert)}
                  onClick={() => toggleExpert(expert)}
                  className={`text-sm px-3 py-1.5 rounded-full border transition-colors capitalize ${
                    experts.has(expert)
                      ? 'bg-[#72C247] text-black border-[#72C247] font-semibold'
                      : 'bg-white/5 text-white/70 border-white/20 hover:border-[#72C247]/50'
                  }`}
                >
                  {expert}
                </button>
              ))}
            </div>
          </div>

          <div className="text-sm text-white/60">
            Showing {filtered.length} of {peptides.length}
          </div>
        </div>
      </div>

      {filterActive ? (
        <div className="container mx-auto px-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(p => (
              <PeptideCardLink key={p.slug} p={p} />
            ))}
          </div>
        </div>
      ) : (
        <div className="container mx-auto px-4 py-8 space-y-12">
          {orderedCats.map(cat => (
            <section key={cat}>
              <h2 className="text-3xl font-bold text-white mb-6 border-b border-[#3FBFB5]/30 pb-2">
                {cat}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {byCategory[cat]
                  .sort((a, b) => b.total_mentions - a.total_mentions)
                  .map(p => (
                    <PeptideCardLink key={p.slug} p={p} />
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function PeptideCardLink({ p }: { p: PeptideIndexEntry }) {
  return (
    <Link
      href={`/education/peptides/${p.slug}`}
      className="group bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl hover:shadow-[#3FBFB5]/50 hover:shadow-2xl transition-all duration-300 overflow-hidden border border-white/20 hover:border-[#3FBFB5]/50 hover:scale-105"
    >
      <div className="p-6 bg-gradient-to-b from-white/5 to-white/10">
        <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-[#3FBFB5] transition-colors">
          {p.peptide}
        </h3>
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
          <span className="text-sm text-white/70">
            {p.total_mentions.toLocaleString()} mentions
          </span>
          {p.has_hunter_baseline && (
            <span className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded">
              ✓ Cheat Sheet
            </span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <ExpertChip label="Hunter" present={true} />
          <ExpertChip label="Taylor" present={p.has_taylor} />
          <ExpertChip label="Bachmeyer" present={p.has_bachmeyer} />
        </div>
      </div>
    </Link>
  );
}

function ExpertChip({ label, present }: { label: string; present: boolean }) {
  return (
    <span
      className={`text-xs px-2 py-1 rounded ${
        present ? 'bg-[#3FBFB5]/20 text-[#3FBFB5] border border-[#3FBFB5]/40' : 'bg-white/5 text-white/30'
      }`}
    >
      {present ? '✓' : '—'} {label}
    </span>
  );
}
