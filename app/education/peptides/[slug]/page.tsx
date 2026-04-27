import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getPeptide, listPeptideSlugs } from '@/data/peptide-education/generated';

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return listPeptideSlugs().map(slug => ({ slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const card = getPeptide(slug);
  if (!card) return { title: 'Peptide not found | Reset Biology' };
  return {
    title: `${card.peptide} — Hunter, Taylor, Bachmeyer | Reset Biology`,
    description: `${card.peptide} cross-expert reference: dosing protocols, acute vs chronic context, female-specific guidance, and Reset Biology synthesis. ${Object.values(card.experts).reduce((s: number, e: any) => s + (e.summary?.mention_count || 0), 0)} cited mentions across podcast and newsletter sources.`,
    alternates: { canonical: `/education/peptides/${slug}` },
  };
}

export default async function PeptidePage({ params }: Props) {
  const { slug } = await params;
  const card = getPeptide(slug);
  if (!card) notFound();

  const hunter = card.experts['hunter-williams'];
  const taylor = card.experts['taylor-williams'];
  const bachmeyer = card.experts['trevor-bachmeyer'];

  const totalMentions =
    (hunter?.summary?.mention_count || 0) +
    (taylor?.summary?.mention_count || 0) +
    (bachmeyer?.summary?.mention_count || 0);

  // JSON-LD: MedicalWebPage + Drug + Article
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MedicalWebPage',
    name: card.peptide,
    about: {
      '@type': 'Drug',
      name: card.peptide,
      alternateName: card.aliases,
    },
    mainContentOfPage: {
      '@type': 'WebPageElement',
      cssSelector: 'main',
    },
    audience: { '@type': 'MedicalAudience', audienceType: 'researcher' },
    citation: [
      ...(hunter?.summary?.top_sources || []).map(s => ({
        '@type': 'CreativeWork',
        name: s.source_title,
        datePublished: s.source_date,
        url: s.source_url,
        author: { '@type': 'Person', name: 'Hunter Williams' },
      })),
      ...(taylor?.summary?.top_sources || []).map(s => ({
        '@type': 'CreativeWork',
        name: s.source_title,
        datePublished: s.source_date,
        url: s.source_url,
        author: { '@type': 'Person', name: 'Taylor Williams' },
      })),
      ...(bachmeyer?.summary?.top_sources || []).map(s => ({
        '@type': 'CreativeWork',
        name: s.source_title,
        datePublished: s.source_date,
        url: s.source_url,
        author: { '@type': 'Person', name: 'Trevor Bachmeyer' },
      })),
    ],
    mentions: card.aliases.map(alt => ({ '@type': 'Thing', name: alt })),
  };

  return (
    <div className="min-h-screen bg-black relative">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="fixed inset-0 z-0">
        <Image src="/hero-background.jpg" alt="Background" fill className="object-cover opacity-40" priority />
      </div>

      <div className="relative z-10 pt-16">
        <div className="bg-gradient-to-r from-[#3FBFB5]/90 to-[#72C247]/90 backdrop-blur-md border-b border-white/10">
          <div className="container mx-auto px-4 py-12">
            <div className="text-sm text-white/80 mb-2">
              <Link href="/education" className="hover:underline">Education</Link>
              {' / '}
              <Link href="/education/peptides" className="hover:underline">Peptide Library</Link>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-4 text-white">{card.peptide}</h1>
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-lg text-white/95">{card.category !== 'Uncategorized' ? card.category : 'Cross-category'}</span>
              <span className="text-sm text-white/70">{totalMentions.toLocaleString()} cited mentions</span>
              {card.aliases.length > 1 && (
                <span className="text-sm text-white/70">Aliases: {card.aliases.slice(0, 5).join(', ')}</span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-blue-500/20 backdrop-blur-sm border-b border-blue-400/30">
          <div className="container mx-auto px-4 py-3">
            <p className="text-blue-100 text-center text-sm">
              Educational synthesis of three independent practitioners. Dosing references are research-context only.
            </p>
          </div>
        </div>

        <main className="container mx-auto px-4 py-8 space-y-12 max-w-7xl">

          {/* Reset Biology Synthesis (top — even if pending) */}
          <section className="bg-gradient-to-r from-[#3FBFB5]/10 to-[#72C247]/10 backdrop-blur-md border border-[#3FBFB5]/30 rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-[#3FBFB5] mb-3">Reset Biology Synthesis</h2>
            {card.reset_biology_synthesis.recommendation ? (
              <p className="text-white/90">{card.reset_biology_synthesis.recommendation}</p>
            ) : (
              <p className="text-white/60 italic">
                Cross-expert synthesis pending Codex distillation pass. Below are the raw findings from each practitioner.
              </p>
            )}
            {card.reset_biology_synthesis.cross_expert_consensus && (
              <div className="mt-4">
                <h3 className="font-semibold text-white">Where they agree</h3>
                <p className="text-white/80">{card.reset_biology_synthesis.cross_expert_consensus}</p>
              </div>
            )}
            {card.reset_biology_synthesis.cross_expert_disagreement && (
              <div className="mt-4">
                <h3 className="font-semibold text-white">Where they differ</h3>
                <p className="text-white/80">{card.reset_biology_synthesis.cross_expert_disagreement}</p>
              </div>
            )}
          </section>

          {/* Three-column expert grid */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Hunter */}
            <ExpertColumn
              title="Hunter Williams"
              subtitle="Protocol systematizer"
              accent="bg-[#3FBFB5]"
              hasContent={!!hunter}
            >
              {hunter && (
                <>
                  {hunter.baseline_protocol && (
                    <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <h4 className="font-bold text-green-300 mb-2">Baseline (2023 Cheat Sheet)</h4>
                      <dl className="text-sm space-y-1 text-white/85">
                        <ProtocolRow label="Dose" value={hunter.baseline_protocol.dose} />
                        <ProtocolRow label="Frequency" value={hunter.baseline_protocol.frequency} />
                        <ProtocolRow label="Timing" value={hunter.baseline_protocol.timing} />
                        <ProtocolRow label="Duration" value={hunter.baseline_protocol.duration} />
                        <ProtocolRow label="Reconstitution" value={`${hunter.baseline_protocol.vial_mg} vial + ${hunter.baseline_protocol.bac_mL} BAC`} />
                        <ProtocolRow label="Insulin units (1 mL)" value={hunter.baseline_protocol.units_on_1mL_insulin} />
                      </dl>
                    </div>
                  )}
                  <DoseList doses={hunter.summary.top_doses} />
                  <SourceList sources={hunter.summary.top_sources} maxItems={4} />
                </>
              )}
            </ExpertColumn>

            {/* Taylor */}
            <ExpertColumn
              title="Taylor Williams"
              subtitle="Female-focused HRT + peptides"
              accent="bg-pink-500"
              hasContent={!!taylor}
            >
              {taylor && (
                <>
                  <div className="mb-4 p-3 bg-pink-500/10 border border-pink-500/30 rounded-lg text-xs text-pink-200">
                    {taylor.female_specific_note}
                  </div>
                  <DoseList doses={taylor.summary.top_doses} />
                  <SourceList sources={taylor.summary.top_sources} maxItems={4} />
                </>
              )}
            </ExpertColumn>

            {/* Bachmeyer */}
            <ExpertColumn
              title="Dr Trevor Bachmeyer"
              subtitle="Acute vs chronic specialist"
              accent="bg-orange-500"
              hasContent={!!bachmeyer}
            >
              {bachmeyer && (
                <>
                  <div className="mb-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg text-xs text-orange-200">
                    {bachmeyer.acute_vs_chronic_note}
                  </div>
                  <DoseList doses={bachmeyer.summary.top_doses} />
                  {bachmeyer.summary.acute_signals.length > 0 && (
                    <SignalSection title="Acute context" tone="red" signals={bachmeyer.summary.acute_signals} />
                  )}
                  {bachmeyer.summary.chronic_signals.length > 0 && (
                    <SignalSection title="Chronic context" tone="blue" signals={bachmeyer.summary.chronic_signals} />
                  )}
                  <SourceList sources={bachmeyer.summary.top_sources} maxItems={4} />
                </>
              )}
            </ExpertColumn>
          </section>

          {/* Disclaimer */}
          <section className="bg-red-900/20 border border-red-500/30 rounded-2xl p-6">
            <h3 className="text-xl font-bold text-red-300 mb-3">Disclaimer — For Research Purposes Only</h3>
            <p className="text-white/80 text-sm leading-relaxed">
              All content on this page is for research and educational purposes only and is not intended as medical advice.
              Always consult a qualified healthcare provider before starting any peptide or hormone protocol.
              Reset Biology does not sell peptides directly. Members access protocols through IRB enrollment with Cellular Peptide
              and may explore the buyer&apos;s union co-op via Zion Direct Care.
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}

function ExpertColumn({ title, subtitle, accent, hasContent, children }: { title: string; subtitle: string; accent: string; hasContent: boolean; children: React.ReactNode }) {
  return (
    <article className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 overflow-hidden">
      <header className={`${accent} px-4 py-3`}>
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <p className="text-xs text-white/85">{subtitle}</p>
      </header>
      <div className="p-4">
        {hasContent ? children : <p className="text-white/40 italic text-sm">No content captured for this peptide from this expert.</p>}
      </div>
    </article>
  );
}

function ProtocolRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-white/5 py-1">
      <dt className="text-white/60">{label}</dt>
      <dd className="text-white font-mono">{value}</dd>
    </div>
  );
}

function DoseList({ doses }: { doses: { dose: string; count: number }[] }) {
  if (!doses?.length) return null;
  return (
    <div className="mb-4">
      <h4 className="font-semibold text-white/90 mb-2 text-sm">Top doses cited</h4>
      <ul className="space-y-1 text-sm">
        {doses.slice(0, 6).map(d => (
          <li key={d.dose} className="flex justify-between text-white/80">
            <span className="font-mono">{d.dose}</span>
            <span className="text-white/50">{d.count}×</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SourceList({ sources, maxItems }: { sources: any[]; maxItems: number }) {
  if (!sources?.length) return null;
  return (
    <div>
      <h4 className="font-semibold text-white/90 mb-2 text-sm">Top sources by mention density</h4>
      <ul className="space-y-2 text-xs">
        {sources.slice(0, maxItems).map((s, i) => (
          <li key={i} className="border-l-2 border-white/20 pl-2">
            <div className="text-white/60">{s.source_date}</div>
            {s.source_url ? (
              <a href={s.source_url} target="_blank" rel="noopener noreferrer" className="text-[#3FBFB5] hover:underline">
                {s.source_title} ({s.mention_count}×)
              </a>
            ) : (
              <div className="text-white/85">{s.source_title} ({s.mention_count}×)</div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SignalSection({ title, tone, signals }: { title: string; tone: 'red' | 'blue'; signals: any[] }) {
  const colors = tone === 'red'
    ? 'bg-red-500/10 border-red-500/30 text-red-200'
    : 'bg-blue-500/10 border-blue-500/30 text-blue-200';
  return (
    <div className={`mb-4 p-3 ${colors} border rounded-lg`}>
      <h4 className="font-semibold mb-2 text-sm">{title}</h4>
      <ul className="space-y-2 text-xs">
        {signals.slice(0, 3).map((s, i) => (
          <li key={i}>
            <div className="text-white/50 text-xs">{s.source_date} {s.timestamp ? `@ ${s.timestamp}` : ''}</div>
            <div className="italic text-white/80">&ldquo;{s.snippet?.slice(0, 200)}&rdquo;</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
