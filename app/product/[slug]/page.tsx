'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { notFound, useRouter } from 'next/navigation';

interface Price {
  id: string;
  unitAmount: number;
  currency: string;
  interval: string | null;
  isPrimary: boolean;
  stripePriceId: string | null;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  prices: Price[];
  protocolPurpose?: string | null;
  protocolDosageRange?: string | null;
  protocolFrequency?: string | null;
  protocolTiming?: string | null;
  protocolDuration?: string | null;
  vialAmount?: string | null;
  reconstitutionInstructions?: string | null;
}

export default function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const router = useRouter();
  const { slug } = use(params);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    async function loadProduct() {
      try {
        const res = await fetch(`/api/products/by-slug/${slug}`);
        if (!res.ok) {
          notFound();
        }
        const data = await res.json();
        setProduct(data);
      } catch (err) {
        console.error('Failed to load product:', err);
        notFound();
      } finally {
        setLoading(false);
      }
    }
    loadProduct();
  }, [slug]);

  const handleCheckout = async (priceId: string) => {
    if (!product) return;

    setCheckoutLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, priceId }),
      });

      const data = await res.json();

      if (data.ok && data.url) {
        window.location.href = data.url;
      } else {
        alert('Checkout failed: ' + (data.error || 'Unknown error'));
        setCheckoutLoading(false);
      }
    } catch (err: any) {
      alert('Checkout error: ' + err.message);
      setCheckoutLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-white text-xl">Loading product...</div>
      </div>
    );
  }

  if (!product) {
    notFound();
  }

  const primaryPrice = product.prices.find(p => p.isPrimary) || product.prices[0];

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
      <div className="relative z-10 pt-16">
        {/* Back Button */}
        <div className="bg-black/40 backdrop-blur-md border-b border-white/10">
          <div className="container mx-auto px-4 py-4">
            <Link
              href="/order"
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
              Back to All Products
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
                    {product.imageUrl ? (
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        fill
                        className="object-contain p-8"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-white/40">
                        <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>

                {/* Info Column */}
                <div className="space-y-6">
                  <div>
                    <h1 className="text-4xl font-bold text-white mb-4">
                      {product.name}
                    </h1>
                    {product.description && (
                      <p className="text-white/80 text-lg leading-relaxed">
                        {product.description}
                      </p>
                    )}
                  </div>

                  {/* Protocol Info */}
                  {(product.protocolPurpose || product.vialAmount) && (
                    <div className="bg-gradient-to-br from-primary-500/20 to-secondary-500/20 rounded-xl p-6 border border-primary-400/30">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                        <svg className="w-5 h-5 text-primary-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        Protocol Information
                      </h3>
                      <div className="space-y-3 text-white/90">
                        {product.protocolPurpose && (
                          <div>
                            <span className="font-semibold text-primary-300">Purpose:</span>{' '}
                            {product.protocolPurpose}
                          </div>
                        )}
                        {product.vialAmount && (
                          <div>
                            <span className="font-semibold text-primary-300">Vial Amount:</span>{' '}
                            {product.vialAmount}
                          </div>
                        )}
                        {product.protocolDosageRange && (
                          <div>
                            <span className="font-semibold text-primary-300">Dosage Range:</span>{' '}
                            {product.protocolDosageRange}
                          </div>
                        )}
                        {product.protocolFrequency && (
                          <div>
                            <span className="font-semibold text-primary-300">Frequency:</span>{' '}
                            {product.protocolFrequency}
                          </div>
                        )}
                        {product.protocolTiming && (
                          <div>
                            <span className="font-semibold text-primary-300">Timing:</span>{' '}
                            {product.protocolTiming}
                          </div>
                        )}
                        {product.protocolDuration && (
                          <div>
                            <span className="font-semibold text-primary-300">Duration:</span>{' '}
                            {product.protocolDuration}
                          </div>
                        )}
                        {product.reconstitutionInstructions && (
                          <div>
                            <span className="font-semibold text-primary-300">Reconstitution:</span>{' '}
                            {product.reconstitutionInstructions}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Pricing & Purchase */}
                  <div className="bg-gradient-to-br from-white/5 to-white/10 rounded-xl p-6 border border-white/10">
                    {primaryPrice ? (
                      <>
                        <div className="mb-4">
                          <div className="text-sm text-white/60 uppercase tracking-wide mb-2">
                            Price
                          </div>
                          <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#3FBFB5] to-[#72C247]">
                            {(primaryPrice.unitAmount / 100).toLocaleString(undefined, {
                              style: 'currency',
                              currency: primaryPrice.currency.toUpperCase()
                            })}
                            {primaryPrice.interval && (
                              <span className="text-lg font-normal text-white/60 ml-2">
                                / {primaryPrice.interval}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => handleCheckout(primaryPrice.id)}
                          disabled={checkoutLoading}
                          className="w-full bg-gradient-to-r from-[#3FBFB5] to-[#72C247] hover:from-[#3FBFB5]/80 hover:to-[#72C247]/80 text-white font-bold py-4 px-8 rounded-lg shadow-xl hover:shadow-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center group"
                        >
                          <span className="text-lg">
                            {checkoutLoading ? 'Processing...' : 'Buy Now'}
                          </span>
                          {!checkoutLoading && (
                            <svg
                              className="w-6 h-6 ml-3 group-hover:translate-x-1 transition-transform"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M14 5l7 7m0 0l-7 7m7-7H3"
                              />
                            </svg>
                          )}
                        </button>
                      </>
                    ) : (
                      <div className="bg-red-500/20 border border-red-400/30 rounded-lg p-4">
                        <p className="text-red-400 font-medium">
                          Pricing not configured. Please contact support.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Information Section */}
            {product.description && (
              <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-white/20">
                <h2 className="text-2xl font-bold text-white mb-6">About This Product</h2>
                <div className="prose prose-invert max-w-none">
                  <p className="text-white/80 text-lg leading-relaxed whitespace-pre-line">
                    {product.description}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
