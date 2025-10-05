// src/lib/stripeEnv.ts

type HeaderLike = Pick<Headers, 'get'>;

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function firstEnv(...names: string[]): string | null {
  for (const name of names) {
    const value = readEnv(name);
    if (value) return value;
  }
  return null;
}

export function getStripeSecretKey(): string | null {
  return firstEnv('STRIPE_SECRET_KEY', 'STRIPE_SECRET', 'STRIPE_API_KEY');
}

export function getStripeWebhookSecret(): string | null {
  return firstEnv('STRIPE_WEBHOOK_SECRET', 'STRIPE_WEBHOOK_SIGNING_SECRET');
}

export function getStripePublishableKey(): string | null {
  return firstEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'STRIPE_PUBLISHABLE_KEY');
}

export function getPreferredAppBaseUrl(): string | null {
  return firstEnv('APP_BASE_URL', 'AUTH0_BASE_URL', 'NEXT_PUBLIC_APP_URL', 'NEXTAUTH_URL');
}

export function computeBaseUrlFromHeaders(headers: HeaderLike): string {
  const fromEnv = getPreferredAppBaseUrl();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  const host = headers.get('host');
  if (!host) return '';
  const proto = headers.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}
