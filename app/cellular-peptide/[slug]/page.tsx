'use client';

import React, { use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { protocols } from '@/data/cellular-peptide/protocols';
import { notFound } from 'next/navigation';

export default function ProtocolDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const protocol = protocols.find((p) => p.slug === slug);

  if (!protocol) {
    notFound();
  }

  // Parse testimonials into individual quotes
  const testimonialList = protocol.testimonials
    ? protocol.testimonials.split('\n\n').filter(t => t.trim())
    : [];

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
        {/* Back Button */}
        <div className="bg-black/40 backdrop-blur-md border-b border-white/10">
          <div className="container mx-auto px-4 py-4">
            <Link
              href="/cellular-peptide"
              className="inline-flex items-center text-[#3FBFB5] hover:text-[#72C247] font-semibold transition-colors"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to All Protocols
            </Link>
          </div>
        </div>

        <div className="container mx-auto px-4 py-12">
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Header Section */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden border border-white/20">
              <div className="grid md:grid-cols-2 gap-8 p-8">
                {/* Image Column */}
                <div className="space-y-4">
                  <div className="relative h-96 bg-gradient-to-br from-white/5 to-white/10 rounded-xl overflow-hidden border border-white/10">
                    <Image
                      src={protocol.productImage}
                      alt={protocol.title}
                      fill
                      className="object-contain p-8"
                    />
                  </div>

                  {/* Certificates */}
                  {protocol.certificates.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-white/80 mb-3 flex items-center">
                        <svg
                          className="w-5 h-5 text-green-400 mr-2"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        3rd Party Certificates of Analysis
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        {protocol.certificates.map((cert, idx) => (
                          <a
                            key={idx}
                            href={cert}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="relative h-32 bg-white/5 backdrop-blur-sm border-2 border-white/20 rounded-lg hover:border-[#3FBFB5]/50 transition-colors overflow-hidden group"
                          >
                            <Image
                              src={cert}
                              alt={`Certificate ${idx + 1}`}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform"
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Info Column */}
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
                    {protocol.title}
                  </h1>

                  {/* Price & Duration */}
                  <div className="bg-gradient-to-r from-[#3FBFB5]/20 to-[#72C247]/20 backdrop-blur-sm rounded-xl p-6 mb-6 border border-[#3FBFB5]/30">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="text-sm text-white/60 mb-1">Retail Price</div>
                        <div className="text-4xl font-bold text-[#3FBFB5]">
                          ${protocol.price}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-white/60 mb-1">Duration</div>
                        <div className="text-2xl font-bold text-white">
                          {protocol.duration}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Peptides Included */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-white mb-3">
                      Peptides Included:
                    </h3>
                    <div className="space-y-2">
                      {protocol.peptidesIncluded.map((peptide, idx) => (
                        <div
                          key={idx}
                          className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg px-4 py-2 text-white"
                        >
                          {peptide}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Package Includes */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-white mb-3">
                      Package Includes:
                    </h3>
                    <ul className="space-y-2">
                      {protocol.packageIncludes.map((item, idx) => (
                        <li key={idx} className="flex items-start text-white/80">
                          <svg
                            className="w-5 h-5 text-[#72C247] mr-3 mt-0.5 flex-shrink-0"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* What It Helps With */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-white/20">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
                <span className="bg-gradient-to-r from-[#3FBFB5] to-[#72C247] text-white w-10 h-10 rounded-full flex items-center justify-center mr-3 text-lg">
                  1
                </span>
                What does the protocol help with?
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {protocol.whatItHelps.map((benefit, idx) => (
                  <div
                    key={idx}
                    className="flex items-start bg-gradient-to-r from-[#3FBFB5]/10 to-transparent backdrop-blur-sm rounded-lg p-4 border-l-4 border-[#3FBFB5]"
                  >
                    <svg
                      className="w-6 h-6 text-[#3FBFB5] mr-3 mt-0.5 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-white/90 font-medium">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* How It Works */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-white/20">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
                <span className="bg-gradient-to-r from-[#72C247] to-[#3FBFB5] text-white w-10 h-10 rounded-full flex items-center justify-center mr-3 text-lg">
                  2
                </span>
                How does the protocol work?
              </h2>
              <div className="prose max-w-none text-white/80 leading-relaxed text-lg">
                {protocol.howItWorks}
              </div>
            </div>

            {/* Dosing Instructions */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-white/20">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
                <span className="bg-gradient-to-r from-[#3FBFB5] to-[#72C247] text-white w-10 h-10 rounded-full flex items-center justify-center mr-3 text-lg">
                  3
                </span>
                Protocol Instructions
              </h2>
              <div className="space-y-6">
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border-l-4 border-[#3FBFB5]">
                  <h3 className="font-semibold text-white mb-2 flex items-center">
                    <svg className="w-5 h-5 text-[#3FBFB5] mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" />
                    </svg>
                    Dosing:
                  </h3>
                  <p className="text-white/80">{protocol.dosing}</p>
                </div>
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border-l-4 border-[#72C247]">
                  <h3 className="font-semibold text-white mb-2 flex items-center">
                    <svg className="w-5 h-5 text-[#72C247] mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                    </svg>
                    Timing:
                  </h3>
                  <p className="text-white/80">{protocol.timing}</p>
                </div>
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border-l-4 border-yellow-500">
                  <h3 className="font-semibold text-white mb-2 flex items-center">
                    <svg className="w-5 h-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5zm2.5 3a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm6.207.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4a1 1 0 00-1.414-1.414L13 7.586l-1.293-1.293z" clipRule="evenodd" />
                    </svg>
                    Storage & Reconstitution:
                  </h3>
                  <p className="text-white/80">{protocol.reconstitution}</p>
                </div>
              </div>
            </div>

            {/* Testimonials */}
            {testimonialList.length > 0 && (
              <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-white/20">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
                  <svg className="w-8 h-8 text-[#72C247] mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                  </svg>
                  Patient Testimonials
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                  {testimonialList.map((testimonial, idx) => (
                    <div
                      key={idx}
                      className="bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:border-[#3FBFB5]/50 transition-colors"
                    >
                      <svg className="w-10 h-10 text-[#3FBFB5]/30 mb-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                      </svg>
                      <blockquote className="text-white/80 italic mb-4 text-lg leading-relaxed">
                        {testimonial}
                      </blockquote>
                      <div className="h-px bg-gradient-to-r from-[#3FBFB5]/50 to-transparent"></div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="bg-gradient-to-r from-[#3FBFB5]/20 to-[#72C247]/20 backdrop-blur-md rounded-2xl shadow-2xl p-8 text-center border border-[#3FBFB5]/30">
              <h2 className="text-2xl font-bold mb-4 text-white">
                Interested in This Protocol?
              </h2>
              <p className="text-white/80 mb-6 max-w-2xl mx-auto">
                This protocol is available through Cellular Peptide's IRB enrollment process.
                Contact us to learn more about how to get started.
              </p>
              <div className="flex gap-4 justify-center flex-wrap">
                <Link
                  href="/contact"
                  className="bg-gradient-to-r from-[#3FBFB5] to-[#72C247] text-white px-8 py-3 rounded-lg font-semibold hover:shadow-lg hover:shadow-[#3FBFB5]/50 transition-all"
                >
                  Contact Us
                </Link>
                <Link
                  href="/cellular-peptide"
                  className="bg-white/10 backdrop-blur-sm text-white px-8 py-3 rounded-lg font-semibold hover:bg-white/20 transition-colors border border-white/30"
                >
                  View All Protocols
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
