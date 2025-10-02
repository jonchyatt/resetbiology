'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { DosageCalculator } from '@/components/Peptides/DosageCalculator';
interface Peptide {
  id: string;
  slug: string;
  name: string;
  dosage?: string;
  price: number;
  originalUrl?: string;
  category: string;
  subcategory?: string;
  inStock: boolean;
  featured: boolean;
  researchProtocols?: any;
  keyBenefits?: any;
  researchDosage?: any;
  storage?: string;
  reconstitution?: string;
}

export default function PeptideDetailPage() {
  const { slug } = useParams();
  const [peptide, setPeptide] = useState<Peptide | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCalculator, setShowCalculator] = useState(false);

  useEffect(() => {
    if (slug) {
      // Fetch peptide from database
      async function fetchPeptide() {
        try {
          const response = await fetch(`/api/peptides/${slug}`);
          if (response.ok) {
            const data = await response.json();
            setPeptide(data.peptide);
          } else {
            setPeptide(null);
          }
        } catch (error) {
          console.error('Failed to fetch peptide:', error);
          setPeptide(null);
        } finally {
          setLoading(false);
        }
      }
      
      fetchPeptide();
    }
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!peptide) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-3xl font-bold mb-4">Peptide Not Found</h1>
          <p className="text-gray-300 mb-6">The peptide you're looking for doesn't exist.</p>
          <Link href="/order" className="btn-primary">
            Back to Order Page
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative py-20"
         style={{
           backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
           backgroundSize: 'cover',
           backgroundPosition: 'center',
           backgroundAttachment: 'fixed'
         }}>
      <div className="container mx-auto px-4 relative z-10">
        {/* Back Button */}
        <div className="mb-6">
          <Link href="/order" className="text-primary-400 hover:text-primary-300 transition-colors">
            ← Back to All Peptides
          </Link>
        </div>

        {/* Header */}
        <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-8 mb-8 shadow-2xl border border-primary-400/30">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Product Image */}
            <div className="h-64 bg-gradient-to-br from-primary-600/20 to-secondary-600/20 rounded-lg flex items-center justify-center backdrop-blur-sm border border-primary-400/30">
              {peptide.featured && (
                <span className="absolute top-4 right-4 bg-yellow-400/30 text-yellow-200 px-3 py-1 rounded-full text-sm font-semibold shadow-lg backdrop-blur-sm border border-yellow-400/30">
                  Featured
                </span>
              )}
              {/* {peptide.vialSize && (
                <span className="absolute top-4 left-4 bg-primary-600/20 text-primary-200 px-3 py-1 rounded-full text-sm shadow-lg backdrop-blur-sm border border-primary-400/30">
                  {peptide.vialSize}
                </span>
              )} */}
              <div className="text-center">
                <h1 className="text-3xl font-bold text-white mb-2">{peptide.name}</h1>
                <p className="text-gray-300">{peptide.category}</p>
              </div>
            </div>

            {/* Product Info */}
            <div className="space-y-6">
              {/* Price */}
              <div className="bg-black/20 backdrop-blur-sm rounded-lg p-6 border border-primary-400/30">
                <div className="flex justify-between items-baseline mb-4">
                  <span className="text-4xl font-bold text-white">
                    ${peptide.price}
                  </span>
                  {/* {peptide.partnerPrice > 0 && (
                    <span className="text-sm text-gray-400 line-through">
                      ${(peptide.partnerPrice * 2).toFixed(2)}
                    </span>
                  )} */}
                </div>
                {/* {peptide.subscriptionPrice && (
                  <div className="text-sm text-green-400 mb-4">
                    Subscribe & Save: ${peptide.subscriptionPrice}/mo
                  </div>
                )} */}
                <div className="space-y-2">
                  <button className="w-full bg-gradient-to-r from-primary-500 to-secondary-500 text-white py-3 px-6 rounded-lg hover:from-primary-600 hover:to-secondary-600 transition-all font-medium shadow-lg hover:shadow-primary-400/30 hover:scale-105 duration-300">
                    Add to Cart
                  </button>
                  <button 
                    onClick={() => setShowCalculator(true)}
                    className="w-full border border-primary-400/30 text-primary-200 py-3 px-6 rounded-lg hover:bg-primary-600/20 hover:border-primary-400/30 transition-all backdrop-blur-sm"
                  >
                    Calculate Dosage
                  </button>
                </div>
              </div>

              {/* Benefits */}
              {peptide.keyBenefits && Array.isArray(peptide.keyBenefits) && (peptide.keyBenefits as any[]).length > 0 && (
                <div className="bg-black/20 backdrop-blur-sm rounded-lg p-4 border border-primary-400/30">
                  <h3 className="font-semibold text-white mb-2">Key Benefits:</h3>
                  <div className="flex flex-wrap gap-2">
                    {(peptide.keyBenefits as any[]).map((benefit: any, idx: number) => (
                      <span key={idx} className="text-xs bg-primary-600/20 text-primary-200 px-3 py-1 rounded-full backdrop-blur-sm border border-primary-400/30">
                        {benefit}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Stock Status */}
              <div className="text-center">
                <span className={`inline-block px-4 py-2 rounded-full text-sm font-medium ${
                  peptide.inStock 
                    ? 'bg-green-600/20 text-green-200 border border-green-400/30' 
                    : 'bg-red-600/20 text-red-200 border border-red-400/30'
                }`}>
                  {peptide.inStock ? 'In Stock' : 'Out of Stock'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Protocol Instructions */}
        {/* {peptide.protocolInstructions && Object.keys(peptide.protocolInstructions).length > 0 && (
          <div className="bg-gradient-to-br from-blue-600/20 to-primary-600/20 backdrop-blur-sm rounded-xl p-6 mb-8 shadow-2xl border border-blue-400/30">
            <h2 className="text-2xl font-bold text-blue-300 mb-4">Protocol Instructions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {peptide.protocolInstructions.protocolLength && (
                <div className="bg-black/20 backdrop-blur-sm rounded-lg p-4 border border-blue-400/30">
                  <h3 className="font-semibold text-blue-200 mb-2">Protocol Length</h3>
                  <p className="text-white">{peptide.protocolInstructions.protocolLength}</p>
                </div>
              )}
              {peptide.protocolInstructions.dosage && peptide.protocolInstructions.dosage !== 'Add To Cart' && (
                <div className="bg-black/20 backdrop-blur-sm rounded-lg p-4 border border-blue-400/30">
                  <h3 className="font-semibold text-blue-200 mb-2">Dosage</h3>
                  <p className="text-white">{peptide.protocolInstructions.dosage}</p>
                </div>
              )}
              {peptide.protocolInstructions.timing && (
                <div className="bg-black/20 backdrop-blur-sm rounded-lg p-4 border border-blue-400/30">
                  <h3 className="font-semibold text-blue-200 mb-2">Timing</h3>
                  <p className="text-white">{peptide.protocolInstructions.timing}</p>
                </div>
              )}
              {peptide.protocolInstructions.reconstitution && peptide.protocolInstructions.reconstitution !== 'Syringes' && (
                <div className="bg-black/20 backdrop-blur-sm rounded-lg p-4 border border-blue-400/30">
                  <h3 className="font-semibold text-blue-200 mb-2">Reconstitution</h3>
                  <p className="text-white">{peptide.protocolInstructions.reconstitution}</p>
                </div>
              )}
            </div>
          </div>
        )} */}

        {/* Educational Content */}
        {/* {peptide.educationalContent && peptide.educationalContent.trim() && (
          <div className="bg-gradient-to-br from-purple-600/20 to-primary-600/20 backdrop-blur-sm rounded-xl p-6 mb-8 shadow-2xl border border-purple-400/30">
            <h2 className="text-2xl font-bold text-purple-300 mb-4">Educational Information</h2>
            <div className="bg-black/20 backdrop-blur-sm rounded-lg p-6 border border-purple-400/30">
              <div className="text-white whitespace-pre-wrap leading-relaxed">
                {peptide.educationalContent}
              </div>
            </div>
          </div>
        )} */}

        {/* Source Information */}
        <div className="bg-gradient-to-br from-gray-600/20 to-gray-700/20 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-gray-400/30">
          <h2 className="text-xl font-bold text-gray-300 mb-4">Product Information</h2>
          <div className="space-y-2 text-gray-300">
            <p><strong>Product ID:</strong> {peptide.id}</p>
            <p><strong>Category:</strong> {peptide.category}</p>
            {peptide.originalUrl && (
              <p>
                <strong>Source:</strong> 
                <a href={peptide.originalUrl} target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:text-primary-300 ml-2">
                  View Original Product →
                </a>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Dosage Calculator Modal */}
      {showCalculator && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">Dosage Calculator</h2>
              <button onClick={() => setShowCalculator(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <DosageCalculator 
              importedPeptide={{
                id: peptide.id,
                name: peptide.name,
                vialSize: 5,
                recommendedDose: 250
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}