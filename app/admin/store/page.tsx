export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// app/admin/store/page.tsx
import { auth0 } from '@/lib/auth0';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Package, Plus, Upload, DollarSign, ImageIcon } from 'lucide-react';
import { listProducts, createProduct, updateProduct, archiveProduct, upsertPrice, deletePrice, syncProductToStripe, importPeptides, fixProductImages } from './actions';
import { ImportButton } from './ImportButton';
export const revalidate = 0;

export default async function AdminStorePage() {
  // Inline admin check for debugging
  try {
    const session = await auth0.getSession();
    
    if (!session?.user) {
      console.log('[Admin Store] No session found, redirecting to login');
      redirect('/auth/login?returnTo=/admin/store');
    }
    
    const email = (session.user.email || '').toLowerCase();
    console.log('[Admin Store] Checking admin access for:', email);
    
    const dbUser = email ? await prisma.user.findUnique({ where: { email } }) : null;
    
    if (!dbUser) {
      console.log('[Admin Store] User not found in database:', email);
      redirect('/portal');
    }
    
    const isAdmin = dbUser?.role === 'admin' || dbUser?.accessLevel === 'admin';
    
    if (!isAdmin) {
      console.log('[Admin Store] User is not admin:', { role: dbUser.role, accessLevel: dbUser.accessLevel });
      redirect('/portal');
    }
    
    console.log('[Admin Store] Admin access granted for:', email);
  } catch (error) {
    console.error('[Admin Store] Error checking admin access:', error);
    redirect('/auth/login?returnTo=/admin/store');
  }
  
  const products = await listProducts();

  // ------ server action wrappers (form actions expect FormData) ------
  const createProductAction = async (fd: FormData) => {
    'use server';
    await createProduct({
      name: String(fd.get('name') || '').trim(),
      slug: String(fd.get('slug') || '').trim(),
      description: (fd.get('description')?.toString() || '').trim() || null,
      imageUrl: (fd.get('imageUrl')?.toString() || '').trim() || null,
    });
  };

  const toggleStorefrontAction = async (fd: FormData) => {
    'use server';
    const id = String(fd.get('productId') || '');
    const value = String(fd.get('storefront') || 'false') === 'true';
    await updateProduct(id, { storefront: value });
  };

  const toggleActiveAction = async (fd: FormData) => {
    'use server';
    const id = String(fd.get('productId') || '');
    const value = String(fd.get('active') || 'false') === 'true';
    await updateProduct(id, { active: value });
  };

  const archiveAction = async (fd: FormData) => {
    'use server';
    const id = String(fd.get('productId') || '');
    await archiveProduct(id);
  };

  const syncStripeAction = async (fd: FormData) => {
    'use server';
    const id = String(fd.get('productId') || '');
    await syncProductToStripe(id);
  };

  const upsertPriceAction = async (fd: FormData) => {
    'use server';
    const prodId = String(fd.get('productId') || '');
    const id = fd.get('priceId')?.toString() || undefined;
    const amount = Number(fd.get('amount') || 0);
    const currency = String(fd.get('currency') || 'usd');
    const intervalValue = fd.get('interval')?.toString() || '';
    const interval = intervalValue === 'month' || intervalValue === 'year' ? intervalValue : null;
    const isPrimary = String(fd.get('isPrimary') || 'false') === 'true';
    const unitAmount = amount; // upsertPrice expects unitAmount, not amount
    await upsertPrice(prodId, { id, unitAmount, currency, interval, isPrimary });
  };

  const deletePriceAction = async (fd: FormData) => {
    'use server';
    const priceId = String(fd.get('priceId') || '');
    await deletePrice(priceId);
  };

  const editProductAction = async (fd: FormData) => {
    'use server';
    const id = String(fd.get('productId') || '');
    const name = String(fd.get('name') || '').trim();
    const description = (fd.get('description')?.toString() || '').trim() || null;
    const imageUrl = (fd.get('imageUrl')?.toString() || '').trim() || null;
    
    // Protocol fields
    const isTrackable = String(fd.get('isTrackable') || 'false') === 'true';
    const protocolPurpose = (fd.get('protocolPurpose')?.toString() || '').trim() || null;
    const protocolDosageRange = (fd.get('protocolDosageRange')?.toString() || '').trim() || null;
    const protocolFrequency = (fd.get('protocolFrequency')?.toString() || '').trim() || null;
    const protocolTiming = (fd.get('protocolTiming')?.toString() || '').trim() || null;
    const protocolDuration = (fd.get('protocolDuration')?.toString() || '').trim() || null;
    const vialAmount = (fd.get('vialAmount')?.toString() || '').trim() || null;
    const reconstitutionInstructions = (fd.get('reconstitutionInstructions')?.toString() || '').trim() || null;
    const syringeUnitsValue = fd.get('syringeUnits')?.toString() || '';
    const syringeUnits = syringeUnitsValue ? parseFloat(syringeUnitsValue) : null;
    
    await updateProduct(id, { 
      name, 
      description, 
      imageUrl,
      isTrackable,
      protocolPurpose,
      protocolDosageRange,
      protocolFrequency,
      protocolTiming,
      protocolDuration,
      vialAmount,
      reconstitutionInstructions,
      syringeUnits
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative"
         style={{
           backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
           backgroundSize: 'cover',
           backgroundPosition: 'center',
           backgroundAttachment: 'fixed'
         }}>
      {/* Admin Navigation Bar */}
      <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm shadow-2xl border-b border-primary-400/30 mt-16">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <img
                src="/logo1.png"
                alt="Reset Biology"
                className="h-8 w-auto mr-3 rounded-lg drop-shadow-lg bg-white/10 backdrop-blur-sm p-1 border border-white/20"
              />
              <h1 className="text-xl font-bold text-white drop-shadow-lg">Admin</h1>
              <span className="mx-2 text-primary-300">•</span>
              <span className="text-lg text-gray-200 drop-shadow-sm">Store Management</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/admin" className="text-primary-300 hover:text-primary-200 font-medium text-sm transition-colors drop-shadow-sm">
                Dashboard
              </Link>
              <Link href="/portal" className="text-primary-300 hover:text-primary-200 font-medium text-sm transition-colors drop-shadow-sm">
                Portal
              </Link>
            </div>
          </div>
          <p className="text-gray-300 text-sm mt-1">Manage your products, pricing, and Stripe integration</p>
        </div>
      </div>
      <div className="relative z-10">
        {/* Header */}
        <div className="text-center pt-16 pb-8">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 text-shadow-lg animate-fade-in">
            <span className="text-primary-400">Product</span> <span className="text-secondary-400">Catalog</span>
          </h2>
        </div>

        <div className="container mx-auto px-4 pb-12">
          <div className="max-w-7xl mx-auto">
            {/* Quick Actions Bar */}
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-primary-400/30 mb-8 hover:shadow-primary-400/20 transition-all duration-300">
              <div className="flex flex-wrap gap-4 items-center justify-between">
                <div className="flex gap-4">
                  <ImportButton
                    action={async () => await importPeptides()}
                    label="Import Peptides from Data"
                    icon="upload"
                  />

                  <ImportButton
                    action={async () => await fixProductImages()}
                    label="Fix Missing Images"
                    icon="image"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Package className="w-8 h-8 text-primary-400" />
                  <div>
                    <span className="text-3xl font-bold text-white">{products.length}</span>
                    <span className="text-gray-300 ml-2 text-lg">Total Products</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Create Product Form */}
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-primary-400/30 mb-8 hover:shadow-primary-400/20 transition-all duration-300">
              <div className="flex items-center mb-6">
                <Plus className="w-8 h-8 text-secondary-400 mr-3" />
                <h2 className="text-2xl font-bold text-white">Create New Product</h2>
              </div>
              
              <form action={createProductAction} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-primary-300 mb-2">
                      Product Name *
                    </label>
                    <input 
                      name="name" 
                      id="name"
                      placeholder="e.g., BPC-157" 
                      required 
                      className="w-full px-4 py-3 bg-gray-800/50 text-white placeholder-gray-400 border border-primary-400/30 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent backdrop-blur-sm"
                    />
                    <p className="mt-1 text-sm text-gray-400">
                      The display name (e.g., "BPC-157", "Ipamorelin")
                    </p>
                  </div>

                  <div>
                    <label htmlFor="slug" className="block text-sm font-medium text-primary-300 mb-2">
                      URL Slug *
                    </label>
                    <input 
                      name="slug" 
                      id="slug"
                      placeholder="e.g., bpc-157" 
                      required 
                      pattern="[a-z0-9-]+"
                      className="w-full px-4 py-3 bg-gray-800/50 text-white placeholder-gray-400 border border-primary-400/30 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent backdrop-blur-sm"
                    />
                    <p className="mt-1 text-sm text-gray-400">
                      URL: <code className="text-primary-400">/store/bpc-157</code>
                    </p>
                  </div>
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-primary-300 mb-2">
                    Description
                  </label>
                  <textarea 
                    name="description" 
                    id="description"
                    rows={4}
                    placeholder="Enter product description, benefits, usage instructions..."
                    className="w-full px-4 py-3 bg-gray-800/50 text-white placeholder-gray-400 border border-primary-400/30 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent backdrop-blur-sm"
                  />
                  <p className="mt-1 text-sm text-gray-400">
                    Detailed description for the product page
                  </p>
                </div>

                <div>
                  <label htmlFor="imageUrl" className="block text-sm font-medium text-primary-300 mb-2">
                    Image URL
                  </label>
                  <input 
                    name="imageUrl" 
                    id="imageUrl"
                    type="url"
                    placeholder="https://example.com/image.jpg"
                    className="w-full px-4 py-3 bg-gray-800/50 text-white placeholder-gray-400 border border-primary-400/30 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent backdrop-blur-sm"
                  />
                  <div className="mt-2 p-3 bg-blue-900/20 border border-blue-400/30 rounded-lg backdrop-blur-sm">
                    <p className="text-sm text-blue-300 font-medium mb-1">📸 Image Upload:</p>
                    <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside">
                      <li>Upload to <a href="https://imgur.com" target="_blank" className="text-primary-400 hover:underline">Imgur</a> or <a href="https://cloudinary.com" target="_blank" className="text-primary-400 hover:underline">Cloudinary</a></li>
                      <li>Copy the image URL</li>
                      <li>Paste here (must be https://)</li>
                    </ol>
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:shadow-primary-500/30 transition-all duration-200"
                >
                  Create Product
                </button>
              </form>
            </div>

            {/* Products List */}
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-primary-400/30 hover:shadow-primary-400/20 transition-all duration-300">
              <div className="flex items-center mb-6">
                <Package className="w-8 h-8 text-primary-400 mr-3" />
                <h2 className="text-2xl font-bold text-white">
                  Products ({products.length})
                </h2>
              </div>
              
              {products.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <p className="text-gray-300 mb-4 text-lg">No products yet. Create your first product above.</p>
                  <p className="text-sm text-gray-400">
                    Or click "Import Peptides from Data" to import existing products
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {products.map(product => (
                    <div key={product.id} className="bg-gray-800/30 rounded-lg p-6 border border-gray-700/50 backdrop-blur-sm hover:bg-gray-800/40 transition-all">
                      <div className="flex justify-between items-start mb-4">
                        {/* Product Image */}
                        {product.imageUrl && (
                          <div className="mr-4 flex-shrink-0">
                            <img 
                              src={product.imageUrl} 
                              alt={product.name}
                              className="w-24 h-24 object-cover rounded-lg border border-gray-700"
                            />
                          </div>
                        )}
                        
                        <div className="flex-1">
                          {/* Editable Product Name */}
                          <details className="group">
                            <summary className="cursor-pointer list-none">
                              <h3 className="text-xl font-bold text-white hover:text-primary-400 transition-colors inline-flex items-center gap-2">
                                {product.name}
                                <svg className="w-4 h-4 text-gray-400 group-open:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </h3>
                            </summary>
                            
                            {/* Edit Form - Hidden by default, shown when details is open */}
                            <div className="mt-4 p-4 bg-gray-900/50 rounded-lg border border-gray-600">
                              <form action={editProductAction} className="space-y-3">
                                <input type="hidden" name="productId" value={product.id} />
                                
                                {/* Basic Info Section */}
                                <div className="border-b border-gray-700 pb-3 mb-3">
                                  <h4 className="text-sm font-semibold text-primary-300 mb-3">Basic Information</h4>
                                  
                                  <div className="space-y-3">
                                    <div>
                                      <label className="text-xs text-gray-400">Product Name</label>
                                      <input 
                                        name="name" 
                                        defaultValue={product.name}
                                        className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded text-sm"
                                      />
                                    </div>
                                    
                                    <div>
                                      <label className="text-xs text-gray-400">Description</label>
                                      <textarea 
                                        name="description" 
                                        defaultValue={product.description || ''}
                                        rows={2}
                                        className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded text-sm"
                                      />
                                    </div>
                                    
                                    <div>
                                      <label className="text-xs text-gray-400">Image URL</label>
                                      <input 
                                        name="imageUrl" 
                                        type="url"
                                        defaultValue={product.imageUrl || ''}
                                        placeholder="https://example.com/image.jpg"
                                        className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded text-sm"
                                      />
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Protocol Management Section */}
                                <div className="border-b border-gray-700 pb-3 mb-3">
                                  <h4 className="text-sm font-semibold text-secondary-300 mb-3">Peptide Protocol Settings</h4>
                                  
                                  <div className="space-y-3">
                                    {/* Enable Tracking Checkbox */}
                                    <div className="flex items-center gap-2">
                                      <input 
                                        type="checkbox"
                                        name="isTrackable"
                                        id={`trackable-${product.id}`}
                                        defaultChecked={product.isTrackable}
                                        value="true"
                                        className="rounded border-gray-600 bg-gray-800 text-primary-500 focus:ring-primary-500"
                                      />
                                      <label htmlFor={`trackable-${product.id}`} className="text-sm text-white font-medium">
                                        Enable in Peptide Tracker
                                      </label>
                                    </div>
                                    
                                    {/* Protocol Fields - Grid Layout */}
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <label className="text-xs text-gray-400">Purpose</label>
                                        <select 
                                          name="protocolPurpose"
                                          defaultValue={product.protocolPurpose || ''}
                                          className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded text-sm"
                                        >
                                          <option value="">Select...</option>
                                          <option value="Fat Loss">Fat Loss</option>
                                          <option value="Healing">Healing</option>
                                          <option value="Performance">Performance</option>
                                          <option value="Longevity">Longevity</option>
                                          <option value="Sleep">Sleep</option>
                                          <option value="Immunity">Immunity</option>
                                        </select>
                                      </div>
                                      
                                      <div>
                                        <label className="text-xs text-gray-400">Dosage Range</label>
                                        <input 
                                          name="protocolDosageRange"
                                          placeholder="e.g., 0.5mg-2.5mg"
                                          defaultValue={product.protocolDosageRange || ''}
                                          className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded text-sm"
                                        />
                                      </div>
                                      
                                      <div>
                                        <label className="text-xs text-gray-400">Frequency</label>
                                        <input 
                                          name="protocolFrequency"
                                          placeholder="e.g., 3x per week"
                                          defaultValue={product.protocolFrequency || ''}
                                          className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded text-sm"
                                        />
                                      </div>
                                      
                                      <div>
                                        <label className="text-xs text-gray-400">Timing</label>
                                        <input 
                                          name="protocolTiming"
                                          placeholder="e.g., AM or PM"
                                          defaultValue={product.protocolTiming || ''}
                                          className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded text-sm"
                                        />
                                      </div>
                                      
                                      <div>
                                        <label className="text-xs text-gray-400">Duration</label>
                                        <input 
                                          name="protocolDuration"
                                          placeholder="e.g., 8 weeks on/off"
                                          defaultValue={product.protocolDuration || ''}
                                          className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded text-sm"
                                        />
                                      </div>
                                      
                                      <div>
                                        <label className="text-xs text-gray-400">Vial Amount</label>
                                        <input 
                                          name="vialAmount"
                                          placeholder="e.g., 10mg"
                                          defaultValue={product.vialAmount || ''}
                                          className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded text-sm"
                                        />
                                      </div>
                                    </div>
                                    
                                    <div>
                                      <label className="text-xs text-gray-400">Reconstitution Instructions</label>
                                      <input 
                                        name="reconstitutionInstructions"
                                        placeholder="e.g., 2ml BAC water"
                                        defaultValue={product.reconstitutionInstructions || ''}
                                        className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded text-sm"
                                      />
                                    </div>
                                    
                                    <div>
                                      <label className="text-xs text-gray-400">Syringe Units (for calculator)</label>
                                      <input 
                                        name="syringeUnits"
                                        type="number"
                                        step="0.1"
                                        placeholder="e.g., 10"
                                        defaultValue={product.syringeUnits || ''}
                                        className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded text-sm"
                                      />
                                    </div>
                                  </div>
                                </div>
                                
                                <button 
                                  type="submit"
                                  className="w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-medium py-2 rounded text-sm"
                                >
                                  Save All Changes
                                </button>
                              </form>
                            </div>
                          </details>
                          
                          <div className="flex items-center gap-3 mt-1">
                            <p className="text-sm text-gray-400">
                              Slug: <code className="text-primary-400">{product.slug}</code>
                            </p>
                            {product.isTrackable && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-secondary-500/20 text-secondary-400 border border-secondary-400/30 rounded-full text-xs font-medium">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                Peptide Tracker
                              </span>
                            )}
                          </div>
                          {product.description && (
                            <p className="text-gray-300 mt-2 line-clamp-2">{product.description}</p>
                          )}
                          {product.isTrackable && product.protocolDosageRange && (
                            <div className="mt-2 p-2 bg-gray-800/50 rounded-lg border border-gray-700">
                              <p className="text-xs text-secondary-300 font-medium mb-1">Protocol Info:</p>
                              <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                                {product.protocolPurpose && <span>Purpose: <span className="text-white">{product.protocolPurpose}</span></span>}
                                {product.protocolDosageRange && <span>Dosage: <span className="text-white">{product.protocolDosageRange}</span></span>}
                                {product.protocolFrequency && <span>Frequency: <span className="text-white">{product.protocolFrequency}</span></span>}
                              </div>
                            </div>
                          )}
                          {product.stripeProductId && (
                            <div className="flex items-center gap-2 mt-2">
                              <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              <span className="text-sm text-green-400">
                                Synced: {product.stripeProductId}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap gap-2 ml-4">
                          {/* Toggle Active */}
                          <form action={toggleActiveAction}>
                            <input type="hidden" name="productId" value={product.id} />
                            <input type="hidden" name="active" value={String(!product.active)} />
                            <button 
                              type="submit" 
                              className={`px-4 py-2 rounded-lg font-medium transition-all backdrop-blur-sm ${
                                product.active 
                                  ? 'bg-green-500/20 text-green-400 border border-green-400/30 hover:bg-green-500/30 hover:shadow-green-400/20' 
                                  : 'bg-gray-700/50 text-gray-400 border border-gray-600 hover:bg-gray-700'
                              }`}
                            >
                              {product.active ? '✓ Active' : 'Inactive'}
                            </button>
                          </form>
                          
                          {/* Toggle Storefront */}
                          <form action={toggleStorefrontAction}>
                            <input type="hidden" name="productId" value={product.id} />
                            <input type="hidden" name="storefront" value={String(!product.storefront)} />
                            <button 
                              type="submit" 
                              className={`px-4 py-2 rounded-lg font-medium transition-all backdrop-blur-sm ${
                                product.storefront 
                                  ? 'bg-blue-500/20 text-blue-400 border border-blue-400/30 hover:bg-blue-500/30 hover:shadow-blue-400/20' 
                                  : 'bg-gray-700/50 text-gray-400 border border-gray-600 hover:bg-gray-700'
                              }`}
                            >
                              {product.storefront ? '🛍 In Store' : 'Hidden'}
                            </button>
                          </form>
                          
                          {/* Sync to Stripe */}
                          {!product.stripeProductId && (
                            <form action={syncStripeAction}>
                              <input type="hidden" name="productId" value={product.id} />
                              <button 
                                type="submit" 
                                className="px-4 py-2 bg-purple-500/20 text-purple-400 border border-purple-400/30 rounded-lg font-medium hover:bg-purple-500/30 hover:shadow-purple-400/20 transition-all backdrop-blur-sm"
                              >
                                Sync to Stripe
                              </button>
                            </form>
                          )}
                          
                          {/* Archive */}
                          {product.active && (
                            <form action={archiveAction}>
                              <input type="hidden" name="productId" value={product.id} />
                              <button 
                                type="submit" 
                                className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-400/30 rounded-lg font-medium hover:bg-red-500/30 hover:shadow-red-400/20 transition-all backdrop-blur-sm"
                              >
                                Archive
                              </button>
                            </form>
                          )}
                        </div>
                      </div>
                      
                      {/* Prices Section */}
                      <div className="bg-gray-900/30 rounded-lg p-4 mt-4 backdrop-blur-sm">
                        <div className="flex items-center mb-3">
                          <DollarSign className="w-5 h-5 text-green-400 mr-2" />
                          <h4 className="font-medium text-white">Pricing</h4>
                        </div>
                        
                        {product.prices.length === 0 ? (
                          <p className="text-gray-400 text-sm mb-3">No prices set. Add a price to make this purchasable.</p>
                        ) : (
                          <div className="space-y-2 mb-4">
                            {product.prices.map(price => (
                              <div key={price.id} className="flex items-center justify-between bg-gray-800/50 rounded-lg px-4 py-2 backdrop-blur-sm">
                                <div className="flex items-center gap-3">
                                  <span className="text-white font-bold text-lg">
                                    ${(price.unitAmount / 100).toFixed(2)}
                                  </span>
                                  <span className="text-gray-400 text-sm uppercase">{price.currency}</span>
                                  {price.interval && (
                                    <span className="text-gray-400">/ {price.interval}</span>
                                  )}
                                  {price.isPrimary && (
                                    <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full border border-green-400/30">
                                      Primary
                                    </span>
                                  )}
                                  {price.stripePriceId && (
                                    <span className="text-xs text-gray-500">
                                      {price.stripePriceId.slice(0, 10)}...
                                    </span>
                                  )}
                                </div>
                                <form action={deletePriceAction} className="inline">
                                  <input type="hidden" name="priceId" value={price.id} />
                                  <button 
                                    type="submit" 
                                    className="text-red-400 hover:text-red-300 text-sm font-medium"
                                  >
                                    Remove
                                  </button>
                                </form>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Add Price Form */}
                        <form action={upsertPriceAction} className="flex flex-wrap gap-2">
                          <input type="hidden" name="productId" value={product.id} />
                          <div className="flex-1 min-w-[120px]">
                            <input 
                              name="amount" 
                              type="number" 
                              placeholder="Price (cents)" 
                              required 
                              className="w-full px-3 py-2 bg-gray-800/50 text-white placeholder-gray-400 border border-gray-600 rounded-lg text-sm backdrop-blur-sm"
                            />
                            <p className="text-xs text-gray-500 mt-1">e.g., 5999 = $59.99</p>
                          </div>
                          <select 
                            name="currency" 
                            className="px-3 py-2 bg-gray-800/50 text-white border border-gray-600 rounded-lg text-sm backdrop-blur-sm"
                          >
                            <option value="usd">USD</option>
                            <option value="eur">EUR</option>
                            <option value="gbp">GBP</option>
                          </select>
                          <select 
                            name="interval" 
                            className="px-3 py-2 bg-gray-800/50 text-white border border-gray-600 rounded-lg text-sm backdrop-blur-sm"
                          >
                            <option value="">One-time</option>
                            <option value="month">Monthly</option>
                            <option value="year">Yearly</option>
                          </select>
                          <label className="flex items-center gap-2 text-sm text-gray-300">
                            <input type="checkbox" name="isPrimary" value="true" className="rounded" />
                            Primary
                          </label>
                          <button 
                            type="submit" 
                            className="px-4 py-2 bg-green-500/20 text-green-400 border border-green-400/30 rounded-lg text-sm font-medium hover:bg-green-500/30 hover:shadow-green-400/20 transition-all backdrop-blur-sm"
                          >
                            Add Price
                          </button>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}