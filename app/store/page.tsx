import { prisma } from '@/lib/prisma';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getPeptides() {
  return prisma.peptide.findMany({
    where: { inStock: true },
    orderBy: [
      { featured: 'desc' },
      { category: 'asc' },
      { name: 'asc' }
    ]
  });
}

function PeptideCard({ peptide }: { peptide: any }) {
  return (
    <div 
      className="backdrop-blur-sm rounded-lg p-4 shadow-lg border border-gray-200/30 hover:shadow-xl transition-all duration-300"
      style={{ backgroundColor: '#A5F0E0' }}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-1">
            {peptide.name}
          </h3>
          {peptide.dosage && (
            <p className="text-sm text-gray-600">{peptide.dosage}</p>
          )}
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-gray-800">
            ${peptide.price}
          </div>
        </div>
      </div>
      
      <div className="space-y-2 mb-4">
        {peptide.researchApplications && Array.isArray(peptide.researchApplications) && (peptide.researchApplications as string[]).slice(0, 2).map((app: string, idx: number) => (
          <div key={idx} className="flex items-center text-sm text-gray-700">
            <span className="text-green-600 mr-2">✓</span>
            {app}
          </div>
        ))}
        {peptide.researchApplications && !Array.isArray(peptide.researchApplications) && (
          <div className="flex items-center text-sm text-gray-700">
            <span className="text-green-600 mr-2">✓</span>
            Research applications available
          </div>
        )}
      </div>
      
      <Link 
        href={`/store/${peptide.slug}`}
        className="block w-full bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white text-center px-4 py-2 rounded-lg font-medium transition-all duration-200"
      >
        Learn More
      </Link>
    </div>
  );
}

function PackageCard({ title, originalPrice, price, period, features, isPopular, expectedResults }: {
  title: string;
  originalPrice: number;
  price: number;
  period: string;
  features: string[];
  isPopular?: boolean;
  expectedResults: string[];
}) {
  return (
    <div className="relative">
      {isPopular && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-teal-600 to-green-600 text-white px-4 py-1 rounded-full text-sm font-medium">
          Most Popular
        </div>
      )}
      <div 
        className="backdrop-blur-sm rounded-xl p-6 shadow-xl border border-gray-200/30 h-full"
        style={{ backgroundColor: '#A5F0E0' }}
      >
        <div className="text-center mb-6">
          <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
          <div className="mb-2">
            <span className="text-gray-500 line-through text-lg">${originalPrice}</span>
            <span className="text-3xl font-bold text-gray-800 ml-2">${price}</span>
          </div>
          <p className="text-gray-600">{period}</p>
          <p className="text-sm text-gray-500">${(price / (period === '30 days' ? 30 : period === '60 days' ? 60 : 90)).toFixed(0)}/day</p>
        </div>
        
        <div className="space-y-3 mb-6">
          {features.map((feature, idx) => (
            <div key={idx} className="flex items-center text-sm text-gray-700">
              <span className="text-green-600 mr-3">✓</span>
              {feature}
            </div>
          ))}
        </div>
        
        <div className="bg-amber-50/80 rounded-lg p-4 mb-6">
          <h4 className="font-semibold text-amber-800 mb-2">Expected Results:</h4>
          <div className="space-y-1">
            {expectedResults.map((result, idx) => (
              <div key={idx} className="flex items-center text-sm text-amber-700">
                <span className="text-amber-600 mr-2">•</span>
                {result}
              </div>
            ))}
          </div>
        </div>
        
        <button className="w-full bg-gradient-to-r from-teal-600 to-green-600 hover:from-teal-700 hover:to-green-700 text-white py-3 px-6 rounded-lg font-semibold transition-all duration-200 shadow-lg">
          Get Started
        </button>
      </div>
    </div>
  );
}

export default async function StorePage() {
  const peptides = await getPeptides();

  const packages = [
    {
      title: "Foundation Protocol",
      originalPrice: 350,
      price: 297,
      period: "30 days",
      features: [
        "Physician consultation & protocol design",
        "2-3 research peptides selection",
        "Weekly progress monitoring",
        "Basic nutrition guidance",
        "Email support"
      ],
      expectedResults: [
        "Initial metabolic improvement",
        "Better sleep quality",
        "Increased energy levels"
      ]
    },
    {
      title: "Complete Optimization",
      originalPrice: 750,
      price: 597,
      period: "60 days",
      isPopular: true,
      features: [
        "Advanced physician protocol",
        "4-5 research peptides combination",
        "Bi-weekly detailed consultations",
        "Complete nutrition & exercise plan",
        "Priority phone & email support",
        "Progress tracking dashboard"
      ],
      expectedResults: [
        "Significant fat loss (10-15%)",
        "Muscle preservation & growth",
        "Enhanced cognitive function",
        "Improved recovery times"
      ]
    },
    {
      title: "Elite Performance",
      originalPrice: 1200,
      price: 897,
      period: "90 days",
      features: [
        "Premium concierge service",
        "Full peptide protocol (6+ peptides)",
        "Weekly 1-on-1 consultations",
        "Personalized meal & workout plans",
        "24/7 medical support",
        "Advanced biomarker testing",
        "Success guarantee"
      ],
      expectedResults: [
        "Complete body transformation",
        "Optimal hormone optimization",
        "Peak physical performance",
        "Long-term metabolic reset"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-slate-900 relative"
         style={{
           backgroundImage: `linear-gradient(rgba(15,23,42,0.9), rgba(15,23,42,0.9)), url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%234FFFB8' fill-opacity='0.03'%3E%3Ccircle cx='20' cy='20' r='1.5'/%3E%3Ccircle cx='40' cy='40' r='2'/%3E%3Ccircle cx='60' cy='20' r='1'/%3E%3Ccircle cx='20' cy='60' r='1'/%3E%3Ccircle cx='60' cy='60' r='1.5'/%3E%3Cpath d='M20 10c0 5.523 4.477 10 10 10s10-4.477 10-10M20 70c0-5.523 4.477-10 10-10s10 4.477 10 10M70 40c-5.523 0-10 4.477-10 10s4.477 10 10 10M10 40c5.523 0 10-4.477 10-10s-4.477-10-10-10' stroke='%234FFFB8' stroke-width='0.5' fill='none'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
           backgroundSize: '80px 80px',
           backgroundPosition: 'center'
         }}>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12 pt-24">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
            <span className="text-primary-400">Premium</span> Peptide Protocols
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed mb-8">
            Physician-supervised peptide therapy with comprehensive support and tracking
          </p>
          
          {/* Trust Badges */}
          <div className="flex justify-center items-center space-x-8 text-sm text-gray-400 mb-8">
            <div className="flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              FDA Regulated Facility
            </div>
            <div className="flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              99.8% Purity Guaranteed
            </div>
            <div className="flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              Cold-Chain Shipping
            </div>
          </div>
        </div>

        {/* Package Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {packages.map((pkg, idx) => (
            <PackageCard key={idx} {...pkg} />
          ))}
        </div>

        {/* Individual Peptides Section */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-white text-center mb-8">
            Individual Research Peptides
          </h2>
          <p className="text-gray-300 text-center mb-8 max-w-2xl mx-auto">
            High-quality research peptides for laboratory use. Each peptide includes detailed research documentation and proper handling instructions.
          </p>
          
          <div className="grid md:grid-cols-4 gap-6">
            {peptides.slice(0, 12).map((peptide) => (
              <PeptideCard key={peptide.id} peptide={peptide} />
            ))}
          </div>
          
          {peptides.length > 12 && (
            <div className="text-center mt-8">
              <Link 
                href="/peptides"
                className="bg-gradient-to-r from-teal-600 to-green-600 hover:from-teal-700 hover:to-green-700 text-white px-8 py-3 rounded-lg font-semibold transition-all duration-200"
              >
                View All {peptides.length} Peptides
              </Link>
            </div>
          )}
        </div>

        {/* Subscribe Toggle */}
        <div className="text-center mb-12">
          <div 
            className="backdrop-blur-sm rounded-xl p-6 max-w-md mx-auto border border-gray-200/30"
            style={{ backgroundColor: '#A5F0E0' }}
          >
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Subscription Options</h3>
            <div className="flex items-center justify-center space-x-4">
              <span className="text-gray-600">One-time</span>
              <div className="relative">
                <input type="checkbox" className="sr-only" id="subscribe-toggle" />
                <label htmlFor="subscribe-toggle" className="block bg-gray-300 w-12 h-6 rounded-full cursor-pointer"></label>
              </div>
              <span className="text-gray-800 font-medium">Subscribe & Save 15%</span>
            </div>
            <p className="text-sm text-gray-600 mt-2">Free shipping on all subscription orders</p>
          </div>
        </div>

        {/* Quality Assurance */}
        <div 
          className="backdrop-blur-sm rounded-xl p-8 border border-gray-200/30 mb-8"
          style={{ backgroundColor: '#A5F0E0' }}
        >
          <h3 className="text-2xl font-bold text-gray-800 text-center mb-6">Quality Assurance</h3>
          <div className="grid md:grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-lg font-semibold text-gray-800 mb-2">🔬 Third-Party Tested</div>
              <p className="text-gray-600 text-sm">HPLC and mass spectrometry verified purity and identity</p>
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-800 mb-2">🏭 cGMP Manufacturing</div>
              <p className="text-gray-600 text-sm">Current Good Manufacturing Practice standards</p>
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-800 mb-2">🛡️ Research Grade</div>
              <p className="text-gray-600 text-sm">For laboratory research use only</p>
            </div>
          </div>
        </div>

        {/* Legal Disclaimer */}
        <div className="bg-red-500/20 border border-red-400 rounded-xl p-6 backdrop-blur-sm">
          <p className="text-sm text-red-300 text-center">
            <strong>Important:</strong> All peptides are for research purposes only. 
            Not for human consumption, clinical, diagnostic, or therapeutic use. 
            Please ensure compliance with all applicable laws and regulations.
          </p>
        </div>
      </div>
    </div>
  );
}