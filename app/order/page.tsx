'use client';

import Link from 'next/link';
import { PortalHeader } from '@/components/Navigation/PortalHeader';

export default function PeptideCoopPage() {
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
        <PortalHeader section="Peptide Co-op" subtitle="Member-owned group access" />

        <section className="py-20 px-4">
          <div className="container mx-auto max-w-4xl text-center">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary-400 to-secondary-400 bg-clip-text text-transparent">
              A Clear Connection to the Co-op
            </h1>
            <p className="text-xl md:text-2xl text-gray-200 leading-relaxed max-w-3xl mx-auto mb-4">
              Reset Biology sells nothing and takes no payment on this site. {/* src: LMP §2.2 */}
            </p>
            <p className="text-lg text-gray-300 leading-relaxed max-w-3xl mx-auto">
              Ordering and management happen through a member-owned peptide co-op run by Adam Hyatt, FNP, at Zion Direct Care under his own license. {/* src: LMP §2.2 */}
            </p>
          </div>
        </section>

        <section className="pb-12 px-4">
          <div className="container mx-auto max-w-4xl">
            <div className="bg-gradient-to-br from-secondary-600/20 to-primary-600/20 backdrop-blur-sm rounded-2xl p-8 md:p-12 border border-secondary-400/30 shadow-2xl">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 text-center">
                What the Co-op Is
              </h2>
              <p className="text-gray-200 text-lg leading-relaxed text-center max-w-2xl mx-auto mb-8">
                The co-op is member-owned group access at fair prices. {/* src: LMP §2.2 */}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gray-800/40 rounded-xl p-6 border border-gray-600/30 text-center">
                  <h3 className="text-lg font-semibold text-white mb-2">Independent provider</h3>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    The co-op is run independently by Adam Hyatt, FNP, on his own license. {/* src: LMP §2.2 */}
                  </p>
                </div>
                <div className="bg-gray-800/40 rounded-xl p-6 border border-gray-600/30 text-center">
                  <h3 className="text-lg font-semibold text-white mb-2">Your own management</h3>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    Each participant manages their own decisions and relationship with the co-op. {/* src: LMP §2.2 */}
                  </p>
                </div>
                <div className="bg-gray-800/40 rounded-xl p-6 border border-gray-600/30 text-center">
                  <h3 className="text-lg font-semibold text-white mb-2">Reset Biology&apos;s role</h3>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    Reset Biology makes the connection; it does not sell or fulfill anything. {/* src: LMP §2.2 */}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-12 px-4">
          <div className="container mx-auto max-w-4xl">
            <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-8 border border-primary-400/30 shadow-xl text-center">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">How to Get Connected</h2>
              <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
                Begin with the intake, then use your daily toolset in the portal. {/* src: LMP §00, §2.2 */}
              </p>
              <Link
                href="/get-started"
                className="inline-block bg-primary-600 hover:bg-primary-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors shadow-lg hover:shadow-primary-600/30"
              >
                Get started
              </Link>
            </div>
          </div>
        </section>

        <section className="py-12 px-4">
          <div className="container mx-auto max-w-4xl">
            <div className="bg-gray-800/50 rounded-xl p-8 border border-gray-600/30 text-center">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Already a Member?</h2>
              <p className="text-gray-300 mb-6 max-w-xl mx-auto">
                Members can use the peptide tracker in the portal. {/* src: LMP §2.2 */}
              </p>
              <Link
                href="/peptides"
                className="inline-block bg-secondary-600 hover:bg-secondary-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors shadow-lg hover:shadow-secondary-600/30"
              >
                Open peptide tracker
              </Link>
            </div>
          </div>
        </section>

        <section className="py-12 px-4 pb-20">
          <div className="container mx-auto max-w-4xl">
            <div className="bg-amber-900/20 backdrop-blur-sm rounded-xl p-6 border border-amber-500/30">
              <h2 className="text-lg font-semibold text-amber-300 mb-3">Educational Disclaimer</h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                Reset Biology provides education and tools, not medical advice. {/* src: LMP §00 */}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
