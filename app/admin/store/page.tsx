export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// app/admin/store/page.tsx
import { auth0 } from '@/lib/auth0';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { listProducts, createProduct, updateProduct, archiveProduct, upsertPrice, deletePrice, syncProductToStripe } from '@/app/admin/store/actions';
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
    const priceId = fd.get('priceId')?.toString() || undefined;
    const amount = Number(fd.get('amount') || 0);
    const currency = String(fd.get('currency') || 'usd');
    const intervalValue = fd.get('interval')?.toString() || '';
    const interval = intervalValue === 'month' || intervalValue === 'year' ? intervalValue : null;
    const isPrimary = String(fd.get('isPrimary') || 'false') === 'true';
    await upsertPrice(prodId, { priceId, amount, currency, interval, isPrimary });
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
    await updateProduct(id, { name, description, imageUrl });
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Admin Store Management</h1>

        {/* Create Product Form */}
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h2 className="text-xl font-semibold mb-4">Create New Product</h2>
          <form action={createProductAction} className="flex flex-col gap-4">
            <input name="name" placeholder="Product Name" required className="p-2 border rounded" />
            <input name="slug" placeholder="URL Slug (e.g., bpc-157)" required className="p-2 border rounded" />
            <textarea name="description" placeholder="Description" className="p-2 border rounded" />
            <input name="imageUrl" placeholder="Image URL" className="p-2 border rounded" />
            <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
              Create Product
            </button>
          </form>
        </div>

        {/* Products List */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Products ({products.length})</h2>
          
          {products.length === 0 ? (
            <p className="text-gray-500">No products yet. Create your first product above.</p>
          ) : (
            <div className="space-y-6">
              {products.map(product => (
                <div key={product.id} className="border-b pb-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-lg font-medium">{product.name}</h3>
                      <p className="text-sm text-gray-500">Slug: {product.slug}</p>
                      {product.description && <p className="text-sm mt-1">{product.description}</p>}
                      {product.stripeProductId && (
                        <p className="text-xs text-green-600 mt-1">✓ Synced to Stripe: {product.stripeProductId}</p>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      {/* Toggle Active */}
                      <form action={toggleActiveAction}>
                        <input type="hidden" name="productId" value={product.id} />
                        <input type="hidden" name="active" value={String(!product.active)} />
                        <button type="submit" className={`px-3 py-1 rounded text-sm ${
                          product.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {product.active ? 'Active' : 'Inactive'}
                        </button>
                      </form>
                      
                      {/* Toggle Storefront */}
                      <form action={toggleStorefrontAction}>
                        <input type="hidden" name="productId" value={product.id} />
                        <input type="hidden" name="storefront" value={String(!product.storefront)} />
                        <button type="submit" className={`px-3 py-1 rounded text-sm ${
                          product.storefront ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {product.storefront ? 'In Store' : 'Hidden'}
                        </button>
                      </form>
                      
                      {/* Sync to Stripe */}
                      {!product.stripeProductId && (
                        <form action={syncStripeAction}>
                          <input type="hidden" name="productId" value={product.id} />
                          <button type="submit" className="px-3 py-1 bg-purple-100 text-purple-700 rounded text-sm">
                            Sync to Stripe
                          </button>
                        </form>
                      )}
                      
                      {/* Archive */}
                      {!product.archived && (
                        <form action={archiveAction}>
                          <input type="hidden" name="productId" value={product.id} />
                          <button type="submit" className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm">
                            Archive
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                  
                  {/* Prices */}
                  <div className="mt-4">
                    <h4 className="text-sm font-medium mb-2">Prices:</h4>
                    {product.prices.length === 0 ? (
                      <p className="text-sm text-gray-500">No prices set</p>
                    ) : (
                      <div className="space-y-1">
                        {product.prices.map(price => (
                          <div key={price.id} className="flex items-center gap-2 text-sm">
                            <span>${(price.amount / 100).toFixed(2)} {price.currency.toUpperCase()}</span>
                            {price.interval && <span className="text-gray-500">/ {price.interval}</span>}
                            {price.isPrimary && <span className="text-green-600">✓ Primary</span>}
                            {price.stripePriceId && <span className="text-xs text-green-600">Stripe: {price.stripePriceId.slice(0, 10)}...</span>}
                            <form action={deletePriceAction} className="inline">
                              <input type="hidden" name="priceId" value={price.id} />
                              <button type="submit" className="text-red-600 hover:underline">Remove</button>
                            </form>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Add Price Form */}
                    <form action={upsertPriceAction} className="mt-2 flex gap-2">
                      <input type="hidden" name="productId" value={product.id} />
                      <input name="amount" type="number" placeholder="Amount (cents)" required className="p-1 border rounded text-sm" />
                      <select name="currency" className="p-1 border rounded text-sm">
                        <option value="usd">USD</option>
                        <option value="eur">EUR</option>
                        <option value="gbp">GBP</option>
                      </select>
                      <select name="interval" className="p-1 border rounded text-sm">
                        <option value="">One-time</option>
                        <option value="month">Monthly</option>
                        <option value="year">Yearly</option>
                      </select>
                      <label className="flex items-center gap-1 text-sm">
                        <input type="checkbox" name="isPrimary" value="true" />
                        Primary
                      </label>
                      <button type="submit" className="px-2 py-1 bg-green-500 text-white rounded text-sm">
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
  );
}