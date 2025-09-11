// middleware.ts
import type { NextRequest } from 'next/server';
import { auth0 } from '@/lib/auth0';

// Let the SDK mount /auth/* and manage session cookies
export async function middleware(request: NextRequest) {
  return auth0.middleware(request);
}

// Auth0 recommends matching (almost) everything so /auth/* always works.
// This also ensures cookie/session handling is consistent server-side.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'
  ],
};