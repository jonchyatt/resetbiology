// src/lib/stripe.ts
import Stripe from 'stripe';
import { getStripeSecretKey } from './stripeEnv';

export type StripeClient = Stripe;

let cachedStripe: StripeClient | null | undefined;

export function getStripe(): StripeClient | null {
  if (cachedStripe !== undefined) {
    return cachedStripe;
  }

  const secret = getStripeSecretKey();
  if (!secret) {
    cachedStripe = null;
    return cachedStripe;
  }

  cachedStripe = new Stripe(secret, { apiVersion: '2025-08-27.basil' });
  return cachedStripe;
}

export function resetStripeClient(): void {
  cachedStripe = undefined;
}
