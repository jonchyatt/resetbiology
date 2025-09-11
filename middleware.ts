import type { NextRequest } from 'next/server';
import { auth0 } from '@/lib/auth0';

export async function middleware(request: NextRequest) {
  // Let the SDK mount /auth/* routes and manage the session
  return auth0.middleware(request);
}

// Only guard these app areas (keep home and public routes open)
export const config = {
  matcher: ['/portal/:path*', '/admin/:path*', '/auth/:path*'],
};