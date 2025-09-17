import { NextResponse } from 'next/server';
import { stripe } from '@/src/lib/stripe';
import { prisma } from '@/src/lib/prisma';
import type Stripe from 'stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!stripe) return NextResponse.json({ ok: true, note: 'Stripe not configured' }, { status: 200 });

  const sig = req.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return NextResponse.json({ ok: true, note: 'Missing signature or secret' }, { status: 200 });

  const payload = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, sig, secret);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: `Webhook signature verification failed: ${err.message}` }, { status: 400 });
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
      }
    });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}