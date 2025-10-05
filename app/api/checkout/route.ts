import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStripe } from '@/lib/stripe';
import { ensureStripeSync } from '@/lib/stripeSync';
import { getPreferredAppBaseUrl } from '@/lib/stripeEnv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const stripe = getStripe();

    if (!stripe) {
      console.error('[checkout] Stripe is not configured. Set STRIPE_SECRET_KEY in your environment.');

      const errorHtml = `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <title>Stripe Not Configured</title>
            <style>
              :root { color-scheme: light dark; }
              body {
                font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                padding: 2rem;
              }
              .error {
                background: #fff;
                max-width: 520px;
                width: 100%;
                border-radius: 16px;
                padding: 2.5rem;
                box-shadow: 0 20px 50px -20px rgba(15, 23, 42, 0.4);
                text-align: center;
              }
              h1 {
                color: #ef4444;
                font-size: 1.75rem;
                margin-bottom: 1rem;
              }
              p {
                color: #475569;
                margin-bottom: 1.25rem;
                line-height: 1.6;
              }
              code {
                font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
                background: #f8fafc;
                padding: 0.25rem 0.5rem;
                border-radius: 6px;
              }
              a.button {
                display: inline-block;
                margin-top: 1rem;
                padding: 0.75rem 1.75rem;
                border-radius: 9999px;
                background: #3b82f6;
                color: #fff;
                text-decoration: none;
                font-weight: 600;
                transition: background 0.2s ease;
              }
              a.button:hover { background: #2563eb; }
              .hint {
                margin-top: 1.5rem;
                font-size: 0.875rem;
                color: #64748b;
                border-top: 1px solid #e2e8f0;
                padding-top: 1rem;
              }
            </style>
          </head>
          <body>
            <main class="error">
              <h1>Checkout Temporarily Unavailable</h1>
              <p>
                Stripe is not currently configured for this deployment. To enable payments,
                set the <code>STRIPE_SECRET_KEY</code> environment variable (and matching publishable key)
                in your hosting provider, then redeploy.
              </p>
              <p>
                Once the key is present, the checkout flow will automatically provision the
                required Stripe products and prices on first purchase.
              </p>
              <a href="/order" class="button">Back to Store</a>
              <div class="hint">
                Tip: On Vercel, add the key under <strong>Project &gt; Settings &gt; Environment Variables</strong>
                and mark it for <em>Build &amp; Runtime</em>.
              </div>
            </main>
          </body>
        </html>
      `;

      return new NextResponse(errorHtml, {
        status: 503,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    let productId: string;
    let priceId: string;
    const contentType = req.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      const data = await req.json();
      productId = data.productId;
      priceId = data.priceId;
    } else {
      const formData = await req.formData();
      productId = formData.get('productId') as string;
      priceId = formData.get('priceId') as string;
    }

    console.log('[checkout] creating session for product/price', { productId, priceId });

    const product = await prisma.product.findUnique({
      where: { id: String(productId) },
      include: { prices: true },
    });
    if (!product || !product.active || !product.storefront) {
      return NextResponse.json({ ok: false, error: 'Product not purchasable' }, { status: 400 });
    }

    let price =
      product.prices.find((p) => p.id === priceId) ||
      product.prices.find((p) => p.isPrimary) ||
      product.prices[0];
    if (!price) {
      return NextResponse.json({ ok: false, error: 'No price configured' }, { status: 400 });
    }

    if (!product.stripeProductId || !price.stripePriceId) {
      await ensureStripeSync(product.id);
      const refreshed = await prisma.price.findUnique({ where: { id: price.id } });
      if (!refreshed?.stripePriceId) {
        return NextResponse.json({ ok: false, error: 'Stripe price missing after sync' }, { status: 500 });
      }
      price = refreshed;
    }

    const baseUrl = (getPreferredAppBaseUrl() ?? 'https://resetbiology.com').replace(/\/+$/, '');
    const success = `${baseUrl}/order/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancel = `${baseUrl}/order`;

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

    if (!contentType?.includes('application/json')) {
      return NextResponse.redirect(session.url!);
    }

    return NextResponse.json({ ok: true, url: session.url }, { status: 200 });
  } catch (err: any) {
    console.error('Checkout error:', err);
    return NextResponse.json({ ok: false, error: err?.message || 'Checkout error' }, { status: 500 });
  }
}
