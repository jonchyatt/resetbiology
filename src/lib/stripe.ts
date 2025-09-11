// src/lib/stripe.ts
import Stripe from 'stripe';

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  // Do not throw at import time in production; we'll fail gracefully in routes.
  // console.warn('STRIPE_SECRET_KEY not set');
}

export const stripe = key ? new Stripe(key, {
  apiVersion: '2025-08-27.basil',
}) : null;