"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { PortalHeader } from "@/components/Navigation/PortalHeader"
import { Leaf, BatteryCharging, CheckCircle2, Sparkles, ArrowRight, Loader2 } from "lucide-react"

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

const FALLBACK_ENERGYBITS: StorefrontProduct[] = [
  {
    id: "fallback-energybits-spirulina",
    slug: "energybits-spirulina",
    name: "ENERGYbits Spirulina | Large Bag",
    description:
      "Single-ingredient spirulina tablets for steady energy, focus, and workout support with no caffeine or sugar.",
    imageUrl: "https://energybits.com/cdn/shop/files/energybits-spirulina-large-baggeneralpartnerenergybits-954419.webp",
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
    imageUrl: "https://energybits.com/cdn/shop/files/recoverybits-chlorella-large-bagsubscriptionenergybits-9609058.jpg",
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
    imageUrl: "https://energybits.com/cdn/shop/files/vitalitybits-large-canistergeneralpartnerenergybits-486488.jpg",
    baseProductName: "EnergyBits",
    variantLabel: "Spirulina/Chlorella",
    variantOrder: 3,
    prices: [],
  },
]

const META: Record<string, DisplayMeta> = {
  "energybits-spirulina": {
    tagline: "Clean, steady energy",
    benefits: ["Plant protein fuel", "Supports focus and endurance", "Easy intermittent fasting fuel"],
    fallbackPrice: "$130",
  },
  "energybits-chlorella": {
    tagline: "Detox and repair",
    benefits: ["Supports detox and immunity", "Pairs with breath and sleep protocols", "Zero additives"],
    fallbackPrice: "$130",
  },
  "energybits-vitalitybits": {
    tagline: "Longevity daily driver",
    benefits: ["Balanced spirulina and chlorella", "Micronutrient dense", "Travel-ready tablets"],
    fallbackPrice: "$130",
  },
}

function formatPrice(cents?: number) {
  if (typeof cents !== "number") return null
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}

function primaryPrice(product: StorefrontProduct) {
  return product.prices.find((p) => p.isPrimary) ?? product.prices[0]
}

export default function EnergyBitsPage() {
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
        console.error("Failed to load EnergyBits catalog", err)
        setError("We could not load pricing. You can still browse and join the waitlist.")
        setCatalog([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const energybitsProducts = useMemo(
    () =>
      catalog.filter(
        (p) => p.slug.startsWith("energybits-") || p.baseProductName?.toLowerCase() === "energybits",
      ),
    [catalog],
  )
  const productsToShow = energybitsProducts.length ? energybitsProducts : FALLBACK_ENERGYBITS

  const handleCheckout = async (productId: string, priceId: string) => {
    setCheckoutLoading(productId)
    try {
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
        <PortalHeader section="Order - EnergyBits" subtitle="Non-peptide algae stacks" showOrderPeptides={false} />

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
                href="/order/non-peptide"
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-3 rounded-xl border border-white/20 transition-all"
              >
                View non-peptide hub
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

        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-6">
            {productsToShow.map((product) => {
              const meta = META[product.slug] || {
                tagline: product.metadata?.tagline || "",
                benefits: (product.metadata?.benefits as string[]) || [],
              }
              const price = primaryPrice(product)
              const priceLabel = formatPrice(price?.unitAmount) || meta.fallbackPrice
              const fallbackImage =
                product.imageUrl || FALLBACK_ENERGYBITS.find((p) => p.slug === product.slug)?.imageUrl || ""

              return (
                <div
                  key={product.id}
                  className="bg-gradient-to-br from-primary-600/15 to-secondary-600/15 border border-primary-400/25 rounded-2xl shadow-2xl backdrop-blur-sm overflow-hidden flex flex-col"
                >
                  <div className="h-56 bg-gray-900/40 flex items-center justify-center">
                    <img
                      src={fallbackImage}
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
                        <p className="text-xs text-gray-400 text-center mt-2">Syncing Stripe price on first click</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 mt-14">
          <div className="bg-gray-900/70 border border-primary-400/20 rounded-3xl p-8 text-center space-y-4 shadow-xl">
            <div className="flex justify-center gap-3 text-primary-200">
              <BatteryCharging className="w-6 h-6" />
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-2xl md:text-3xl font-black text-white">Ready to add EnergyBits to the store?</h3>
            <p className="text-gray-300 text-lg">
              We import SKUs, connect checkout, and bundle with portal accountability for energy, detox, and recovery.
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
