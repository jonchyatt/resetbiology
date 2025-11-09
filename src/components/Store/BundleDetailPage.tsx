'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { Package, Check, ShoppingCart } from 'lucide-react'

interface Price {
  id: string
  unitAmount: number
  currency: string
  isPrimary: boolean
  stripePriceId: string | null
}

interface BundleItem {
  id: string
  quantity: number
  isOptional: boolean
  displayOrder: number
  componentProduct: {
    id: string
    name: string
    imageUrl: string | null
    prices: Price[]
  }
}

interface Bundle {
  id: string
  name: string
  slug: string
  description: string | null
  imageUrl: string | null
  prices: Price[]
  bundleItems: BundleItem[]
}

interface BundleDetailPageProps {
  bundle: Bundle
}

export default function BundleDetailPage({ bundle }: BundleDetailPageProps) {
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  const primaryPrice = bundle.prices.find(p => p.isPrimary)
  const bundlePrice = primaryPrice ? primaryPrice.unitAmount / 100 : 0

  // Calculate retail total (sum of all component prices)
  const retailTotal = bundle.bundleItems
    .filter(item => !item.isOptional)
    .reduce((sum, item) => {
      const componentPrice = item.componentProduct.prices.find(p => p.isPrimary)
      return sum + (componentPrice ? componentPrice.unitAmount / 100 : 0) * item.quantity
    }, 0)

  const savings = retailTotal - bundlePrice
  const savingsPercent = retailTotal > 0 ? Math.round((savings / retailTotal) * 100) : 0

  const requiredItems = bundle.bundleItems.filter(item => !item.isOptional)
  const optionalItems = bundle.bundleItems.filter(item => item.isOptional)

  const handleCheckout = async () => {
    if (!primaryPrice || !primaryPrice.stripePriceId) {
      alert('Price not configured for this bundle')
      return
    }

    setCheckoutLoading(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: bundle.id,
          priceId: primaryPrice.id
        }),
      })

      const data = await res.json()

      if (data.ok && data.url) {
        window.location.href = data.url
      } else {
        alert('Checkout failed: ' + (data.error || 'Unknown error'))
        setCheckoutLoading(false)
      }
    } catch (err: any) {
      alert('Checkout error: ' + err.message)
      setCheckoutLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black relative">
      {/* Hero Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-900/20 via-transparent to-secondary-900/20 pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-primary-400 mb-2">
            <Package className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wide">Package Deal</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            {bundle.name}
          </h1>
          {bundle.description && (
            <p className="text-xl text-gray-300 max-w-3xl">
              {bundle.description}
            </p>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-12">
          {/* Left Column - Image & Pricing */}
          <div>
            {/* Bundle Image */}
            <div className="bg-gray-800/50 rounded-2xl p-8 mb-6 backdrop-blur-sm border border-gray-700">
              {bundle.imageUrl ? (
                <div className="relative aspect-square">
                  <Image
                    src={bundle.imageUrl}
                    alt={bundle.name}
                    fill
                    className="object-contain"
                  />
                </div>
              ) : (
                <div className="aspect-square flex items-center justify-center bg-gray-700/50 rounded-lg">
                  <Package className="w-24 h-24 text-gray-500" />
                </div>
              )}
            </div>

            {/* Pricing Card */}
            <div className="bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl p-6 text-white">
              <div className="flex items-baseline justify-between mb-4">
                <div>
                  <div className="text-sm opacity-80 mb-1">Package Price</div>
                  <div className="text-5xl font-bold">${bundlePrice.toFixed(2)}</div>
                </div>
                {savings > 0 && (
                  <div className="text-right">
                    <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-semibold">
                      Save {savingsPercent}%
                    </div>
                    <div className="text-sm mt-1 opacity-80">
                      ${savings.toFixed(2)} off
                    </div>
                  </div>
                )}
              </div>

              {retailTotal > bundlePrice && (
                <div className="border-t border-white/20 pt-4 mb-4">
                  <div className="flex justify-between text-sm opacity-80">
                    <span>Retail Value:</span>
                    <span className="line-through">${retailTotal.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <button
                onClick={handleCheckout}
                disabled={checkoutLoading || !primaryPrice?.stripePriceId}
                className="w-full bg-white text-primary-600 hover:bg-gray-100 disabled:bg-gray-300 disabled:text-gray-500 font-bold py-4 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <ShoppingCart className="w-5 h-5" />
                {checkoutLoading ? 'Processing...' : 'Buy Now'}
              </button>
            </div>
          </div>

          {/* Right Column - What's Included */}
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">What's Included</h2>

            {/* Required Items */}
            <div className="space-y-4 mb-8">
              {requiredItems.map(item => {
                const componentPrice = item.componentProduct.prices.find(p => p.isPrimary)
                const price = componentPrice ? componentPrice.unitAmount / 100 : 0

                return (
                  <div
                    key={item.id}
                    className="bg-gray-800/50 rounded-xl p-4 backdrop-blur-sm border border-gray-700 flex items-center gap-4"
                  >
                    <div className="flex-shrink-0 w-16 h-16 relative bg-gray-700/50 rounded-lg overflow-hidden">
                      {item.componentProduct.imageUrl ? (
                        <Image
                          src={item.componentProduct.imageUrl}
                          alt={item.componentProduct.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-6 h-6 text-gray-500" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-white font-semibold">
                            {item.componentProduct.name}
                            {item.quantity > 1 && (
                              <span className="text-primary-400 ml-2">×{item.quantity}</span>
                            )}
                          </div>
                          <div className="text-sm text-gray-400">
                            ${price.toFixed(2)} each
                          </div>
                        </div>
                        <Check className="w-5 h-5 text-primary-400 mt-1" />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Optional Items */}
            {optionalItems.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span>Optional Add-Ons</span>
                  <span className="text-sm text-gray-400 font-normal">(sold separately)</span>
                </h3>
                <div className="space-y-3">
                  {optionalItems.map(item => {
                    const componentPrice = item.componentProduct.prices.find(p => p.isPrimary)
                    const price = componentPrice ? componentPrice.unitAmount / 100 : 0

                    return (
                      <div
                        key={item.id}
                        className="bg-gray-800/30 rounded-lg p-3 backdrop-blur-sm border border-gray-700/50 flex items-center gap-3 opacity-70"
                      >
                        <div className="flex-shrink-0 w-12 h-12 relative bg-gray-700/50 rounded overflow-hidden">
                          {item.componentProduct.imageUrl ? (
                            <Image
                              src={item.componentProduct.imageUrl}
                              alt={item.componentProduct.name}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-4 h-4 text-gray-500" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1">
                          <div className="text-gray-300 text-sm font-medium">
                            {item.componentProduct.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            +${price.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
