'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PortalHeader } from '@/components/Navigation/PortalHeader';
import AgeVerificationModal from '@/components/AgeVerification/AgeVerificationModal';

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
  baseProductName: string | null;
  variantLabel: string | null;
  variantOrder: number | null;
  trackInventory: boolean;
  quantityAvailable: number | null;
  lowStockThreshold: number | null;
  allowBackorder: boolean;
  isBundle: boolean;
}

interface ProductGroup {
  baseName: string;
  variants: Product[];
  imageUrl: string | null;
  description: string | null;
}

export default function OrderPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<'all' | 'peptides' | 'packages'>('all');

  // Fetch products on mount
  useEffect(() => {
    async function loadProducts() {
      try {
        const res = await fetch('/api/products/storefront');
        const data = await res.json();

        // Sort products: Bacteriostatic Water at the bottom
        const sorted = data.sort((a: Product, b: Product) => {
          const aIsBacteriostatic = a.name.toLowerCase().includes('bacteriostatic');
          const bIsBacteriostatic = b.name.toLowerCase().includes('bacteriostatic');

          if (aIsBacteriostatic && !bIsBacteriostatic) return 1; // a goes to bottom
          if (!aIsBacteriostatic && bIsBacteriostatic) return -1; // b goes to bottom
          return 0; // keep original order
        });

        setProducts(sorted);
      } catch (err) {
        console.error('Failed to load products:', err);
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, []);

  // Filter products based on selected filter
  const filteredProducts = products.filter(product => {
    if (filter === 'all') return true;
    if (filter === 'packages') return product.isBundle;
    if (filter === 'peptides') return !product.isBundle;
    return true;
  });

  // Group products by baseProductName or treat as individual products
  const productGroups: ProductGroup[] = (() => {
    const groups: Map<string, ProductGroup> = new Map();

    filteredProducts.forEach((product) => {
      const baseName = product.baseProductName || product.name;

      if (!groups.has(baseName)) {
        groups.set(baseName, {
          baseName,
          variants: [],
          imageUrl: product.imageUrl,
          description: product.description,
        });
      }

      groups.get(baseName)!.variants.push(product);
    });

    // Sort variants within each group by variantOrder
    groups.forEach((group) => {
      group.variants.sort((a, b) => {
        const orderA = a.variantOrder ?? 0;
        const orderB = b.variantOrder ?? 0;
        return orderA - orderB;
      });
    });

    return Array.from(groups.values());
  })();

  const handleCheckout = async (productId: string, priceId: string) => {
    setCheckoutLoading(productId);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, priceId }),
      });

      const data = await res.json();

      if (data.ok && data.url) {
        window.location.href = data.url;
      } else {
        alert('Checkout failed: ' + (data.error || 'Unknown error'));
        setCheckoutLoading(null);
      }
    } catch (err: any) {
      alert('Checkout error: ' + err.message);
      setCheckoutLoading(null);
    }
  };

  // Get stock status for a product
  const getStockStatus = (product: Product): 'in_stock' | 'low_stock' | 'out_of_stock' | 'no_tracking' => {
    if (!product.trackInventory) return 'no_tracking';

    const qty = product.quantityAvailable ?? 0;
    const threshold = product.lowStockThreshold ?? 5;

    if (qty === 0) return 'out_of_stock';
    if (qty <= threshold) return 'low_stock';
    return 'in_stock';
  };

  // Check if product is purchasable
  const canPurchase = (product: Product): boolean => {
    if (!product.trackInventory) return true; // No inventory tracking = always available

    const qty = product.quantityAvailable ?? 0;
    return qty > 0 || product.allowBackorder;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-white text-xl">Loading products...</div>
      </div>
    );
  }

  return (
    <>
      {/* Age Verification Modal */}
      <AgeVerificationModal />

      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative pt-28"
           style={{
             backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
             backgroundSize: 'cover',
             backgroundPosition: 'center',
             backgroundAttachment: 'fixed'
           }}>
        <div className="relative z-10">
          <PortalHeader
            section="Order Peptides"
            subtitle="Premium quality peptides for your wellness journey"
            showOrderPeptides={false}
          />

        <div className="text-center pt-8 pb-6">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 text-shadow-lg animate-fade-in">
            <span className="text-primary-400">Order</span> <span className="text-secondary-400">Peptides</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-200 max-w-3xl mx-auto font-medium leading-relaxed drop-shadow-sm px-4">
            Premium quality peptides for your wellness journey
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="container mx-auto px-4 pb-6">
          <div className="max-w-7xl mx-auto flex justify-center gap-3">
            <button
              onClick={() => setFilter('all')}
              className={`px-6 py-2 rounded-full font-semibold transition-all ${
                filter === 'all'
                  ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
                  : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 border border-gray-700'
              }`}
            >
              All Products
            </button>
            <button
              onClick={() => setFilter('peptides')}
              className={`px-6 py-2 rounded-full font-semibold transition-all ${
                filter === 'peptides'
                  ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
                  : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 border border-gray-700'
              }`}
            >
              Single Vials
            </button>
            <button
              onClick={() => setFilter('packages')}
              className={`px-6 py-2 rounded-full font-semibold transition-all ${
                filter === 'packages'
                  ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
                  : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 border border-gray-700'
              }`}
            >
              Package Deals
            </button>
          </div>
        </div>

        {/* Products Grid */}
        <div className="container mx-auto px-4 pb-12">
          <div className="max-w-7xl mx-auto">
            {productGroups.length === 0 ? (
              <div className="text-center py-16">
                <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-12 shadow-2xl border border-primary-400/30 max-w-2xl mx-auto hover:shadow-primary-400/20 transition-all duration-300">
                  <svg className="w-20 h-20 mx-auto text-primary-400 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <p className="text-2xl text-white font-semibold mb-2">No Products Available</p>
                  <p className="text-gray-300">Please check back later or contact support.</p>
                  <p className="text-sm text-gray-400 mt-4">Products are being added to our catalog</p>
                </div>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {productGroups.map((group) => {
                  // If only one variant, use first variant's selected state, otherwise use group's baseName
                  const groupKey = group.variants.length === 1 ? group.variants[0].id : group.baseName;
                  const selectedVariantId = selectedVariants[groupKey] || group.variants[0].id;
                  const selectedProduct = group.variants.find(v => v.id === selectedVariantId) || group.variants[0];
                  const primary = selectedProduct.prices.find(x => x.isPrimary) || selectedProduct.prices[0];
                  const isLoading = checkoutLoading === selectedProduct.id;
                  const hasVariants = group.variants.length > 1;

                  return (
                    <div key={groupKey} className="group">
                      <div
                        onClick={() => router.push(`/product/${selectedProduct.slug}`)}
                        className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl shadow-2xl border border-primary-400/30 overflow-hidden hover:shadow-primary-400/20 group-hover:scale-[1.02] transition-all duration-300 cursor-pointer"
                      >
                        {/* Product Image */}
                        {group.imageUrl && (
                          <div className="relative h-48 bg-gradient-to-br from-primary-900/30 to-secondary-900/30">
                            <img
                              src={group.imageUrl}
                              alt={group.baseName}
                              className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 to-transparent"></div>
                          </div>
                        )}

                        {/* Product Content */}
                        <div className="p-6">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xl font-bold text-white group-hover:text-primary-400 transition-colors">
                              {group.baseName}
                            </h3>

                            {/* Stock Badge */}
                            {(() => {
                              const stockStatus = getStockStatus(selectedProduct);
                              if (stockStatus === 'no_tracking') return null;

                              const badges = {
                                in_stock: {
                                  text: 'In Stock',
                                  className: 'bg-green-500/20 text-green-400 border-green-400/30'
                                },
                                low_stock: {
                                  text: `Only ${selectedProduct.quantityAvailable} left`,
                                  className: 'bg-yellow-500/20 text-yellow-400 border-yellow-400/30 animate-pulse'
                                },
                                out_of_stock: {
                                  text: 'Out of Stock',
                                  className: 'bg-red-500/20 text-red-400 border-red-400/30'
                                }
                              };

                              const badge = badges[stockStatus];
                              return (
                                <span className={`text-xs px-2 py-1 rounded-full border font-medium ${badge.className}`}>
                                  {badge.text}
                                </span>
                              );
                            })()}
                          </div>

                          {group.description && (
                            <p className="text-gray-300 text-sm mb-2 line-clamp-3">
                              {group.description}
                            </p>
                          )}

                          <p className="text-primary-400 text-sm font-medium mb-4 group-hover:text-primary-300 transition-colors">
                            View Details →
                          </p>

                          {/* Variant Selector - Only show if multiple variants */}
                          {hasVariants && (
                            <div className="mb-4" onClick={(e) => e.stopPropagation()}>
                              <label className="block text-sm font-medium text-gray-300 mb-2">
                                Size:
                              </label>
                              <div className="flex flex-wrap gap-2">
                                {group.variants.map((variant) => {
                                  const variantPrice = variant.prices.find(x => x.isPrimary) || variant.prices[0];
                                  const isSelected = selectedProduct.id === variant.id;

                                  return (
                                    <button
                                      key={variant.id}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedVariants({
                                          ...selectedVariants,
                                          [groupKey]: variant.id
                                        });
                                      }}
                                      className={`flex-1 min-w-[120px] px-4 py-2 rounded-lg border-2 transition-all duration-200 ${
                                        isSelected
                                          ? 'bg-primary-500/30 border-primary-400 text-white shadow-[0_0_12px_rgba(63,191,181,0.4)]'
                                          : 'bg-gray-700/30 border-gray-600 text-gray-300 hover:border-primary-400/50 hover:bg-gray-700/50'
                                      }`}
                                    >
                                      <div className="text-sm font-semibold">
                                        {variant.variantLabel || variant.name}
                                      </div>
                                      {variantPrice && (
                                        <div className="text-xs mt-1">
                                          ${(variantPrice.unitAmount / 100).toFixed(2)}
                                        </div>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {primary ? (
                            <>
                              {/* Price with glow effect */}
                              <div className="mb-4">
                                <p className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-secondary-400">
                                  {(primary.unitAmount / 100).toLocaleString(undefined, {
                                    style: 'currency',
                                    currency: primary.currency.toUpperCase()
                                  })}
                                  {primary.interval && (
                                    <span className="text-sm font-normal text-gray-400 ml-1">
                                      / {primary.interval}
                                    </span>
                                  )}
                                </p>
                              </div>

                              {/* Buy Button or Waitlist Button */}
                              {canPurchase(selectedProduct) ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation(); // Prevent card click
                                    handleCheckout(selectedProduct.id, primary.id);
                                  }}
                                  disabled={isLoading}
                                  className="w-full bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:shadow-primary-500/30 transition-all duration-200 flex items-center justify-center group backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed relative z-10"
                                >
                                  <span>{isLoading ? 'Processing...' : 'Buy Now'}</span>
                                  {!isLoading && (
                                    <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                    </svg>
                                  )}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // TODO: Open waitlist modal
                                    alert('Waitlist feature coming soon! We will notify you when this item is back in stock.');
                                  }}
                                  className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:shadow-blue-500/30 transition-all duration-200 flex items-center justify-center group backdrop-blur-sm relative z-10"
                                >
                                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                  </svg>
                                  <span>Join Waitlist</span>
                                </button>
                              )}
                            </>
                          ) : (
                            <div className="bg-red-500/20 border border-red-400/30 rounded-lg p-3 backdrop-blur-sm">
                              <p className="text-red-400 text-sm font-medium">No price configured</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
