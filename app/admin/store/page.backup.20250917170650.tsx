import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

async function getData() {
  return prisma.product.findMany({
    include: { prices: { orderBy: { unitAmount: 'asc' } } },
    orderBy: { updatedAt: 'desc' },
  });
}

export default async function AdminStorePage() {
  const items = await getData();
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Store (Admin)</h1>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2">Name</th>
            <th>Storefront</th>
            <th>Stripe</th>
            <th>Prices</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map(p => (
            <tr key={p.id} className="border-b">
              <td className="py-2">
                <div className="font-medium">{p.name}</div>
                <div className="text-gray-500">{p.slug}</div>
              </td>
              <td>{p.storefront ? '✅' : '—'}</td>
              <td>{p.stripeProductId ? '🔗 ' + p.stripeProductId : '—'}</td>
              <td>
                {p.prices.length ? p.prices.map(pr => (
                  <div key={pr.id}>
                    {(pr.unitAmount/100).toLocaleString(undefined, { style: 'currency', currency: pr.currency.toUpperCase() })}
                    {pr.interval ? ` / ${pr.interval}` : ''} {pr.isPrimary ? '★' : ''} {pr.stripePriceId ? '🔗' : ''}
                  </div>
                )) : '—'}
              </td>
              <td className="py-2">
                <form action="/api/admin/stripe-sync" method="post">
                  <input type="hidden" name="productId" value={p.id} />
                  <button className="px-3 py-1 rounded border">Sync to Stripe</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}