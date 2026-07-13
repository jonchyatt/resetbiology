// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { auth0Edge } from '@/lib/auth0-edge';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  console.log('Middleware running for:', pathname);

  // Log domain check for auth routes (helps debug "state parameter invalid" errors)
  if (pathname.startsWith('/auth/') || pathname.startsWith('/admin/')) {
    try {
      const { logDomainCheck } = await import('@/lib/domainCheck');
      await logDomainCheck(`Middleware - ${pathname}`);
    } catch (err) {
      // Domain check is optional, don't fail if it errors
      console.error('Domain check failed:', err);
    }
  }

  try {
    return await auth0Edge.middleware(request);
  } catch (err) {
    // A malformed/corrupted session cookie (attacker-supplied or stale after a
    // secret rotation) throws JWEInvalid uncaught inside the SDK, which Next.js
    // was turning into a site-wide 500 (stack trace leaked in the response body)
    // for EVERY route this matcher covers, before any route handler could run.
    // Fail open to anonymous instead: clear the bad cookie(s), let the request
    // continue — route/page-level guards (requireAdmin/requireSession/etc.)
    // still gate anything that actually needs a session.
    console.error('[middleware] auth0Edge.middleware threw, clearing session cookie:', err);
    const res = NextResponse.next();
    // Auth0 v4 default cookie is '__session'; 'appSession' is the legacy name
    // (still recognized for migration). Either can be chunked ('__session.0',
    // '__session.1', ...) for oversized sessions — clear every matching cookie
    // by prefix, not just the exact base name, so a chunked malformed session
    // doesn't keep re-triggering this catch on every subsequent request.
    for (const cookie of request.cookies.getAll()) {
      if (cookie.name === '__session' || cookie.name.startsWith('__session.') ||
          cookie.name === 'appSession' || cookie.name.startsWith('appSession.')) {
        res.cookies.delete(cookie.name);
      }
    }
    return res;
  }
}

// Auth0 recommends matching (almost) everything so /auth/* always works.
// This also ensures cookie/session handling is consistent server-side.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'
  ],
};