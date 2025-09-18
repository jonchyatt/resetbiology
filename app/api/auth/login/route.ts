export const runtime = 'nodejs';

function toAuth(url: URL, path: string) {
  const to = new URL(path, url.origin);
  url.searchParams.forEach((v, k) => to.searchParams.set(k, v));
  return to;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  console.log('[LEGACY SHIM] /api/auth/login → /auth/login', url.searchParams.toString());
  return Response.redirect(toAuth(url, '/auth/login'), 307);
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  console.log('[LEGACY SHIM] POST /api/auth/login → /auth/login', url.searchParams.toString());
  return Response.redirect(toAuth(url, '/auth/login'), 307);
}