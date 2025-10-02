// middleware.ts
import type { NextRequest } from 'next/server';
import { auth0 } from '@/lib/auth0';

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
  
  return await auth0.middleware(request);
}

// Auth0 recommends matching (almost) everything so /auth/* always works.
// This also ensures cookie/session handling is consistent server-side.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'
  ],
};