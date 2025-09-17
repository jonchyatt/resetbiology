import { prisma } from '@/src/lib/prisma';

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
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Order</h1>
      {products.length === 0 && <p>No products available.</p>}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => {
          const primary = p.prices.find(x => x.isPrimary) || p.prices[0];
          return (
            <form
              key={p.id}
              action="/api/checkout"
              method="post"
              className="border rounded-lg p-4"
            >
              <h3 className="font-semibold">{p.name}</h3>
              {p.imageUrl && <img src={p.imageUrl} alt={p.name} className="mt-2 rounded" />}
              <p className="text-sm mt-2">{p.description}</p>
              {primary ? (
                <>
                  <input type="hidden" name="productId" value={p.id} />
                  <input type="hidden" name="priceId" value={primary.id} />
                  <p className="mt-3">
                    {(primary.unitAmount / 100).toLocaleString(undefined, { style: 'currency', currency: primary.currency.toUpperCase() })}
                    {primary.interval ? ` / ${primary.interval}` : ''}
                  </p>
                  <button type="submit" className="mt-3 px-4 py-2 rounded bg-black text-white">
                    Buy now
                  </button>
                </>
              ) : (
                <p className="mt-3 text-red-600">No price configured</p>
              )}
            </form>
          );
        })}
      </div>
    </main>
  );
}