"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { PortalHeader } from "@/components/Navigation/PortalHeader"
import { Shield, HeartPulse, Activity, CheckCircle2, ArrowRight, Sparkles, Loader2 } from "lucide-react"

type Price = {
  id: string
  unitAmount: number
  currency: string
  interval: string | null
  isPrimary: boolean
  stripePriceId: string | null
}

type StorefrontProduct = {
  id: string
  slug: string
  name: string
  description: string | null
  imageUrl: string | null
  baseProductName: string | null
  variantLabel: string | null
  variantOrder: number | null
  prices: Price[]
  metadata?: Record<string, any> | null
}

type DisplayMeta = {
  tagline: string
  benefits: string[]
  fallbackPrice?: string
}

const FALLBACK_META: Record<string, DisplayMeta> = {
  "stemregen-release": {
    tagline: "Mobilize and renew",
    benefits: ["Supports healthy aging", "Cellular repair and recovery", "Daily maintenance"],
    fallbackPrice: "$132",
  },
  "stemregen-mobilize": {
    tagline: "Optimize delivery",
    benefits: ["Supports blood flow", "Capillary and endothelial support", "Pairs well with Release"],
    fallbackPrice: "$115",
  },
  "stemregen-signal": {
    tagline: "Guide the response",
    benefits: ["Supports recovery", "Calms inflammatory noise", "Completes the trio"],
    fallbackPrice: "$94",
  },
  "energybits-spirulina": {
    tagline: "Clean energy and focus",
    benefits: ["Plant protein fuel", "Pairs with workouts or breath", "Travel-friendly tablets"],
    fallbackPrice: "$130",
  },
  "energybits-chlorella": {
    tagline: "Detox and repair",
    benefits: ["Detox support", "Immune balance", "Great post-training"],
    fallbackPrice: "$130",
  },
  "energybits-vitalitybits": {
    tagline: "Longevity daily driver",
    benefits: ["Micronutrient dense", "Mitochondria support", "Blend of spirulina and chlorella"],
    fallbackPrice: "$130",
  },
}

const FALLBACK_IMAGES: Record<string, string> = {
  "stemregen-release":
    "https://www.stemregen.co/cdn/shop/files/Front_d9a801e2-e09c-4ce2-a02e-f17650946fa9.png?v=1749678028&width=600",
  "stemregen-mobilize": "https://www.stemregen.co/cdn/shop/files/Front.png?v=1721151426&width=600",
  "stemregen-signal":
    "https://www.stemregen.co/cdn/shop/files/Front_4a618035-5de7-44fc-8087-6696419a362e.png?v=1721152312&width=600",
  "energybits-spirulina":
    "https://energybits.com/cdn/shop/files/energybits-spirulina-large-baggeneralpartnerenergybits-954419.webp",
  "energybits-chlorella":
    "https://energybits.com/cdn/shop/files/recoverybits-chlorella-large-bagsubscriptionenergybits-9609058.jpg",
  "energybits-vitalitybits":
    "https://energybits.com/cdn/shop/files/vitalitybits-large-canistergeneralpartnerenergybits-486488.jpg",
}

function formatPrice(cents?: number) {
  if (typeof cents !== "number") return null
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}

function primaryPrice(product: StorefrontProduct) {
  return product.prices.find((p) => p.isPrimary) ?? product.prices[0]
}

export default function NonPeptideOrderPage() {
  const [catalog, setCatalog] = useState<StorefrontProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch("/api/products/non-peptide", { cache: "no-store" })
        const data = await res.json()
        const products: StorefrontProduct[] = data?.products ?? data ?? []
        setCatalog(products)
        setError(null)
      } catch (err: any) {
        console.error("Failed to load non-peptide catalog", err)
        setError("We could not load pricing. You can still browse and join the waitlist.")
        setCatalog([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const stemregenProducts = useMemo(
    () =>
      catalog.filter(
        (p) => p.slug.startsWith("stemregen-") || p.baseProductName?.toLowerCase() === "stemregen",
      ),
    [catalog],
  )
  const energybitsProducts = useMemo(
    () =>
      catalog.filter(
        (p) => p.slug.startsWith("energybits-") || p.baseProductName?.toLowerCase() === "energybits",
      ),
    [catalog],
  )

  const hasLiveProducts = catalog.length > 0

  const fallbackStemRegen: StorefrontProduct[] = [
    {
      id: "fallback-stemregen-release",
      slug: "stemregen-release",
      name: "StemRegen Release",
      description:
        "Clinically tested botanical blend designed to support natural stem cell release and migration for whole-body repair.",
      imageUrl: FALLBACK_IMAGES["stemregen-release"],
      baseProductName: "StemRegen",
      variantLabel: "Release",
      variantOrder: 1,
      prices: [],
    },
    {
      id: "fallback-stemregen-mobilize",
      slug: "stemregen-mobilize",
      name: "StemRegen Mobilize",
      description:
        "Microcirculation support to help nutrients and stem cells efficiently reach tissues that need repair.",
      imageUrl: FALLBACK_IMAGES["stemregen-mobilize"],
      baseProductName: "StemRegen",
      variantLabel: "Mobilize",
      variantOrder: 2,
      prices: [],
    },
    {
      id: "fallback-stemregen-signal",
      slug: "stemregen-signal",
      name: "StemRegen Signal",
      description:
        "Refines cellular signaling so circulating stem cells reach target tissues with less systemic noise.",
      imageUrl: FALLBACK_IMAGES["stemregen-signal"],
      baseProductName: "StemRegen",
      variantLabel: "Signal",
      variantOrder: 3,
      prices: [],
    },
  ]

  const fallbackEnergyBits: StorefrontProduct[] = [
    {
      id: "fallback-energybits-spirulina",
      slug: "energybits-spirulina",
      name: "ENERGYbits Spirulina | Large Bag",
      description:
        "Single-ingredient spirulina tablets for steady energy, focus, and workout support with no caffeine or sugar.",
      imageUrl: FALLBACK_IMAGES["energybits-spirulina"],
      baseProductName: "EnergyBits",
      variantLabel: "Spirulina",
      variantOrder: 1,
      prices: [],
    },
    {
      id: "fallback-energybits-chlorella",
      slug: "energybits-chlorella",
      name: "RECOVERYbits Chlorella | Large Bag",
      description: "Chlorella tablets to support detox, immune balance, and post-workout recovery.",
      imageUrl: FALLBACK_IMAGES["energybits-chlorella"],
      baseProductName: "EnergyBits",
      variantLabel: "Chlorella",
      variantOrder: 2,
      prices: [],
    },
    {
      id: "fallback-energybits-vitalitybits",
      slug: "energybits-vitalitybits",
      name: "VITALITYbits Spirulina/Chlorella | Large Bag",
      description: "Balanced spirulina and chlorella blend for micronutrients, mitochondria support, and satiety.",
      imageUrl: FALLBACK_IMAGES["energybits-vitalitybits"],
      baseProductName: "EnergyBits",
      variantLabel: "Spirulina/Chlorella",
      variantOrder: 3,
      prices: [],
    },
  ]

  const displayStemregen = hasLiveProducts ? stemregenProducts : fallbackStemRegen
  const displayEnergyBits = hasLiveProducts ? energybitsProducts : fallbackEnergyBits

  const handleCheckout = async (productId: string, priceId: string) => {
    setCheckoutLoading(productId)
    try {
      // Non-peptide carts bypass age gate
      sessionStorage.setItem("nonPeptideOnlyCart", "true")

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, priceId }),
      })

      const data = await res.json()
      if (data?.ok && data.url) {
        window.location.href = data.url
      } else {
        alert(data?.error || "Checkout failed. Please try again.")
        setCheckoutLoading(null)
      }
    } catch (err: any) {
      alert(err?.message || "Checkout failed. Please try again.")
      setCheckoutLoading(null)
    }
  }

  const ProductGrid = ({
    title,
    subtitle,
    products,
  }: {
    title: string
    subtitle: string
    products: StorefrontProduct[]
  }) => {
    return (
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-primary-300" />
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          <p className="text-sm text-gray-400">{subtitle}</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {products.map((product) => {
            const meta = FALLBACK_META[product.slug] || {
              tagline: product.metadata?.tagline || "",
              benefits: (product.metadata?.benefits as string[]) || [],
            }
            const price = primaryPrice(product)
            const priceLabel = formatPrice(price?.unitAmount) || meta.fallbackPrice

            return (
              <div
                key={product.id}
                className="bg-gradient-to-br from-primary-600/15 to-secondary-600/15 border border-primary-400/25 rounded-2xl shadow-2xl backdrop-blur-sm overflow-hidden flex flex-col"
              >
                <div className="h-56 bg-gray-900/40 flex items-center justify-center">
                  <img
                    src={product.imageUrl || FALLBACK_IMAGES[product.slug]}
                    alt={product.name}
                    className="h-full w-full object-contain p-6 drop-shadow-lg"
                  />
                </div>
                <div className="p-6 space-y-4 flex-1 flex flex-col">
                  <div>
                    <p className="text-primary-300 font-semibold text-sm uppercase tracking-wide">{meta.tagline}</p>
                    <h3 className="text-2xl font-bold text-white">{product.name}</h3>
                    <p className="text-gray-300 text-sm mt-2 leading-relaxed">{product.description}</p>
                  </div>
                  <div className="space-y-2">
                    {meta.benefits.map((benefit) => (
                      <div key={benefit} className="flex items-center gap-2 text-gray-200 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-secondary-300" />
                        <span>{benefit}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 mt-auto">
                    {priceLabel && <p className="text-lg font-semibold text-primary-200 mb-2">Price: {priceLabel}</p>}
                    {price?.id && product.id ? (
                      <button
                        type="button"
                        className="w-full bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white font-semibold py-3 rounded-xl shadow-lg hover:shadow-primary-500/30 transition-all flex items-center justify-center gap-2"
                        onClick={() => handleCheckout(product.id, price.id)}
                        disabled={checkoutLoading === product.id}
                      >
                        {checkoutLoading === product.id && <Loader2 className="w-4 h-4 animate-spin" />}
                        Buy now
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="w-full bg-white/10 hover:bg-white/20 text-white font-semibold py-3 rounded-xl shadow-lg transition-all"
                        onClick={() => alert("We will notify you as soon as checkout is live for this item.")}
                      >
                        Join waitlist
                      </button>
                    )}
                    {!price?.stripePriceId && price?.id && product.id && (
                      <p className="text-xs text-gray-400 text-center mt-2">
                        Syncing Stripe price on first click
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800"
      style={{
        backgroundImage: "linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="relative z-10 min-h-screen pb-16">
        <PortalHeader section="Order - Wellness Essentials" subtitle="Non-peptide therapeutics" showOrderPeptides={false} />

        <div className="pt-28 pb-12 text-center px-4">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-3 bg-primary-500/10 border border-primary-400/30 text-primary-200 px-4 py-2 rounded-full text-sm font-semibold">
              <Shield className="w-4 h-4" />
              Non-peptide stack - no age gate required
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white leading-tight">Cellular support without peptides</h1>
            <p className="text-lg md:text-xl text-gray-200 max-w-3xl mx-auto leading-relaxed">
              Offer StemRegen and EnergyBits for customers who want measurable metabolic, recovery, and longevity
              benefits without peptide requirements.
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
                href="/order/energybits"
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-3 rounded-xl border border-white/20 transition-all"
              >
                View EnergyBits page
              </Link>
            </div>
            {loading && (
              <div className="flex items-center justify-center gap-2 text-primary-200">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading pricing...</span>
              </div>
            )}
            {error && <p className="text-sm text-amber-200">{error}</p>}
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 pb-10">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-gray-900/60 border border-primary-400/20 rounded-2xl p-4 flex items-center gap-3">
              <HeartPulse className="w-6 h-6 text-primary-300" />
              <div>
                <p className="text-white font-semibold">No age verification</p>
                <p className="text-gray-300 text-sm">Ready for customers who are not eligible for peptides.</p>
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

        <ProductGrid title="StemRegen" subtitle="Regeneration support (non-peptide)" products={displayStemregen} />

        <div className="max-w-6xl mx-auto px-4 mt-12">
          <ProductGrid title="EnergyBits" subtitle="Algae tablets for energy, detox, and recovery" products={displayEnergyBits} />
          <div className="mt-6 flex items-center justify-end gap-3 text-sm text-primary-200">
            <ArrowRight className="w-4 h-4" />
            <Link href="/order/energybits" className="underline hover:text-primary-100">
              Deep dive the EnergyBits SKUs
            </Link>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 mt-14">
          <div className="bg-gray-900/70 border border-primary-400/20 rounded-3xl p-8 text-center space-y-4 shadow-xl">
            <h3 className="text-2xl md:text-3xl font-black text-white">Ready to offer non-peptide protocols?</h3>
            <p className="text-gray-300 text-lg">
              Direct checkout is being wired now. In the meantime, we can onboard customers manually and deliver guidance
              through the portal.
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
