import { prisma } from '@/lib/prisma';
import Image from 'next/image';

export const dynamic = 'force-dynamic';

async function getProducts() {
  return prisma.product.findMany({
    where: { active: true, storefront: true },
    include: { prices: { where: { active: true }, orderBy: { unitAmount: 'asc' } } },
    orderBy: { name: 'asc' },
  });
}

export default async function OrderPage() {
  const products = await getProducts();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-primary-900/20 to-gray-900">
      {/* Background pattern overlay */}
      <div className="fixed inset-0 bg-[url('/grid.svg')] bg-center opacity-5"></div>
      
      {/* Content */}
      <div className="relative z-10 pt-24 pb-12 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-white mb-4 animate-fade-in">
              Order Peptides
            </h1>
            <p className="text-xl text-gray-300">
              Premium quality peptides for your wellness journey
            </p>
          </div>

          {products.length === 0 ? (
            <div className="text-center py-16">
              <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-12 shadow-2xl border border-primary-400/30 max-w-2xl mx-auto">
                <svg className="w-20 h-20 mx-auto text-gray-400 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <p className="text-xl text-gray-300">No products available at this time.</p>
                <p className="text-gray-400 mt-2">Please check back later or contact support.</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => {
                const primary = p.prices.find(x => x.isPrimary) || p.prices[0];
                return (
                  <form
                    key={p.id}
                    action="/api/checkout"
                    method="post"
                    className="group bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl shadow-2xl border border-primary-400/30 overflow-hidden hover:scale-[1.02] hover:shadow-primary-400/20 transition-all duration-300"
                  >
                    {/* Product Image */}
                    {p.imageUrl && (
                      <div className="relative h-48 bg-gradient-to-br from-primary-900/30 to-secondary-900/30">
                        <img 
                          src={p.imageUrl} 
                          alt={p.name} 
                          className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 to-transparent"></div>
                      </div>
                    )}
                    
                    {/* Product Content */}
                    <div className="p-6">
                      <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-primary-400 transition-colors">
                        {p.name}
                      </h3>
                      
                      {p.description && (
                        <p className="text-gray-300 text-sm mb-4 line-clamp-3">
                          {p.description}
                        </p>
                      )}
                      
                      {primary ? (
                        <>
                          <input type="hidden" name="productId" value={p.id} />
                          <input type="hidden" name="priceId" value={primary.id} />
                          
                          {/* Price */}
                          <div className="mb-4">
                            <p className="text-2xl font-bold text-primary-400">
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
                          
                          {/* Buy Button */}
                          <button 
                            type="submit" 
                            className="w-full py-3 px-6 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-primary-500/30 transition-all duration-200 flex items-center justify-center group"
                          >
                            <span>Buy Now</span>
                            <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                          </button>
                        </>
                      ) : (
                        <div className="bg-red-500/20 border border-red-400/30 rounded-lg p-3">
                          <p className="text-red-400 text-sm">No price configured</p>
                        </div>
                      )}
                    </div>
                  </form>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}