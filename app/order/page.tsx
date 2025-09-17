'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import peptideData from '@/data/peptides.json';

interface Peptide {
  id: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string;
  category: string;
  partnerPrice: number;
  retailPrice: number;
  subscriptionPrice: number;
  vialSize: string;
  inStock: boolean;
  featured: boolean;
  protocolInstructions: any;
  educationalContent: string;
  sourceUrl: string;
  benefits: string[];
  usage: string;
}

export default function OrderPage() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [priceFilter, setPriceFilter] = useState('all');
  const [sortBy, setSortBy] = useState('featured');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Use local data directly
  const peptides = peptideData.peptides as Peptide[];
  
  console.log('Total peptides loaded:', peptides.length);
  
  // Filter and sort peptides
  const filteredPeptides = peptides.filter(peptide => {
    // Category filter
    if (selectedCategory !== 'all') {
      if (selectedCategory === 'packages' && !peptide.name.includes('Package')) return false;
      if (selectedCategory === 'single' && peptide.name.includes('Package')) return false;
    }
    
    // Price filter
    if (priceFilter === 'under100' && peptide.retailPrice >= 100) return false;
    if (priceFilter === '100to500' && (peptide.retailPrice < 100 || peptide.retailPrice > 500)) return false;
    if (priceFilter === 'over500' && peptide.retailPrice <= 500) return false;
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return peptide.name.toLowerCase().includes(query) || 
             peptide.description.toLowerCase().includes(query);
    }
    
    return true;
  });
  
  // Sort
  const sortedPeptides = [...filteredPeptides].sort((a, b) => {
    if (sortBy === 'featured') return b.featured ? 1 : -1;
    if (sortBy === 'price-low') return a.retailPrice - b.retailPrice;
    if (sortBy === 'price-high') return b.retailPrice - a.retailPrice;
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return 0;
  });

  console.log('Filtered peptides:', filteredPeptides.length);
  console.log('Sorted peptides:', sortedPeptides.length);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative py-20"
         style={{
           backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
           backgroundSize: 'cover',
           backgroundPosition: 'center',
           backgroundAttachment: 'fixed'
         }}>
      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary-400 to-secondary-400 bg-clip-text text-transparent drop-shadow-lg">
            Premium Peptides
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Research-grade peptides sourced from certified laboratories. 
            All products include detailed protocols and educational materials.
          </p>
          <div className="mt-6 text-sm text-gray-400">
            {peptides.length} products available • Prices shown with 50% markup • 15% discount on subscriptions
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 mb-8 shadow-2xl border border-primary-400/30 hover:shadow-primary-400/20 transition-all duration-300">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">Search</label>
              <input
                type="text"
                placeholder="Search peptides..."
                className="w-full px-4 py-2 bg-black/30 backdrop-blur-sm border border-primary-400/30 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-white placeholder-gray-400"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">Category</label>
              <select
                className="w-full px-4 py-2 bg-black/30 backdrop-blur-sm border border-primary-400/30 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-white [&>option]:bg-gray-800 [&>option]:text-white"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="all">All Products</option>
                <option value="packages">Protocol Packages</option>
                <option value="single">Single Vials</option>
              </select>
            </div>
            
            {/* Price Range */}
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">Price Range</label>
              <select
                className="w-full px-4 py-2 bg-black/30 backdrop-blur-sm border border-primary-400/30 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-white [&>option]:bg-gray-800 [&>option]:text-white"
                value={priceFilter}
                onChange={(e) => setPriceFilter(e.target.value)}
              >
                <option value="all">All Prices</option>
                <option value="under100">Under $100</option>
                <option value="100to500">$100 - $500</option>
                <option value="over500">Over $500</option>
              </select>
            </div>
            
            {/* Sort */}
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">Sort By</label>
              <select
                className="w-full px-4 py-2 bg-black/30 backdrop-blur-sm border border-primary-400/30 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-white [&>option]:bg-gray-800 [&>option]:text-white"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="featured">Featured</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="name">Name: A-Z</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results count */}
        <div className="mb-6 text-gray-300">
          Showing {sortedPeptides.length} of {peptides.length} products
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedPeptides.map((peptide) => (
            <div key={peptide.id} className="group bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl overflow-hidden shadow-2xl border border-primary-400/30 hover:shadow-primary-400/20 transition-all duration-300 hover:scale-105 hover:border-primary-400/30">
              {/* Product Image */}
              <div className="h-48 bg-gradient-to-br from-primary-600/20 to-secondary-600/20 relative backdrop-blur-sm group-hover:from-primary-600/30 group-hover:to-secondary-600/30 transition-all duration-300">
                {peptide.featured && (
                  <span className="absolute top-2 right-2 bg-yellow-400/30 text-yellow-200 px-3 py-1 rounded-full text-sm font-semibold shadow-lg backdrop-blur-sm border border-yellow-400/30">
                    Featured
                  </span>
                )}
                {peptide.vialSize && (
                  <span className="absolute top-2 left-2 bg-primary-600/20 text-primary-200 px-3 py-1 rounded-full text-sm shadow-lg backdrop-blur-sm border border-primary-400/30">
                    {peptide.vialSize}
                  </span>
                )}
                <div className="flex items-center justify-center h-full">
                  <div className="text-center p-4">
                    <h3 className="text-xl font-bold text-white drop-shadow-lg">{peptide.name}</h3>
                  </div>
                </div>
              </div>
              
              {/* Product Info */}
              <div className="p-6">
                {/* Price */}
                <div className="mb-4">
                  <div className="flex justify-between items-baseline">
                    <span className="text-3xl font-bold text-white">
                      ${peptide.retailPrice}
                    </span>
                    {peptide.partnerPrice > 0 && (
                      <span className="text-sm text-gray-400 line-through">
                        ${(peptide.partnerPrice * 2).toFixed(2)}
                      </span>
                    )}
                  </div>
                  {peptide.subscriptionPrice && (
                    <div className="text-sm text-green-400 mt-1">
                      Subscribe & Save: ${peptide.subscriptionPrice}/mo
                    </div>
                  )}
                </div>
                
                {/* Protocol Info */}
                {peptide.protocolInstructions && Object.keys(peptide.protocolInstructions).length > 0 && (
                  <div className="mb-4 p-3 bg-black/20 backdrop-blur-sm rounded-lg border border-primary-400/20">
                    <div className="text-xs font-semibold text-gray-300 mb-1">Protocol Info:</div>
                    {peptide.protocolInstructions.protocolLength && (
                      <div className="text-xs text-gray-400">
                        Length: {peptide.protocolInstructions.protocolLength}
                      </div>
                    )}
                    {peptide.protocolInstructions.dosage && (
                      <div className="text-xs text-gray-400 truncate">
                        Dosage: {peptide.protocolInstructions.dosage.substring(0, 50)}...
                      </div>
                    )}
                  </div>
                )}
                
                {/* Benefits */}
                {peptide.benefits && peptide.benefits.length > 0 && (
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-1">
                      {peptide.benefits.slice(0, 2).map((benefit, idx) => (
                        <span key={idx} className="text-xs bg-primary-600/20 text-primary-200 px-2 py-1 rounded backdrop-blur-sm border border-primary-400/30">
                          {benefit}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Actions */}
                <div className="flex gap-2">
                  <button className="flex-1 bg-gradient-to-r from-primary-500 to-secondary-500 text-white py-2 px-4 rounded-lg hover:from-primary-600 hover:to-secondary-600 transition-all font-medium shadow-lg hover:shadow-primary-400/30 hover:scale-105 duration-300">
                    Add to Cart
                  </button>
                  <Link
                    href={`/peptides/${peptide.slug}`}
                    className="px-4 py-2 border border-primary-400/30 text-primary-200 rounded-lg hover:bg-primary-600/20 hover:border-primary-400/30 transition-all backdrop-blur-sm hover:shadow-primary-400/20 duration-300"
                  >
                    Info
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {sortedPeptides.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">No products found matching your criteria.</p>
          </div>
        )}
        
        {/* Footer Info */}
        <div className="mt-12 p-6 bg-gradient-to-br from-blue-600/20 to-primary-600/20 backdrop-blur-sm rounded-xl shadow-2xl border border-blue-400/30 hover:shadow-blue-400/20 transition-all duration-300">
          <h3 className="font-semibold text-blue-300 mb-2">Important Information</h3>
          <ul className="text-sm text-blue-200 space-y-1">
            <li>• All peptides are for research purposes only</li>
            <li>• Prices include 50% markup from wholesale</li>
            <li>• Subscribe for 15% discount on all orders</li>
            <li>• Protocol instructions included with each order</li>
            <li>• Data sourced from cellularpeptide.com</li>
          </ul>
        </div>
      </div>
    </div>
  );
}