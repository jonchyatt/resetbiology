import Link from 'next/link';
import Image from 'next/image';
import { listGurus, listAllDomains } from '@/data/gurus/generated';

export const metadata = {
  title: 'Expert Library — Reset Biology',
  description: 'The practitioners and researchers Reset Biology cites across health and longevity — peptides, hormones, mitochondrial health, longevity protocols. Each profile links to the peptides and topics they cover with verbatim citations.',
  alternates: { canonical: '/education/gurus' },
};

export default function GuruLibraryHub() {
  const gurus = listGurus();
  const domains = listAllDomains();

  const totalEpisodes = gurus.reduce((s, g) => s + (g.content_corpus.youtube_transcripts || 0), 0);
  const totalMentions = gurus.reduce((s, g) => s + (g.content_corpus.total_peptide_mentions || 0), 0);
  const totalPeptidesCovered = new Set(
    gurus.flatMap(g => g.content_corpus.covered_peptides || [])
  ).size;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Reset Biology Expert Library',
    description: 'The practitioners and researchers Reset Biology cites across health and longevity.',
    numberOfItems: gurus.length,
    hasPart: gurus.map(g => ({
      '@type': 'Person',
      '@id': `https://resetbiology.com/education/gurus/${g.slug}`,
      name: g.name,
      jobTitle: g.title,
      knowsAbout: g.domains,
    })),
  };

  return (
    <div className="min-h-screen bg-black relative">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="fixed inset-0 z-0">
        <Image
          src="/hero-background.jpg"
          alt="Background"
          fill
          className="object-cover opacity-40"
          priority
        />
      </div>

      <div className="relative z-10 pt-16">
        <div className="bg-gradient-to-r from-[#3FBFB5]/90 to-[#72C247]/90 backdrop-blur-md border-b border-white/10">
          <div className="container mx-auto px-4 py-12">
            <h1 className="text-4xl md:text-6xl font-bold mb-4 text-white">
              Expert Library
            </h1>
            <p className="text-xl text-white/95 max-w-3xl">
              The practitioners and researchers Reset Biology cites — each profile is a window into one expert's voice, with verbatim citations linking back to the original episode or article.
            </p>
          </div>
        </div>

        <div className="bg-blue-500/20 backdrop-blur-sm border-b border-blue-400/30">
          <div className="container mx-auto px-4 py-4">
            <p className="text-blue-100 text-center">
              <strong>Note:</strong> This library is generic — Phase 1 ships {gurus.length} peptide-focused practitioners. Future gurus across hormones, sleep, fasting, mitochondrial health, and longevity will live here under the same structure.
            </p>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center border border-white/20">
              <div className="text-3xl font-bold text-[#3FBFB5]">{gurus.length}</div>
              <div className="text-sm text-white/80">Active gurus</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center border border-white/20">
              <div className="text-3xl font-bold text-[#3FBFB5]">{totalEpisodes}</div>
              <div className="text-sm text-white/80">Episodes indexed</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center border border-white/20">
              <div className="text-3xl font-bold text-[#3FBFB5]">{totalMentions.toLocaleString()}</div>
              <div className="text-sm text-white/80">Cited mentions</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center border border-white/20">
              <div className="text-3xl font-bold text-[#3FBFB5]">{totalPeptidesCovered}</div>
              <div className="text-sm text-white/80">Peptides covered</div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 pb-16">
          <div className="max-w-5xl mx-auto">
            <div className="mb-6">
              <h2 className="text-sm uppercase tracking-wider text-white/60 mb-3">Domains covered</h2>
              <div className="flex flex-wrap gap-2">
                {domains.map(d => (
                  <span key={d} className="px-3 py-1 bg-white/10 backdrop-blur-sm rounded-full text-sm text-white border border-white/20">
                    {d}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {gurus.map(g => (
                <Link
                  key={g.slug}
                  href={`/education/gurus/${g.slug}`}
                  className="group bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:border-[#3FBFB5] hover:bg-white/15 transition-all"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#3FBFB5] to-[#72C247] flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                      {g.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-white group-hover:text-[#3FBFB5] transition-colors">
                        {g.name}
                      </h3>
                      <p className="text-sm text-white/70 mt-1">{g.title}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {g.domains.slice(0, 4).map(d => (
                      <span key={d} className="text-xs px-2 py-0.5 bg-[#3FBFB5]/20 text-[#3FBFB5] rounded">
                        {d}
                      </span>
                    ))}
                    {g.domains.length > 4 && (
                      <span className="text-xs px-2 py-0.5 text-white/60">+{g.domains.length - 4}</span>
                    )}
                  </div>
                  <div className="text-sm text-white/80 line-clamp-3">{g.bio}</div>
                  <div className="mt-4 flex items-center justify-between text-xs text-white/60">
                    <span>{(g.content_corpus.total_peptide_mentions || 0).toLocaleString()} cited mentions</span>
                    <span>{g.content_corpus.covered_peptides_count || 0} peptides</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
