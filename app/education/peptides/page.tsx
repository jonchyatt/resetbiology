import Image from 'next/image';
import { peptideIndex } from '@/data/peptide-education/generated';
import PeptideLibraryBrowser from './PeptideLibraryBrowser';

export const metadata = {
  title: 'Peptide Library — Hunter, Taylor, Bachmeyer | Reset Biology',
  description: 'Cross-expert peptide library indexing what Hunter Williams, Taylor Williams, and Dr Trevor Bachmeyer teach about each compound — dosing, acute vs chronic, female-specific guidance, and Reset Biology synthesis.',
};

export default function PeptideLibraryHub() {
  const peptides = peptideIndex();

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

        {/* Search + category sections (client island) */}
        <PeptideLibraryBrowser peptides={peptides} />

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
