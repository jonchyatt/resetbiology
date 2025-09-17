import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { stripe } from '@/src/lib/stripe';
import { ensureStripeSync } from '@/src/lib/stripeSync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    if (!stripe) return NextResponse.json({ ok: false, error: 'Stripe not configured' }, { status: 503 });
    const { productId, priceId } = await req.json();

    const product = await prisma.product.findUnique({
      where: { id: String(productId) },
      include: { prices: true },
    });
    if (!product || !product.active || !product.storefront) {
      return NextResponse.json({ ok: false, error: 'Product not purchasable' }, { status: 400 });
    }

    let price = product.prices.find(p => p.id === priceId) || product.prices.find(p => p.isPrimary) || product.prices[0];
    if (!price) return NextResponse.json({ ok: false, error: 'No price configured' }, { status: 400 });

    // JIT publish if needed
    if (!product.stripeProductId || !price.stripePriceId) {
      await ensureStripeSync(product.id);
      const refreshed = await prisma.price.findUnique({ where: { id: price.id } });
      if (!refreshed?.stripePriceId) return NextResponse.json({ ok: false, error: 'Stripe price missing after sync' }, { status: 500 });
      price = refreshed;
    }

    const success = `${process.env.APP_BASE_URL}/order/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancel  = `${process.env.APP_BASE_URL}/order`;

    const session = await stripe.checkout.sessions.create({
      mode: price.interval ? 'subscription' : 'payment',
      line_items: [{ price: price.stripePriceId!, quantity: 1 }],
      success_url: success,
      cancel_url: cancel,
      allow_promotion_codes: true,
      metadata: {
        productId: product.id,
        priceId: price.id,
      },
    });

    return NextResponse.json({ ok: true, url: session.url }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Checkout error' }, { status: 500 });
  }
}