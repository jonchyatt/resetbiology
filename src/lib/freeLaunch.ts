// Free-first launch gate (replayed from the unmerged 2026-10-06 stack).
// Pure and edge-safe: imported by middleware.ts, no Node or Prisma deps.
// Everything here is inert unless NEXT_PUBLIC_FREE_LAUNCH === 'on'.

export const HIDDEN_SURFACE_PREFIXES = [
  '/affiliates',
  '/breath',
  '/cellular-peptide',
  '/education',
  '/order',
  '/pricing',
  '/product',
  '/store',
  '/subscription',
] as const

// The only app routes that reference OPENAI_API_KEY at the time of the port.
export const BLOCKED_PAID_AI_API_PATHS: ReadonlySet<string> = new Set([
  '/api/foods/analyze-image',
  '/api/voice/chat',
])

export type FreeLaunchDecision =
  | { action: 'pass' }
  | { action: 'block'; status: 404; error: string }
  | { action: 'redirect'; to: string }

export function isFreeLaunchOn(env: Record<string, string | undefined> = process.env): boolean {
  return env.NEXT_PUBLIC_FREE_LAUNCH === 'on'
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function decideFreeLaunch(pathname: string, on: boolean): FreeLaunchDecision {
  if (!on) return { action: 'pass' }
  if (BLOCKED_PAID_AI_API_PATHS.has(pathname)) {
    return { action: 'block', status: 404, error: 'Paid AI is unavailable during the free-first launch.' }
  }
  if (matchesPrefix(pathname, '/modules')) return { action: 'redirect', to: '/audio' }
  if (HIDDEN_SURFACE_PREFIXES.some((p) => matchesPrefix(pathname, p))) {
    return { action: 'redirect', to: '/get-started' }
  }
  return { action: 'pass' }
}
