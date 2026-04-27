import Link from 'next/link';
import Image from 'next/image';
import { peptideIndex } from '@/data/peptide-education/generated';

export const metadata = {
  title: 'Peptide Library — Hunter, Taylor, Bachmeyer | Reset Biology',
  description: 'Cross-expert peptide library indexing what Hunter Williams, Taylor Williams, and Dr Trevor Bachmeyer teach about each compound — dosing, acute vs chronic, female-specific guidance, and Reset Biology synthesis.',
};

export default function PeptideLibraryHub() {
  const peptides = peptideIndex();

  // Group by category for display
  const byCategory: Record<string, typeof peptides> = {};
  for (const p of peptides) {
    const cat = p.category && p.category !== 'Uncategorized' ? p.category : 'Other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(p);
  }
  const orderedCats = ['Healing', 'Fat Loss', 'Longevity', 'Immunity', 'Cognitive Enhancement', 'Other']
    .filter(c => byCategory[c]);

  // JSON-LD for LLM ingestion
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Reset Biology Peptide Library',
    description: 'Cross-expert peptide knowledge graph from Hunter Williams, Taylor Williams Coaching, and Dr Trevor Bachmeyer.',
    numberOfItems: peptides.length,
    hasPart: peptides.slice(0, 50).map(p => ({
      '@type': 'MedicalWebPage',
      '@id': `https://resetbiology.com/education/peptides/${p.slug}`,
      name: p.peptide,
      about: { '@type': 'Drug', name: p.peptide, alternateName: p.aliases },
    })),
  };

  return (
    <div className="min-h-screen bg-black relative">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero Background */}
      <div className="fixed inset-0 z-0">
        <Image
          src="/hero-background.jpg"
          alt="Background"
          fill
          className="object-cover opacity-40"
          priority
        />
      </div>

      {/* Content */}
      <div className="relative z-10 pt-16">
        <div className="bg-gradient-to-r from-[#3FBFB5]/90 to-[#72C247]/90 backdrop-blur-md border-b border-white/10">
          <div className="container mx-auto px-4 py-12">
            <h1 className="text-4xl md:text-6xl font-bold mb-4 text-white">
              Peptide Library
            </h1>
            <p className="text-xl text-white/95 max-w-3xl">
              Cross-expert reference indexing what Hunter Williams, Taylor Williams, and Dr Trevor Bachmeyer teach about each peptide — including dosing where given, acute vs chronic context, and female-specific guidance.
            </p>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-500/20 backdrop-blur-sm border-b border-blue-400/30">
          <div className="container mx-auto px-4 py-4">
            <p className="text-blue-100 text-center">
              <strong>Note:</strong> Educational synthesis of three independent practitioners. Dosing references are research-context only. To access protocols, enroll through Cellular Peptide IRB.
            </p>
          </div>
        </div>

        {/* Coverage stats */}
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <StatCard label="Peptides indexed" value={peptides.length} />
            <StatCard label="With Hunter baseline" value={peptides.filter(p => p.has_hunter_baseline).length} />
            <StatCard label="With Taylor coverage" value={peptides.filter(p => p.has_taylor).length} />
            <StatCard label="With Bachmeyer coverage" value={peptides.filter(p => p.has_bachmeyer).length} />
          </div>
        </div>

        {/* Per-category sections */}
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
                    <Link
                      key={p.slug}
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
                  ))}
              </div>
            </section>
          ))}
        </div>

        {/* Disclaimer */}
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="bg-red-900/20 border border-red-500/30 rounded-2xl p-6">
            <h3 className="text-xl font-bold text-red-300 mb-3">Disclaimer — For Research Purposes Only</h3>
            <p className="text-white/80 text-sm leading-relaxed">
              All content on this page is for research and educational purposes only and is not intended as medical advice.
              Always consult a qualified healthcare provider before starting any peptide or hormone protocol.
              Reset Biology does not sell peptides directly. Members access protocols through IRB enrollment with Cellular Peptide
              and may explore the buyer&apos;s union co-op via Zion Direct Care.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 text-center">
      <div className="text-3xl font-bold text-[#3FBFB5]">{value}</div>
      <div className="text-sm text-white/80 mt-1">{label}</div>
    </div>
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
