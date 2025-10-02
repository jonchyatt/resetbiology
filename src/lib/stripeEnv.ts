// src/lib/stripeEnv.ts
export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

// Publishable key is optional for our current flow.
// Accept either naming if present. Never required.
export const STRIPE_PUBLISHABLE =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ??
  process.env.STRIPE_PUBLISHABLE_KEY ??
  '';

// We prefer APP_BASE_URL but allow runtime host fallback if absent.
// Provide a helper for server-only usage.
export function computeBaseUrlFromHeaders(headers: Headers) {
  const fromEnv = process.env.APP_BASE_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  const host = headers.get('host');
  if (!host) return '';
  return `https://${host}`;
}