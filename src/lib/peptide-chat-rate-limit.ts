// ponytail: in-memory, per-serverless-instance only; NOT cross-instance-correct.
// Under Vercel scale-out each instance holds its own counters, so effective
// global limit ≈ ceiling × instanceCount. Upgrade path: back this with
// Vercel KV / Upstash (per-account, cross-instance) when a store is
// provisioned — swap the Map for the KV client, keep this interface.

// Tunable consts — endpoint-agnostic, reused by future library-wide chat.
export const CLIENT_LIMIT = 15;
export const CLIENT_WINDOW_MS = 60_000;
export const GLOBAL_LIMIT = 200;
export const GLOBAL_WINDOW_MS = 60_000;

type Window = { count: number; resetAt: number };

const clientWindows = new Map<string, Window>();
let globalWindow: Window = { count: 0, resetAt: Date.now() + GLOBAL_WINDOW_MS };

function retryAfterSec(resetAt: number): number {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
}

// Drop expired client windows on access so the Map doesn't grow unbounded.
function sweepExpiredClients(now: number) {
  for (const [key, win] of clientWindows) {
    if (now >= win.resetAt) clientWindows.delete(key);
  }
}

export type RateLimitResult =
  | { ok: true }
  | { ok: false; scope: 'client' | 'global'; retryAfterSec: number };

// `now` defaults to Date.now() — the optional override exists only so the
// colocated self-test can advance time without a real 60s sleep.
export function checkRateLimit(clientKey: string, now: number = Date.now()): RateLimitResult {
  if (now >= globalWindow.resetAt) {
    globalWindow = { count: 0, resetAt: now + GLOBAL_WINDOW_MS };
  }
  if (globalWindow.count >= GLOBAL_LIMIT) {
    return { ok: false, scope: 'global', retryAfterSec: retryAfterSec(globalWindow.resetAt) };
  }

  sweepExpiredClients(now);
  let win = clientWindows.get(clientKey);
  if (!win || now >= win.resetAt) {
    win = { count: 0, resetAt: now + CLIENT_WINDOW_MS };
    clientWindows.set(clientKey, win);
  }
  if (win.count >= CLIENT_LIMIT) {
    return { ok: false, scope: 'client', retryAfterSec: retryAfterSec(win.resetAt) };
  }

  win.count += 1;
  globalWindow.count += 1;
  return { ok: true };
}

// Derive the rate-limit key from request headers — first x-forwarded-for
// hop, then x-real-ip, then a constant fallback for unidentifiable clients.
export function deriveClientKey(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}
