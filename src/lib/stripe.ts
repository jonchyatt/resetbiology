// src/lib/stripe.ts
import Stripe from 'stripe';
import { STRIPE_SECRET_KEY } from './stripeEnv';

export const stripe =
  STRIPE_SECRET_KEY
    ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2025-08-27.basil' })
    : null;