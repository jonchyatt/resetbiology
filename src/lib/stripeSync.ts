import { prisma } from '@/lib/prisma';
import { getStripe } from '@/lib/stripe';

type SyncResult = {
  productId: string;
  stripeProductId: string;
  priceIds: Array<{ id: string; stripePriceId: string }>;
};

export async function ensureStripeSync(productId: string): Promise<SyncResult> {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe not configured');

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { prices: true },
  });
  if (!product) throw new Error('Product not found');

  let stripeProductId = product.stripeProductId;
  if (!stripeProductId) {
    const sp = await stripe.products.create({
      name: product.name,
      description: product.description ?? undefined,
      images: product.imageUrl ? [product.imageUrl] : undefined,
      active: product.active,
      metadata: { productId: product.id },
    });
    stripeProductId = sp.id;
    await prisma.product.update({
      where: { id: product.id },
      data: { stripeProductId: sp.id, lastSyncedAt: new Date() },
    });
  }

  const out: SyncResult = { productId: product.id, stripeProductId, priceIds: [] };

  for (const p of product.prices) {
    if (!p.stripePriceId) {
      const created = await stripe.prices.create({
        product: stripeProductId,
        unit_amount: p.unitAmount,
        currency: p.currency,
        ...(p.interval ? { recurring: { interval: p.interval as 'month' | 'year' } } : {}),
        active: p.active,
        metadata: { productId: product.id, priceId: p.id },
      });
      const updated = await prisma.price.update({
        where: { id: p.id },
        data: { stripePriceId: created.id },
      });
      out.priceIds.push({ id: updated.id, stripePriceId: created.id });
    } else {
      out.priceIds.push({ id: p.id, stripePriceId: p.stripePriceId });
    }
  }

  return out;
}
