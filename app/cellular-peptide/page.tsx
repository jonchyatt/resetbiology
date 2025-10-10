'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { protocols } from '@/data/cellular-peptide/protocols';

export default function CellularPeptideProtocolsPage() {
  return (
    <div className="min-h-screen bg-black relative">
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
      <div className="relative z-10">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#3FBFB5]/90 to-[#72C247]/90 backdrop-blur-md border-b border-white/10">
          <div className="container mx-auto px-4 py-12">
            <h1 className="text-4xl md:text-6xl font-bold mb-4 text-white">
              IRB Protocol Packages
            </h1>
            <p className="text-xl text-white/95 max-w-3xl">
              Professionally designed peptide protocols backed by research and 3rd party testing.
              Select protocols available through IRB enrollment with Cellular Peptide.
            </p>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-500/20 backdrop-blur-sm border-b border-blue-400/30">
          <div className="container mx-auto px-4 py-4">
            <p className="text-blue-100 text-center">
              <strong>Note:</strong> These protocols are for information purposes only.
              To access these products, you must enroll through an IRB protocol with Cellular Peptide.
            </p>
          </div>
        </div>

        {/* Protocol Grid */}
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {protocols.map((protocol) => (
              <Link
                key={protocol.id}
                href={`/cellular-peptide/${protocol.slug}`}
                className="group bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl hover:shadow-[#3FBFB5]/50 hover:shadow-2xl transition-all duration-300 overflow-hidden border border-white/20 hover:border-[#3FBFB5]/50 hover:scale-105"
              >
                {/* Product Image */}
                <div className="relative h-64 bg-gradient-to-br from-white/5 to-white/10 overflow-hidden">
                  <Image
                    src={protocol.productImage}
                    alt={protocol.title}
                    fill
                    className="object-contain p-4 group-hover:scale-110 transition-transform duration-500"
                  />
                  {protocol.certificates.length > 0 && (
                    <div className="absolute top-4 right-4 bg-green-500/90 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-semibold shadow-lg">
                      ✓ 3rd Party Tested
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-6 bg-gradient-to-b from-white/5 to-white/10">
                  <h2 className="text-xl font-bold text-white mb-2 group-hover:text-[#3FBFB5] transition-colors">
                    {protocol.title}
                  </h2>

                  {/* Price & Duration */}
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
                    <div>
                      <div className="text-3xl font-bold text-[#3FBFB5]">
                        ${protocol.price}
                      </div>
                      <div className="text-sm text-white/60">
                        {protocol.duration}
                      </div>
                    </div>
                    <div className="bg-[#3FBFB5]/20 backdrop-blur-sm px-3 py-1 rounded-lg border border-[#3FBFB5]/30">
                      <div className="text-xs text-[#3FBFB5] uppercase tracking-wide font-semibold">
                        Protocol
                      </div>
                    </div>
                  </div>

                  {/* Peptides */}
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-white/80 mb-2">
                      Includes:
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {protocol.peptidesIncluded.map((peptide, idx) => (
                        <span
                          key={idx}
                          className="text-xs bg-white/10 backdrop-blur-sm text-white/90 px-2 py-1 rounded-full border border-white/20"
                        >
                          {peptide}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* What It Helps */}
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-white/80 mb-2">
                      What it helps with:
                    </h3>
                    <ul className="space-y-1">
                      {protocol.whatItHelps.slice(0, 3).map((benefit, idx) => (
                        <li key={idx} className="text-sm text-white/70 flex items-start">
                          <span className="text-[#72C247] mr-2">•</span>
                          {benefit}
                        </li>
                      ))}
                      {protocol.whatItHelps.length > 3 && (
                        <li className="text-sm text-white/50 italic">
                          + {protocol.whatItHelps.length - 3} more benefits...
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* CTA */}
                  <div className="mt-6 pt-4 border-t border-white/10">
                    <div className="flex items-center justify-between text-[#3FBFB5] font-semibold">
                      <span>View Full Protocol</span>
                      <svg
                        className="w-5 h-5 group-hover:translate-x-1 transition-transform"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Footer Info */}
        <div className="bg-black/40 backdrop-blur-md border-t border-white/10 mt-16">
          <div className="container mx-auto px-4 py-12">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-2xl font-bold mb-4 text-white">
                How to Access These Protocols
              </h2>
              <p className="text-white/70 mb-6">
                These professional protocol packages are available through Cellular Peptide's
                IRB (Institutional Review Board) enrollment process. Contact us to learn more
                about enrollment and determine which protocols are right for your health goals.
              </p>
              <div className="flex gap-4 justify-center">
                <Link
                  href="/contact"
                  className="bg-[#3FBFB5] text-white px-8 py-3 rounded-lg font-semibold hover:bg-[#2da89e] transition-colors shadow-lg hover:shadow-[#3FBFB5]/50"
                >
                  Contact Us
                </Link>
                <Link
                  href="/"
                  className="bg-white/10 backdrop-blur-sm text-white px-8 py-3 rounded-lg font-semibold border border-white/20 hover:border-[#3FBFB5]/50 transition-colors"
                >
                  Return Home
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
