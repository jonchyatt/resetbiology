"use client"

import Link from "next/link"
import { PortalHeader } from "@/components/Navigation/PortalHeader"
import { Leaf, BatteryCharging, CheckCircle2, Sparkles, ArrowRight } from "lucide-react"

type EnergyBitsProduct = {
  name: string
  tagline: string
  description: string
  benefits: string[]
  image: string
}

const PRODUCTS: EnergyBitsProduct[] = [
  {
    name: "ENERGYbits® Spirulina",
    tagline: "Clean, steady energy",
    description: "1-ingredient spirulina tablets for focus, workouts, and daily vitality without caffeine or sugar.",
    benefits: ["Plant-based protein (3x steak)", "Supports focus & endurance", "Easy intermittent fasting fuel"],
    image: "https://energybits.com/cdn/shop/files/energybits-spirulina-large-baggeneralpartnerenergybits-954419.webp",
  },
  {
    name: "RECOVERYbits® Chlorella",
    tagline: "Detox & repair",
    description: "Chlorella tablets to support detox, immune balance, and post-workout recovery.",
    benefits: ["Supports detox & immunity", "Pairs with breath & sleep protocols", "Zero additives"],
    image: "https://energybits.com/cdn/shop/files/recoverybits-chlorella-large-bagsubscriptionenergybits-9609058.jpg",
  },
  {
    name: "VITALITYbits® Blend",
    tagline: "Longevity daily driver",
    description: "Spirulina + chlorella combo for daily micronutrients, mitochondria support, and appetite control.",
    benefits: ["Balanced spirulina + chlorella", "Micronutrient dense", "Travel-ready tabs"],
    image: "https://energybits.com/cdn/shop/files/vitalitybits-large-canistergeneralpartnerenergybits-486488.jpg",
  },
]

export default function EnergyBitsPage() {
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
        <PortalHeader section="Order — EnergyBits" subtitle="Non-peptide algae stacks" showOrderPeptides={false} />

        {/* Hero */}
        <div className="pt-28 pb-12 text-center px-4">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-3 bg-primary-500/10 border border-primary-400/30 text-primary-200 px-4 py-2 rounded-full text-sm font-semibold">
              <Leaf className="w-4 h-4" />
              Non-peptide | No age verification
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white leading-tight">
              Pure algae tablets for energy, detox, and recovery
            </h1>
            <p className="text-lg md:text-xl text-gray-200 max-w-3xl mx-auto leading-relaxed">
              ENERGYbits spirulina and chlorella tablets fit perfectly with our breath, workout, and recovery programs.
              Clean, single-ingredient nutrition you can take anywhere.
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
                href="/portal"
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-3 rounded-xl border border-white/20 transition-all"
              >
                Pair with portal tools
              </Link>
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
                      onClick={() => alert("EnergyBits checkout will be enabled soon. We’ll notify you!")}
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
            <div className="flex justify-center gap-3 text-primary-200">
              <BatteryCharging className="w-6 h-6" />
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-2xl md:text-3xl font-black text-white">Ready to add EnergyBits to the store?</h3>
            <p className="text-gray-300 text-lg">
              We can import SKUs, connect checkout, and bundle with portal accountability for energy, detox, and recovery.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:shadow-primary-500/30 transition-all"
              >
                Coordinate setup
              </Link>
              <Link
                href="/order/non-peptide"
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white font-semibold px-6 py-3 rounded-xl border border-white/20 transition-all"
              >
                View non-peptide hub
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
