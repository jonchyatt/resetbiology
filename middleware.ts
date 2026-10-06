// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { auth0Edge } from '@/lib/auth0-edge';

// Jon's 2026-10-06 free-first ruling keeps these built surfaces in the
// codebase as the future build-out, but removes them from the public launch.
const HIDDEN_SURFACE_PREFIXES = [
  '/affiliates',
  '/cellular-peptide',
  '/order',
  '/pricing',
  '/product',
  '/store',
  '/subscription',
];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  console.log('Middleware running for:', pathname);

  if (pathname === '/modules' || pathname.startsWith('/modules/')) {
    return NextResponse.redirect(new URL('/audio', request.url));
  }

  if (HIDDEN_SURFACE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return NextResponse.redirect(new URL('/get-started', request.url));
  }
  
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
  
  return await auth0Edge.middleware(request);
}

// Auth0 recommends matching (almost) everything so /auth/* always works.
// This also ensures cookie/session handling is consistent server-side.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'
  ],
};