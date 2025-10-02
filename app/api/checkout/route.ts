import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { ensureStripeSync } from '@/lib/stripeSync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // Check if Stripe is configured
    if (!stripe) {
      console.error('Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.');
      
      // Return a user-friendly error page
      const errorHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Payment System Not Configured</title>
            <style>
              body {
                font-family: system-ui, -apple-system, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              }
              .error-container {
                background: white;
                padding: 3rem;
                border-radius: 12px;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
                max-width: 500px;
                text-align: center;
              }
              h1 {
                color: #ef4444;
                font-size: 1.5rem;
                margin-bottom: 1rem;
              }
              p {
                color: #6b7280;
                margin-bottom: 2rem;
                line-height: 1.6;
              }
              .back-button {
                display: inline-block;
                padding: 0.75rem 2rem;
                background: #3b82f6;
                color: white;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 500;
                transition: background 0.2s;
              }
              .back-button:hover {
                background: #2563eb;
              }
              .details {
                margin-top: 2rem;
                padding: 1rem;
                background: #f3f4f6;
                border-radius: 6px;
                font-size: 0.875rem;
                color: #6b7280;
                font-family: monospace;
              }
            </style>
          </head>
          <body>
            <div class="error-container">
              <h1>⚠️ Payment System Not Available</h1>
              <p>
                The payment system is currently not configured. 
                This is likely because Stripe API keys have not been set up yet.
              </p>
              <p>
                <strong>For testing:</strong> Products need to be synced with Stripe 
                and payment keys must be configured in the environment.
              </p>
              <a href="/order" class="back-button">← Back to Store</a>
              <div class="details">
                Error: STRIPE_SECRET_KEY not configured
              </div>
            </div>
          </body>
        </html>
      `;
      
      return new NextResponse(errorHtml, {
        status: 503,
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    // Handle both JSON and form data
    let productId: string;
    let priceId: string;
    
    const contentType = req.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      // Handle JSON request (from API calls)
      const data = await req.json();
      productId = data.productId;
      priceId = data.priceId;
    } else {
      // Handle form submission (from order page)
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

    let price = product.prices.find(p => p.id === priceId) || product.prices.find(p => p.isPrimary) || product.prices[0];
    if (!price) return NextResponse.json({ ok: false, error: 'No price configured' }, { status: 400 });

    // JIT publish if needed
    if (!product.stripeProductId || !price.stripePriceId) {
      await ensureStripeSync(product.id);
      const refreshed = await prisma.price.findUnique({ where: { id: price.id } });
      if (!refreshed?.stripePriceId) return NextResponse.json({ ok: false, error: 'Stripe price missing after sync' }, { status: 500 });
      price = refreshed;
    }

    const baseUrl = process.env.APP_BASE_URL || process.env.AUTH0_BASE_URL || 'https://resetbiology.com';
    const success = `${baseUrl}/order/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancel  = `${baseUrl}/order`;

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

    // If form submission, redirect to Stripe checkout
    if (!contentType?.includes('application/json')) {
      return NextResponse.redirect(session.url!);
    }
    
    // If JSON request, return the URL
    return NextResponse.json({ ok: true, url: session.url }, { status: 200 });
  } catch (err: any) {
    console.error('Checkout error:', err);
    return NextResponse.json({ ok: false, error: err?.message || 'Checkout error' }, { status: 500 });
  }
}