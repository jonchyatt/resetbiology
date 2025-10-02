// src/scripts/stripe-doctor.ts
// Run with: node --env-file=.env.local -r ts-node/register src/scripts/stripe-doctor.ts
import Stripe from 'stripe';

function out(label: string, value: unknown) {
  console.log(`${label}:`, value ?? '(missing)');
}

(async () => {
  const secret = process.env.STRIPE_SECRET_KEY;
  const whsec  = process.env.STRIPE_WEBHOOK_SECRET;
  const base   = process.env.APP_BASE_URL;

  console.log('--- Stripe Doctor ---');
  out('STRIPE_SECRET_KEY present', !!secret);
  out('STRIPE_WEBHOOK_SECRET present', !!whsec);
  out('APP_BASE_URL', base || '(using runtime host fallback)');

  if (!secret) {
    console.error('✖ No STRIPE_SECRET_KEY. Doctor cannot continue.');
    process.exit(1);
  }

  const stripe = new Stripe(secret, { apiVersion: '2025-08-27.basil' });

  try {
    const account = await stripe.accounts.retrieve();
    out('Stripe Account', `${account.id} (${account.email ?? 'no-email'})`);
  } catch (err: any) {
    console.error('✖ Secret key invalid or network error:', err?.message);
    process.exit(1);
  }

  console.log('✓ Secret key OK');

  console.log('\nTip: Ensure your Stripe Dashboard → Webhooks uses the matching mode (Test vs Live) and the signing secret matches this environment.');
})();