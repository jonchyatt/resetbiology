// src/scripts/stripe-doctor.ts
// Run with: npx tsx --env-file=.env.local src/scripts/stripe-doctor.ts
import Stripe from 'stripe';
import { getStripeSecretKey, getStripeWebhookSecret, getPreferredAppBaseUrl } from '@/lib/stripeEnv';

function out(label: string, value: unknown) {
  console.log(`${label}:`, value ?? '(missing)');
}

(async () => {
  const secret = getStripeSecretKey();
  const whsec = getStripeWebhookSecret();
  const base = getPreferredAppBaseUrl();

  console.log('--- Stripe Doctor ---');
  out('STRIPE_SECRET_KEY present', Boolean(secret));
  out('STRIPE_WEBHOOK_SECRET present', Boolean(whsec));
  out('APP_BASE_URL', base || '(using runtime host fallback)');

  if (!secret) {
    console.error('[!] No STRIPE_SECRET_KEY. Doctor cannot continue.');
    process.exit(1);
  }

  const stripe = new Stripe(secret, { apiVersion: '2025-08-27.basil' });

  try {
    const account = await stripe.accounts.retrieve();
    out('Stripe Account', `${account.id} (${account.email ?? 'no-email'})`);
  } catch (err: any) {
    console.error('[!] Secret key invalid or network error:', err?.message);
    process.exit(1);
  }

  console.log('[ok] Secret key OK');

  console.log('\nTip: Ensure your Stripe Dashboard -> Webhooks uses the matching mode (Test vs Live) and the signing secret matches this environment.');
})();
