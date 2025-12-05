"use client"

import Link from "next/link"
import { PortalHeader } from "@/components/Navigation/PortalHeader"
import { Shield, HeartPulse, Activity, CheckCircle2, ArrowRight } from "lucide-react"

type NonPeptideProduct = {
  name: string
  tagline: string
  description: string
  benefits: string[]
  image: string
}

const PRODUCTS: NonPeptideProduct[] = [
  {
    name: "StemRegen Release",
    tagline: "Mobilize & renew",
    description:
      "Clinically tested botanical blend designed to support natural stem cell release and migration for whole-body repair.",
    benefits: ["Supports healthy aging", "Cellular repair & recovery", "Daily maintenance"],
    image: "https://www.stemregen.co/cdn/shop/files/Front_d9a801e2-e09c-4ce2-a02e-f17650946fa9.png?v=1749678028&width=600",
  },
  {
    name: "StemRegen Mobilize",
    tagline: "Optimize delivery",
    description:
      "Microcirculation support to help nutrients and stem cells efficiently reach tissues that need repair.",
    benefits: ["Enhanced blood flow", "Capillary & endothelial support", "Pairs with Release"],
    image: "https://www.stemregen.co/cdn/shop/files/Front.png?v=1721151426&width=600",
  },
  {
    name: "StemRegen Signal",
    tagline: "Guide the response",
    description:
      "Refines cellular signaling so circulating stem cells reach target tissues with less systemic “noise.”",
    benefits: ["Supports recovery", "Calms inflammatory noise", "Completes the trio"],
    image: "https://www.stemregen.co/cdn/shop/files/Front_4a618035-5de7-44fc-8087-6696419a362e.png?v=1721152312&width=600",
  },
]

export default function NonPeptideOrderPage() {
  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800"
      style={{
        backgroundImage:
          "linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="relative z-10 min-h-screen pb-16">
        <PortalHeader section="Order — Wellness Essentials" subtitle="Non-peptide therapeutics" showOrderPeptides={false} />

        {/* Hero */}
        <div className="pt-28 pb-12 text-center px-4">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-3 bg-primary-500/10 border border-primary-400/30 text-primary-200 px-4 py-2 rounded-full text-sm font-semibold">
              <Shield className="w-4 h-4" />
              Non-peptide stack — no age gate required
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white leading-tight">
              Cellular support without peptides
            </h1>
            <p className="text-lg md:text-xl text-gray-200 max-w-3xl mx-auto leading-relaxed">
              Offer StemRegen and other non-peptide therapeutics directly—ideal for users not ready or eligible
              for peptides but who still want measurable metabolic, recovery, and longevity benefits.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-primary-500 to-secondary-500 text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:shadow-primary-500/30 transition-all"
              >
                Talk with our team
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/"
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-3 rounded-xl border border-white/20 transition-all"
              >
                Explore benefits
              </Link>
            </div>
          </div>
        </div>

        {/* Benefit strip */}
        <div className="max-w-6xl mx-auto px-4 pb-10">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-gray-900/60 border border-primary-400/20 rounded-2xl p-4 flex items-center gap-3">
              <HeartPulse className="w-6 h-6 text-primary-300" />
              <div>
                <p className="text-white font-semibold">No age verification</p>
                <p className="text-gray-300 text-sm">Ready for customers who can’t order peptides.</p>
              </div>
            </div>
            <div className="bg-gray-900/60 border border-primary-400/20 rounded-2xl p-4 flex items-center gap-3">
              <Activity className="w-6 h-6 text-secondary-300" />
              <div>
                <p className="text-white font-semibold">Complementary to portal tools</p>
                <p className="text-gray-300 text-sm">Pairs with breath, workout, journaling, and nutrition.</p>
              </div>
            </div>
            <div className="bg-gray-900/60 border border-primary-400/20 rounded-2xl p-4 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-300" />
              <div>
                <p className="text-white font-semibold">Clear protocols</p>
                <p className="text-gray-300 text-sm">Simple dosing guidance and accountability follow-up.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Product cards */}
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-6">
            {PRODUCTS.map((product) => (
              <div
                key={product.name}
                className="bg-gradient-to-br from-primary-600/15 to-secondary-600/15 border border-primary-400/25 rounded-2xl shadow-2xl backdrop-blur-sm overflow-hidden flex flex-col"
              >
                <div className="h-56 bg-gray-900/40 flex items-center justify-center">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="h-full w-full object-contain p-6 drop-shadow-lg"
                  />
                </div>
                <div className="p-6 space-y-4 flex-1 flex flex-col">
                  <div>
                    <p className="text-primary-300 font-semibold text-sm uppercase tracking-wide">{product.tagline}</p>
                    <h3 className="text-2xl font-bold text-white">{product.name}</h3>
                    <p className="text-gray-300 text-sm mt-2 leading-relaxed">{product.description}</p>
                  </div>
                  <div className="space-y-2">
                    {product.benefits.map((benefit) => (
                      <div key={benefit} className="flex items-center gap-2 text-gray-200 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-secondary-300" />
                        <span>{benefit}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 mt-auto">
                    <button
                      type="button"
                      className="w-full bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white font-semibold py-3 rounded-xl shadow-lg hover:shadow-primary-500/30 transition-all"
                      onClick={() => alert("Checkout for StemRegen products will be enabled soon. We’ll notify you!")}
                    >
                      Join Waitlist
                    </button>
                    <p className="text-xs text-gray-400 text-center mt-2">Store checkout coming soon</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA footer */}
        <div className="max-w-4xl mx-auto px-4 mt-14">
          <div className="bg-gray-900/70 border border-primary-400/20 rounded-3xl p-8 text-center space-y-4 shadow-xl">
            <h3 className="text-2xl md:text-3xl font-black text-white">Ready to offer non-peptide protocols?</h3>
            <p className="text-gray-300 text-lg">
              We’ll enable direct checkout for StemRegen in the store. Until then, we can onboard customers manually and
              deliver guidance through the portal.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:shadow-primary-500/30 transition-all"
              >
                Coordinate setup
              </Link>
              <Link
                href="/portal"
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white font-semibold px-6 py-3 rounded-xl border border-white/20 transition-all"
              >
                View portal tools
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
