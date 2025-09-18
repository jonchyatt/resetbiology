export const runtime = 'nodejs';

export async function GET(req: Request) {
  const from = new URL(req.url);
  console.log('[LEGACY SHIM] /api/auth/callback → /auth/callback', from.searchParams.toString());
  const to = new URL('/auth/callback', from.origin);
  from.searchParams.forEach((v, k) => to.searchParams.set(k, v));
  return Response.redirect(to, 307);
}