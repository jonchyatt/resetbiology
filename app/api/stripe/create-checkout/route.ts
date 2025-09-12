// app/api/stripe/create-checkout/route.ts
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  if (!stripe) return NextResponse.json({ url: null }, { status: 200 });

  // TODO: replace with your real price ID
  const PRICE_ID = process.env.STRIPE_TEST_PRICE_ID;
  if (!PRICE_ID) return NextResponse.json({ error: 'Missing STRIPE_TEST_PRICE_ID' }, { status: 500 });

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: PRICE_ID, quantity: 1 }],
    success_url: `${process.env.AUTH0_BASE_URL}/portal?checkout=success`,
    cancel_url: `${process.env.AUTH0_BASE_URL}/portal?checkout=cancel`,
  });

  return NextResponse.json({ url: session.url }, { status: 200 });
}