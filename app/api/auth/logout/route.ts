export const runtime = 'nodejs';

export async function GET(req: Request) {
  const from = new URL(req.url);
  const to = new URL('/auth/logout', from.origin);
  from.searchParams.forEach((v, k) => to.searchParams.set(k, v));
  return Response.redirect(to, 307);
}