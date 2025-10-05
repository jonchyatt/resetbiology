import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { getStripeWebhookSecret } from '@/lib/stripeEnv';
import type Stripe from 'stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  console.log('[webhook] received', new Date().toISOString());

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ ok: true, note: 'Stripe not configured' }, { status: 200 });
  }

  const sig = req.headers.get('stripe-signature');
  const secret = getStripeWebhookSecret();
  if (!sig || !secret) {
    return NextResponse.json({ ok: true, note: 'Missing signature or secret' }, { status: 200 });
  }

  const payload = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, sig, secret);
    console.log('[webhook] event type:', event.type);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: `Webhook signature verification failed: ${err.message}` },
      { status: 400 },
    );
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    await prisma.order.create({
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
      },
    });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
