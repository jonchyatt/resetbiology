export const runtime = 'nodejs';

function toAuth(url: URL, path: string) {
  const to = new URL(path, url.origin);
  url.searchParams.forEach((v, k) => to.searchParams.set(k, v));
  return to;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  return Response.redirect(toAuth(url, '/auth/login'), 307);
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  return Response.redirect(toAuth(url, '/auth/login'), 307);
}