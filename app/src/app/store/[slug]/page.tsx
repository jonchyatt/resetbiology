import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getPeptide(slug: string) {
  return prisma.peptide.findUnique({
    where: { slug },
    include: {
      educationContent: {
        where: { isPublished: true },
        orderBy: { displayOrder: 'asc' }
      }
    }
  });
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PeptidePage({ params }: PageProps) {
  const { slug } = await params;
  const peptide = await getPeptide(slug);
  
  if (!peptide) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative"
         style={{
           backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
           backgroundSize: 'cover',
           backgroundPosition: 'center',
           backgroundAttachment: 'fixed'
         }}>
      <div className="relative z-10">
        <div className="container mx-auto px-4 py-8">
          {/* Breadcrumb */}
          <nav className="flex items-center space-x-2 text-sm text-gray-300 mb-8 pt-24">
            <Link href="/" className="hover:text-primary-300">Home</Link>
            <span>/</span>
            <Link href="/store" className="hover:text-primary-300">Store</Link>
            <span>/</span>
            <span className="text-white">{peptide.name}</span>
          </nav>

          <div className="grid lg:grid-cols-3 gap-12">
            {/* Main Content */}
            <div className="lg:col-span-2">
              {/* Header */}
              <div className="mb-8">
                <div className="flex items-center gap-4 mb-4">
                  <h1 className="text-4xl md:text-5xl font-bold text-white text-shadow-lg">
                    {peptide.name}
                  </h1>
                  {peptide.featured && (
                    <span className="bg-gradient-to-r from-yellow-400/20 to-orange-400/20 text-yellow-300 border border-yellow-400/30 px-3 py-1 rounded-full text-sm font-medium">
                      ⭐ Featured
                    </span>
                  )}
                </div>
                
                {peptide.dosage && (
                  <p className="text-xl text-gray-200 mb-2">{peptide.dosage}</p>
                )}
                
                <div className="flex flex-wrap gap-3 mb-6">
                  <span className="bg-primary-500/30 text-primary-200 border border-primary-400/50 px-3 py-1 rounded-full text-sm font-medium">
                    {peptide.category}
                  </span>
                  {peptide.purity && (
                    <span className="bg-secondary-500/30 text-secondary-200 border border-secondary-400/50 px-3 py-1 rounded-full text-sm font-medium">
                      {peptide.purity} Purity
                    </span>
                  )}
                  {peptide.casNumber && (
                    <span className="bg-primary-500/30 text-primary-200 border border-primary-400/50 px-3 py-1 rounded-full text-sm font-medium">
                      CAS: {peptide.casNumber}
                    </span>
                  )}
                </div>
              </div>

              {/* Product Details */}
              <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-8 shadow-2xl border border-primary-400/30 mb-8">
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-6 text-shadow-lg">Product Details</h2>
                
                <div className="grid md:grid-cols-2 gap-6">
                  {peptide.type && (
                    <div>
                      <h3 className="font-semibold text-primary-300 mb-2">Type</h3>
                      <p className="text-gray-200">{peptide.type}</p>
                    </div>
                  )}
                  
                  {peptide.classification && (
                    <div>
                      <h3 className="font-semibold text-primary-300 mb-2">Classification</h3>
                      <p className="text-gray-200">{peptide.classification}</p>
                    </div>
                  )}
                  
                  {peptide.molecularFormula && (
                    <div>
                      <h3 className="font-semibold text-primary-300 mb-2">Molecular Formula</h3>
                      <p className="text-gray-200 font-mono">{peptide.molecularFormula}</p>
                    </div>
                  )}
                  
                  {peptide.molecularWeight && (
                    <div>
                      <h3 className="font-semibold text-primary-300 mb-2">Molecular Weight</h3>
                      <p className="text-gray-200">{peptide.molecularWeight}</p>
                    </div>
                  )}
                  
                  {peptide.halfLife && (
                    <div>
                      <h3 className="font-semibold text-primary-300 mb-2">Half-Life</h3>
                      <p className="text-gray-200">{peptide.halfLife}</p>
                    </div>
                  )}
                  
                  {peptide.color && (
                    <div>
                      <h3 className="font-semibold text-primary-300 mb-2">Physical Appearance</h3>
                      <p className="text-gray-200">{peptide.color}</p>
                    </div>
                  )}
                </div>
                
                {peptide.sequence && (
                  <div className="mt-6">
                    <h3 className="font-semibold text-primary-300 mb-2">Peptide Sequence</h3>
                    <p className="text-gray-200 font-mono text-sm bg-gray-800/50 p-3 rounded border border-primary-400/30 break-all">
                      {peptide.sequence}
                    </p>
                  </div>
                )}
              </div>

              {/* Research Applications */}
              {peptide.researchApplications && (peptide.researchApplications as string[]).length > 0 && (
                <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-8 shadow-2xl border border-primary-400/30 mb-8">
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-6 text-shadow-lg">Research Applications</h2>
                  <ul className="space-y-3">
                    {(peptide.researchApplications as string[]).map((app: string, idx: number) => (
                      <li key={idx} className="flex items-start">
                        <span className="w-2 h-2 bg-secondary-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                        <span className="text-gray-200">{app}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Key Benefits */}
              {peptide.keyBenefits && (peptide.keyBenefits as string[]).length > 0 && (
                <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-8 shadow-2xl border border-primary-400/30 mb-8">
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-6 text-shadow-lg">Key Research Benefits</h2>
                  <ul className="space-y-3">
                    {(peptide.keyBenefits as string[]).map((benefit: string, idx: number) => (
                      <li key={idx} className="flex items-start">
                        <span className="w-2 h-2 bg-primary-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                        <span className="text-gray-200">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Storage & Handling */}
              {(peptide.storage || peptide.reconstitution) && (
                <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-8 shadow-2xl border border-primary-400/30 mb-8">
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-6 text-shadow-lg">Storage & Handling</h2>
                  
                  {peptide.storage && (
                    <div className="mb-6">
                      <h3 className="font-semibold text-primary-300 mb-3">Storage Instructions</h3>
                      <p className="text-gray-200">{peptide.storage}</p>
                    </div>
                  )}
                  
                  {peptide.reconstitution && (
                    <div>
                      <h3 className="font-semibold text-primary-300 mb-3">Reconstitution Guidelines</h3>
                      <p className="text-gray-200">{peptide.reconstitution}</p>
                    </div>
                  )}
                  
                  <div className="mt-6 p-4 bg-yellow-500/20 border border-yellow-400 rounded-lg backdrop-blur-sm">
                    <p className="text-sm text-yellow-300">
                      <strong>Important:</strong> Always use sterile bacteriostatic water for reconstitution. 
                      Handle with appropriate laboratory safety equipment.
                    </p>
                  </div>
                </div>
              )}

              {/* Education Content */}
              {peptide.educationContent.length > 0 && (
                <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-8 shadow-2xl border border-primary-400/30">
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-6 text-shadow-lg">Educational Resources</h2>
                  <div className="space-y-6">
                    {peptide.educationContent.map((content) => (
                      <div key={content.id} className="border-b border-primary-400/30 pb-6 last:border-b-0 last:pb-0">
                        <h3 className="text-xl font-semibold text-white mb-3">{content.title}</h3>
                        <div className="prose max-w-none text-gray-200" dangerouslySetInnerHTML={{ __html: content.content.replace(/\n/g, '<br/>') }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="sticky top-8">
                {/* Price & Purchase */}
                <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-primary-400/30 mb-6">
                  <div className="text-center mb-6">
                    <div className="text-4xl font-bold text-primary-400 mb-2">
                      ${peptide.price}
                    </div>
                    <p className="text-gray-200">Same Elite Biogenix Pricing</p>
                  </div>
                  
                  <div className="space-y-4 mb-6">
                    <div className="flex items-center text-sm text-gray-200">
                      <span className="w-2 h-2 bg-secondary-400 rounded-full mr-3"></span>
                      In Stock & Ready to Ship
                    </div>
                    <div className="flex items-center text-sm text-gray-200">
                      <span className="w-2 h-2 bg-primary-400 rounded-full mr-3"></span>
                      Research Grade Quality
                    </div>
                    <div className="flex items-center text-sm text-gray-200">
                      <span className="w-2 h-2 bg-secondary-400 rounded-full mr-3"></span>
                      Third-Party Tested
                    </div>
                  </div>
                  
                  <a 
                    href={peptide.originalUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-center px-6 py-3 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl mb-3"
                  >
                    Order from Elite Biogenix
                  </a>
                  
                  <p className="text-xs text-gray-300 text-center">
                    You'll be redirected to Elite Biogenix to complete your order
                  </p>
                </div>
                
                {/* Quality Badges */}
                <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-primary-400/30">
                  <h3 className="font-semibold text-white mb-4 text-shadow-sm">Quality Assurance</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center text-sm">
                      <span className="text-secondary-400 mr-3">✓</span>
                      <span className="text-gray-200">HPLC Verified</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <span className="text-secondary-400 mr-3">✓</span>
                      <span className="text-gray-200">Mass Spec Confirmed</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <span className="text-secondary-400 mr-3">✓</span>
                      <span className="text-gray-200">cGMP Manufacturing</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <span className="text-secondary-400 mr-3">✓</span>
                      <span className="text-gray-200">Sterile & Endotoxin-Free</span>
                    </div>
                  </div>
                  
                  <div className="mt-6 p-3 bg-red-500/20 border border-red-400 rounded backdrop-blur-sm">
                    <p className="text-xs text-red-300">
                      <strong>Research Use Only:</strong> Not for human consumption, 
                      clinical, diagnostic, or therapeutic use.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}