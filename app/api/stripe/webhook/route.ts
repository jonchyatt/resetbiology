import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { getStripeWebhookSecret } from '@/lib/stripeEnv';
import { sendOrderConfirmationEmail, sendSellerOrderNotification } from '@/lib/email';
import type Stripe from 'stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  console.log('[webhook] received', new Date().toISOString());

  const stripe = getStripe();
  if (!stripe) {
    console.error('[webhook] Stripe not configured');
    return NextResponse.json({ ok: true, note: 'Stripe not configured' }, { status: 200 });
  }

  const sig = req.headers.get('stripe-signature');
  const secret = getStripeWebhookSecret();

  // Enhanced debugging
  console.log('[webhook] Has signature:', !!sig);
  console.log('[webhook] Has secret:', !!secret);
  if (secret) {
    console.log('[webhook] Secret starts with:', secret.substring(0, 10));
    console.log('[webhook] Secret length:', secret.length);
  }

  if (!sig || !secret) {
    console.error('[webhook] Missing signature or secret');
    return NextResponse.json({ ok: true, note: 'Missing signature or secret' }, { status: 200 });
  }

  const payload = await req.text();
  console.log('[webhook] Payload length:', payload.length);

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, sig, secret);
    console.log('[webhook] event type:', event.type);
  } catch (err: any) {
    console.error('[webhook] Verification failed:', err.message);
    console.error('[webhook] Error details:', err);
    return NextResponse.json(
      { ok: false, error: `Webhook signature verification failed: ${err.message}` },
      { status: 400 },
    );
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const shipping = (session as any).shipping_details;

    const order = await prisma.order.create({
      data: {
        stripeSessionId: session.id,
        stripePaymentIntentId: (session.payment_intent as string) || null,
        stripeCustomerId: (session.customer as string) || null,
        productId: session.metadata?.productId || null,
        priceId: session.metadata?.priceId || null,
        amountTotal: session.amount_total ?? null,
        currency: session.currency ?? null,
        email: session.customer_details?.email ?? null,
        status: 'paid',

        // Shipping Information
        shippingName: shipping?.name || null,
        shippingLine1: shipping?.address?.line1 || null,
        shippingLine2: shipping?.address?.line2 || null,
        shippingCity: shipping?.address?.city || null,
        shippingState: shipping?.address?.state || null,
        shippingPostalCode: shipping?.address?.postal_code || null,
        shippingCountry: shipping?.address?.country || null,
        shippingPhone: session.customer_details?.phone || null,

        fulfillmentStatus: 'unfulfilled',
      },
    });

    console.log('[webhook] order created:', order.id);

    // Get product details for email
    const product = await prisma.product.findUnique({
      where: { id: order.productId! },
      select: { name: true },
    });

    // Send confirmation email to customer
    if (order.email && product) {
      const orderNumber = order.id.slice(-8).toUpperCase();

      await sendOrderConfirmationEmail({
        orderId: order.id,
        orderNumber,
        email: order.email,
        shippingName: order.shippingName!,
        shippingLine1: order.shippingLine1!,
        shippingLine2: order.shippingLine2 || undefined,
        shippingCity: order.shippingCity!,
        shippingState: order.shippingState!,
        shippingPostalCode: order.shippingPostalCode!,
        shippingCountry: order.shippingCountry!,
        productName: product.name,
        amountTotal: order.amountTotal!,
        currency: order.currency!,
      });

      // Send notification to seller
      await sendSellerOrderNotification({
        orderId: order.id,
        orderNumber,
        email: order.email,
        shippingName: order.shippingName!,
        shippingLine1: order.shippingLine1!,
        shippingLine2: order.shippingLine2 || undefined,
        shippingCity: order.shippingCity!,
        shippingState: order.shippingState!,
        shippingPostalCode: order.shippingPostalCode!,
        shippingCountry: order.shippingCountry!,
        productName: product.name,
        amountTotal: order.amountTotal!,
        currency: order.currency!,
      });
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
