export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// app/admin/store/page.tsx
import { requireAdmin } from '@/lib/adminGuard';
import { listProducts, createProduct, updateProduct, archiveProduct, upsertPrice, deletePrice, syncProductToStripe } from '@/app/admin/store/actions';
export const revalidate = 0;

export default async function AdminStorePage() {
  await requireAdmin('/admin/store'); // important: preserves return after login
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
    const productId = String(fd.get('productId') || '');
    const id = fd.get('priceId')?.toString() || undefined;
    const label = fd.get('label')?.toString() || null;
    const amountStr = fd.get('unitAmount')?.toString() || '0';
    const unitAmount = Math.round(Number(amountStr));
    const currency = fd.get('currency')?.toString() || 'usd';
    const intervalRaw = fd.get('interval')?.toString() || '';
    const interval = intervalRaw === 'month' || intervalRaw === 'year' ? intervalRaw : null;
    const isPrimary = (fd.get('isPrimary')?.toString() || '') === 'on';
    const active = (fd.get('active')?.toString() || '') === 'on';

    await upsertPrice(productId, { id, label, unitAmount, currency, interval, isPrimary, active });
  };

  const deletePriceAction = async (fd: FormData) => {
    'use server';
    const priceId = String(fd.get('priceId') || '');
    await deletePrice(priceId);
  };
  // ------------------------------------------------------------------

  return (
    <main className="p-6 space-y-10">
      <header>
        <h1 className="text-2xl font-semibold">Store Admin</h1>
        <p className="text-sm text-gray-500">Manage Products & Prices, publish to Stripe, and control storefront visibility.</p>
      </header>

      {/* New Product */}
      <section className="rounded border p-4">
        <h2 className="font-semibold mb-3">Create Product</h2>
        <form action={createProductAction} className="grid gap-3 max-w-xl">
          <div>
            <label className="block text-sm mb-1">Name</label>
            <input name="name" className="border rounded p-2 w-full" required />
          </div>
          <div>
            <label className="block text-sm mb-1">Slug</label>
            <input name="slug" className="border rounded p-2 w-full" placeholder="lowercase-hyphens" required />
          </div>
          <div>
            <label className="block text-sm mb-1">Description</label>
            <textarea name="description" className="border rounded p-2 w-full" rows={3} />
          </div>
          <div>
            <label className="block text-sm mb-1">Image URL</label>
            <input name="imageUrl" className="border rounded p-2 w-full" placeholder="/images/peptide.jpg or https://..." />
          </div>
          <div>
            <button className="px-3 py-2 rounded bg-black text-white">Create</button>
          </div>
        </form>
      </section>

      {/* Products table */}
      <section className="space-y-6">
        <h2 className="font-semibold">Products</h2>

        {products.length === 0 ? (
          <p className="text-gray-600">No products yet. Create one above.</p>
        ) : (
          <ul className="space-y-6">
            {products.map((p) => (
              <li key={p.id} className="rounded border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-sm text-gray-500">slug: {p.slug}</div>
                    {p.stripeProductId ? (
                      <div className="text-xs text-green-700 mt-1">Stripe: {p.stripeProductId}</div>
                    ) : (
                      <div className="text-xs text-amber-700 mt-1">Not on Stripe yet</div>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Storefront toggle */}
                    <form action={toggleStorefrontAction} className="flex items-center gap-2">
                      <input type="hidden" name="productId" value={p.id} />
                      <input type="hidden" name="storefront" value={(!p.storefront).toString()} />
                      <button className="px-3 py-1 border rounded">
                        {p.storefront ? 'Hide from Storefront' : 'Show in Storefront'}
                      </button>
                    </form>

                    {/* Active toggle */}
                    <form action={toggleActiveAction} className="flex items-center gap-2">
                      <input type="hidden" name="productId" value={p.id} />
                      <input type="hidden" name="active" value={(!p.active).toString()} />
                      <button className="px-3 py-1 border rounded">
                        {p.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </form>

                    {/* Archive */}
                    <form action={archiveAction}>
                      <input type="hidden" name="productId" value={p.id} />
                      <button className="px-3 py-1 border rounded">Archive</button>
                    </form>

                    {/* Sync to Stripe */}
                    <form action={syncStripeAction}>
                      <input type="hidden" name="productId" value={p.id} />
                      <button className="px-3 py-1 rounded bg-purple-700 text-white">Sync to Stripe</button>
                    </form>
                  </div>
                </div>

                {/* Prices */}
                <div className="mt-4">
                  <h3 className="font-medium mb-2">Prices</h3>

                  {p.prices.length === 0 ? (
                    <p className="text-sm text-gray-600">No prices yet—add one.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-[700px] text-sm border">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left p-2 border-r">Label</th>
                            <th className="text-left p-2 border-r">Amount</th>
                            <th className="text-left p-2 border-r">Currency</th>
                            <th className="text-left p-2 border-r">Interval</th>
                            <th className="text-left p-2 border-r">Primary</th>
                            <th className="text-left p-2 border-r">Active</th>
                            <th className="text-left p-2 border-r">Stripe</th>
                            <th className="text-left p-2">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.prices.map((pr) => (
                            <tr key={pr.id} className="border-t align-top">
                              <td className="p-2 border-r">{pr.label ?? '-'}</td>
                              <td className="p-2 border-r">${(pr.unitAmount / 100).toFixed(2)}</td>
                              <td className="p-2 border-r uppercase">{pr.currency}</td>
                              <td className="p-2 border-r">{pr.interval ?? 'one-time'}</td>
                              <td className="p-2 border-r">{pr.isPrimary ? 'Yes' : 'No'}</td>
                              <td className="p-2 border-r">{pr.active ? 'Yes' : 'No'}</td>
                              <td className="p-2 border-r">
                                {pr.stripePriceId ? (
                                  <span className="text-green-700">{pr.stripePriceId}</span>
                                ) : (
                                  <span className="text-amber-700">Not on Stripe yet</span>
                                )}
                              </td>
                              <td className="p-2">
                                {/* Update price form */}
                                <form action={upsertPriceAction} className="grid gap-2 md:grid-cols-6 border p-2 rounded">
                                  <input type="hidden" name="productId" value={p.id} />
                                  <input type="hidden" name="priceId" value={pr.id} />

                                  <input name="label" defaultValue={pr.label ?? ''} placeholder="Label" className="border p-1 rounded" />
                                  <input name="unitAmount" defaultValue={String(pr.unitAmount)} className="border p-1 rounded" />
                                  <select name="currency" defaultValue={pr.currency} className="border p-1 rounded">
                                    <option value="usd">usd</option>
                                  </select>
                                  <select name="interval" defaultValue={pr.interval ?? ''} className="border p-1 rounded">
                                    <option value="">one-time</option>
                                    <option value="month">month</option>
                                    <option value="year">year</option>
                                  </select>
                                  <label className="inline-flex items-center gap-1">
                                    <input type="checkbox" name="isPrimary" defaultChecked={pr.isPrimary} />
                                    <span className="text-xs">Primary</span>
                                  </label>
                                  <label className="inline-flex items-center gap-1">
                                    <input type="checkbox" name="active" defaultChecked={pr.active} />
                                    <span className="text-xs">Active</span>
                                  </label>

                                  <div className="md:col-span-6 flex gap-2">
                                    <button className="px-3 py-1 border rounded">Save</button>
                                    <form action={deletePriceAction}>
                                      <input type="hidden" name="priceId" value={pr.id} />
                                      <button className="px-3 py-1 border rounded">Delete</button>
                                    </form>
                                  </div>
                                </form>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* New price */}
                  <div className="mt-3">
                    <form action={upsertPriceAction} className="grid gap-2 md:grid-cols-6 border p-3 rounded">
                      <input type="hidden" name="productId" value={p.id} />

                      <input name="label" placeholder="Label (optional)" className="border p-1 rounded" />
                      <input name="unitAmount" placeholder="Amount (cents)" className="border p-1 rounded" />
                      <select name="currency" defaultValue="usd" className="border p-1 rounded">
                        <option value="usd">usd</option>
                      </select>
                      <select name="interval" defaultValue="" className="border p-1 rounded">
                        <option value="">one-time</option>
                        <option value="month">month</option>
                        <option value="year">year</option>
                      </select>
                      <label className="inline-flex items-center gap-1">
                        <input type="checkbox" name="isPrimary" />
                        <span className="text-xs">Primary</span>
                      </label>
                      <label className="inline-flex items-center gap-1">
                        <input type="checkbox" name="active" defaultChecked />
                        <span className="text-xs">Active</span>
                      </label>

                      <div className="md:col-span-6">
                        <button className="px-3 py-1 border rounded">Add Price</button>
                      </div>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}