'use client';

import Link from 'next/link';
import { PortalHeader } from '@/components/Navigation/PortalHeader';

const researchPeptides = [
  {
    name: 'BPC-157',
    category: 'Tissue Repair',
    description:
      'A naturally occurring peptide found in human gastric juice. Research suggests it may support tissue repair, gut healing, and recovery from musculoskeletal injuries through angiogenesis and growth factor modulation.',
    researchAreas: ['Gut health', 'Tendon and ligament repair', 'Anti-inflammatory pathways'],
  },
  {
    name: 'TB-500',
    category: 'Recovery',
    description:
      'A synthetic fragment of Thymosin Beta-4, a protein involved in cell migration and differentiation. Studies indicate potential benefits for wound healing, flexibility, and cardiovascular function.',
    researchAreas: ['Muscle regeneration', 'Wound healing', 'Range of motion'],
  },
  {
    name: 'Semaglutide',
    category: 'Metabolic',
    description:
      'A GLP-1 receptor agonist studied extensively for metabolic regulation. Research demonstrates effects on appetite signaling, insulin sensitivity, and body composition.',
    researchAreas: ['Weight management', 'Blood sugar regulation', 'Cardiovascular markers'],
  },
  {
    name: 'Ipamorelin',
    category: 'Growth Hormone',
    description:
      'A selective growth hormone secretagogue that stimulates the pituitary gland. Research shows it may support fat metabolism, lean muscle preservation, and recovery without significant cortisol elevation.',
    researchAreas: ['Fat metabolism', 'Lean muscle', 'Sleep quality'],
  },
  {
    name: 'Epithalon',
    category: 'Anti-Aging',
    description:
      'A synthetic tetrapeptide studied for its effects on telomerase activity. Research suggests potential roles in cellular longevity, melatonin production, and sleep cycle regulation.',
    researchAreas: ['Telomere length', 'Sleep optimization', 'Cellular aging'],
  },
  {
    name: 'GHK-Cu',
    category: 'Skin & Collagen',
    description:
      'A copper-binding tripeptide naturally present in human plasma. Studies show it may stimulate collagen synthesis, support wound healing, and exhibit antioxidant properties.',
    researchAreas: ['Collagen production', 'Skin regeneration', 'Antioxidant activity'],
  },
];

export default function PeptideInfoPage() {
  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black pt-28"
      style={{
        backgroundImage:
          'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="relative z-10">
        <PortalHeader
          section="Peptide Co-op"
          subtitle="Research & community group purchasing"
        />
        {/* Hero Section */}
        <section className="py-20 px-4">
          <div className="container mx-auto max-w-4xl text-center">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary-400 to-secondary-400 bg-clip-text text-transparent">
              Understanding Peptides
            </h1>
            <p className="text-xl md:text-2xl text-gray-200 leading-relaxed max-w-3xl mx-auto mb-6">
              Peptides are short chains of amino acids that serve as signaling molecules in the
              body. They play critical roles in cellular communication, tissue repair, immune
              function, and metabolic regulation.
            </p>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              As research advances, peptides are becoming a key area of interest in wellness science.
              Below is an educational overview of peptides commonly studied in this field.
            </p>
          </div>
        </section>

        {/* Research Peptides Section */}
        <section className="py-12 px-4">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Peptides in <span className="text-secondary-400">Wellness Research</span>
              </h2>
              <p className="text-gray-300 max-w-2xl mx-auto">
                The following peptides are widely studied in peer-reviewed research. This
                information is provided for educational purposes only.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {researchPeptides.map((peptide) => (
                <div
                  key={peptide.name}
                  className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-xl hover:shadow-primary-400/20 hover:border-primary-400/50 transition-all duration-300"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl font-bold text-white">{peptide.name}</h3>
                    <span className="text-xs font-medium bg-primary-500/30 text-primary-200 px-3 py-1 rounded-full border border-primary-400/30">
                      {peptide.category}
                    </span>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed mb-4">
                    {peptide.description}
                  </p>
                  <div>
                    <h4 className="text-xs font-semibold text-secondary-300 uppercase tracking-wider mb-2">
                      Research Areas
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {peptide.researchAreas.map((area) => (
                        <span
                          key={area}
                          className="text-xs bg-gray-700/50 text-gray-300 px-2 py-1 rounded border border-gray-600/30"
                        >
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* For Research Purposes Only Banner */}
        <section className="py-8 px-4">
          <div className="container mx-auto max-w-4xl">
            <div className="bg-amber-900/30 backdrop-blur-sm rounded-xl p-6 border-2 border-amber-500/50 text-center">
              <h2 className="text-2xl md:text-3xl font-bold text-amber-300 mb-2 uppercase tracking-wider">
                For Research Purposes Only
              </h2>
              <p className="text-amber-200/80 text-sm max-w-2xl mx-auto">
                All peptides discussed on this page are for research and educational purposes
                only. Nothing here constitutes medical advice, and no peptides are sold through
                this website. Consult a qualified healthcare provider before making health-related
                decisions.
              </p>
            </div>
          </div>
        </section>

        {/* Co-op Section */}
        <section className="py-16 px-4">
          <div className="container mx-auto max-w-4xl">
            <div className="bg-gradient-to-br from-secondary-600/20 to-primary-600/20 backdrop-blur-sm rounded-2xl p-8 md:p-12 border border-secondary-400/30 shadow-2xl">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 text-center">
                The Peptide Co-op Model
              </h2>
              <p className="text-gray-200 text-lg leading-relaxed mb-4 text-center max-w-2xl mx-auto">
                The co-op is simple: a group of people comes together to make a single bulk order
                of peptides, imported directly from manufacturers in China.
              </p>
              <p className="text-gray-300 text-base leading-relaxed mb-8 text-center max-w-2xl mx-auto">
                This is the same source as grey market internet peptides and even IRB
                medications — the difference is{' '}
                <span className="text-white font-semibold">transparency</span>. We decided to
                get out of the middle. No markup middleman, no mystery supply chain. Everyone
                sees the actual import cost, and the group shares Certificate of Analysis (COA)
                third-party testing costs across all members.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="bg-gray-800/40 rounded-xl p-6 border border-gray-600/30 text-center">
                  <div className="text-3xl mb-3">&#x1f465;</div>
                  <h3 className="text-lg font-semibold text-white mb-2">Bulk Group Orders</h3>
                  <p className="text-gray-400 text-sm">
                    Members pool together for a single bulk order imported directly from
                    manufacturers. No reseller markup — you pay the actual import cost split
                    across the group.
                  </p>
                </div>

                <div className="bg-gray-800/40 rounded-xl p-6 border border-gray-600/30 text-center">
                  <div className="text-3xl mb-3">&#x1f52c;</div>
                  <h3 className="text-lg font-semibold text-white mb-2">Shared COA Testing</h3>
                  <p className="text-gray-400 text-sm">
                    Every batch gets independent Certificate of Analysis (COA) third-party
                    testing for purity and identity. The cost is shared across all co-op members
                    instead of borne individually.
                  </p>
                </div>

                <div className="bg-gray-800/40 rounded-xl p-6 border border-gray-600/30 text-center">
                  <div className="text-3xl mb-3">&#x1f4cb;</div>
                  <h3 className="text-lg font-semibold text-white mb-2">Full Transparency</h3>
                  <p className="text-gray-400 text-sm">
                    Every member receives their products plus shared testing results, supplier
                    information, and community knowledge. Fully transparent pricing — no hidden
                    fees or markups.
                  </p>
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-600/30 text-center">
                <h3 className="text-lg font-semibold text-white mb-3">Interested in the Co-op?</h3>
                <p className="text-gray-300 mb-4">
                  The co-op is run independently by Dr. Zion through Zion Direct Care. It is
                  based on his ideas and operates separately from his primary care practice.
                  Reach out to learn about current membership and upcoming group orders.
                </p>
                <a
                  href="https://ziondirectcare.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-secondary-600 hover:bg-secondary-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors shadow-lg hover:shadow-secondary-600/30 mb-4"
                >
                  Visit Zion Direct Care
                </a>
                <p className="text-sm text-amber-300/80 font-medium mt-4">
                  The co-op facilitates group purchasing and testing for research purposes only
                  — it does not provide medical advice or recommendations. You are responsible
                  for your own research and decisions.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Tracker Section */}
        <section className="py-12 px-4">
          <div className="container mx-auto max-w-4xl">
            <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-8 border border-primary-400/30 shadow-xl text-center">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                Already Tracking Peptides?
              </h2>
              <p className="text-gray-300 mb-6 max-w-xl mx-auto">
                Use the Reset Biology peptide tracker to log dosages, track cycles, and monitor
                your personal research protocols over time.
              </p>
              <Link
                href="/peptides"
                className="inline-block bg-primary-600 hover:bg-primary-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors shadow-lg hover:shadow-primary-600/30"
              >
                Open Peptide Tracker
              </Link>
            </div>
          </div>
        </section>

        {/* Disclaimer */}
        <section className="py-12 px-4 pb-20">
          <div className="container mx-auto max-w-4xl">
            <div className="bg-red-900/20 backdrop-blur-sm rounded-xl p-6 border border-red-500/30">
              <h3 className="text-lg font-semibold text-red-300 mb-3">
                Disclaimer — For Research Purposes Only
              </h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                The information on this page is provided for research and educational purposes
                only. It is not intended as medical advice, diagnosis, or treatment
                recommendations. Peptides discussed here are subjects of ongoing scientific
                research and may not be approved for human therapeutic use in all jurisdictions.
                Always consult a qualified healthcare provider before making any decisions related
                to your health. Reset Biology does not sell peptides directly. The co-op
                described above is an independent group purchasing arrangement operated by
                Dr. Zion through{' '}
                <a
                  href="https://ziondirectcare.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-red-300 underline hover:text-red-200"
                >
                  Zion Direct Care
                </a>{' '}
                and is not connected to his primary care practice.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
