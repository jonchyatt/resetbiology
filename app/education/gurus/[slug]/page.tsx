import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getGuru, listGuruSlugs } from '@/data/gurus/generated';
import peptideNames from '@/data/gurus/peptide-names.json';

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return listGuruSlugs().map(slug => ({ slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const guru = getGuru(slug);
  if (!guru) return { title: 'Expert not found | Reset Biology' };
  return {
    title: `${guru.name} — ${guru.title} | Reset Biology`,
    description: `${guru.name}: ${guru.bio.slice(0, 200)}…`,
    alternates: { canonical: `/education/gurus/${slug}` },
  };
}

export default async function GuruPage({ params }: Props) {
  const { slug } = await params;
  const guru = getGuru(slug);
  if (!guru) notFound();

  const peptideMap = peptideNames as Record<string, string>;
  const covered = (guru.content_corpus.covered_peptides || [])
    .map(s => ({ slug: s, name: peptideMap[s] || s }))
    .filter(p => p.name);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: guru.name,
    jobTitle: guru.title,
    description: guru.bio,
    knowsAbout: guru.domains,
    url: `https://resetbiology.com/education/gurus/${guru.slug}`,
    sameAs: [guru.channels.youtube, guru.channels.beehiiv_url, guru.channels.website].filter(Boolean),
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
        {/* Hero */}
        <div className="bg-gradient-to-r from-[#3FBFB5]/90 to-[#72C247]/90 backdrop-blur-md border-b border-white/10">
          <div className="container mx-auto px-4 py-12">
            <div className="max-w-5xl mx-auto">
              <div className="text-sm mb-4">
                <Link href="/education/gurus" className="text-white/80 hover:text-white">← Expert Library</Link>
              </div>
              <div className="flex items-start gap-6">
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-[#3FBFB5] to-[#72C247] flex items-center justify-center text-white font-bold text-3xl md:text-4xl flex-shrink-0 border-4 border-white/30">
                  {guru.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-3xl md:text-5xl font-bold text-white">{guru.name}</h1>
                  <p className="text-lg md:text-xl text-white/95 mt-2">{guru.title}</p>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {guru.domains.map(d => (
                      <span key={d} className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-sm text-white border border-white/30">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-12">
          <div className="max-w-5xl mx-auto space-y-12">

            {/* Bio + voice quote */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <h2 className="text-2xl font-bold text-white mb-4">About</h2>
                <p className="text-white/85 leading-relaxed text-lg whitespace-pre-line">{guru.bio}</p>
                {guru.credentials && guru.credentials.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-sm uppercase tracking-wider text-white/60 mb-2">Credentials</h3>
                    <ul className="space-y-1 text-white/80">
                      {guru.credentials.map((c, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-[#3FBFB5] mt-1">•</span>
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {guru.voice_quote && (
                <aside className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-[#3FBFB5]/30 self-start">
                  <h3 className="text-sm uppercase tracking-wider text-[#3FBFB5] mb-3">In their own words</h3>
                  <blockquote className="text-white/90 italic leading-relaxed">
                    &ldquo;{guru.voice_quote}&rdquo;
                  </blockquote>
                  {guru.voice_quote_citation && (
                    <p className="mt-3 text-xs text-white/60 font-mono">{guru.voice_quote_citation}</p>
                  )}
                </aside>
              )}
            </section>

            {/* Channels */}
            {(guru.channels.youtube || guru.channels.beehiiv_url || guru.channels.website) && (
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">Where to find them</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {guru.channels.youtube && (
                    <a href={guru.channels.youtube} target="_blank" rel="noopener noreferrer" className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20 hover:border-red-400 transition-colors">
                      <div className="text-xs uppercase tracking-wider text-white/60 mb-1">YouTube</div>
                      <div className="text-white font-medium">{guru.channels.podcast_name || guru.channels.youtube_channel_handle || 'Channel'}</div>
                    </a>
                  )}
                  {guru.channels.beehiiv_url && (
                    <a href={guru.channels.beehiiv_url} target="_blank" rel="noopener noreferrer" className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20 hover:border-yellow-400 transition-colors">
                      <div className="text-xs uppercase tracking-wider text-white/60 mb-1">Beehiiv newsletter</div>
                      <div className="text-white font-medium">Subscribe</div>
                    </a>
                  )}
                  {guru.channels.website && (
                    <a href={guru.channels.website} target="_blank" rel="noopener noreferrer" className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20 hover:border-[#3FBFB5] transition-colors">
                      <div className="text-xs uppercase tracking-wider text-white/60 mb-1">Website</div>
                      <div className="text-white font-medium">Visit</div>
                    </a>
                  )}
                </div>
              </section>
            )}

            {/* Signature topics */}
            {guru.signature_topics && guru.signature_topics.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">Signature topics</h2>
                <div className="space-y-3">
                  {guru.signature_topics.map((t, i) => (
                    <div key={i} className="bg-white/10 backdrop-blur-sm rounded-lg p-5 border border-white/20">
                      <h3 className="text-lg font-semibold text-[#3FBFB5] mb-2">{t.topic}</h3>
                      <p className="text-sm text-white/75">{t.evidence}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Coverage stats */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">Library coverage</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center border border-white/20">
                  <div className="text-2xl font-bold text-[#3FBFB5]">{guru.content_corpus.youtube_transcripts || 0}</div>
                  <div className="text-xs text-white/70">Episodes</div>
                </div>
                {guru.content_corpus.beehiiv_emails != null && (
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center border border-white/20">
                    <div className="text-2xl font-bold text-[#3FBFB5]">{guru.content_corpus.beehiiv_emails}</div>
                    <div className="text-xs text-white/70">Newsletter posts</div>
                  </div>
                )}
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center border border-white/20">
                  <div className="text-2xl font-bold text-[#3FBFB5]">{(guru.content_corpus.total_peptide_mentions || 0).toLocaleString()}</div>
                  <div className="text-xs text-white/70">Cited mentions</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center border border-white/20">
                  <div className="text-2xl font-bold text-[#3FBFB5]">{guru.content_corpus.covered_peptides_count || 0}</div>
                  <div className="text-xs text-white/70">Peptides covered</div>
                </div>
              </div>
            </section>

            {/* Peptides covered */}
            {covered.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">Peptides {guru.name.split(' ')[0]} speaks on</h2>
                <p className="text-sm text-white/70 mb-4">Sorted by mention count desc. Click any to jump to the peptide&apos;s cross-expert page.</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {covered.map(p => (
                    <Link
                      key={p.slug}
                      href={`/education/peptides/${p.slug}`}
                      className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/20 hover:border-[#3FBFB5] hover:bg-white/15 transition-all text-white text-sm"
                    >
                      {p.name}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Disclaimer */}
            <section className="bg-red-900/20 border border-red-500/30 rounded-2xl p-6">
              <h3 className="text-xl font-bold text-red-300 mb-3">Disclaimer — For Research Purposes Only</h3>
              <p className="text-white/80 text-sm leading-relaxed">
                Reset Biology cites and indexes this practitioner&apos;s public content for educational and research purposes.
                Profiles are summaries with verbatim citations, not endorsements. {guru.name} is not affiliated with Reset Biology
                unless explicitly stated. Always consult a qualified healthcare provider before starting any peptide or hormone
                protocol. Reset Biology does not sell peptides directly. Members access protocols through IRB enrollment with
                Cellular Peptide and may explore the buyer&apos;s union co-op via Zion Direct Care.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
