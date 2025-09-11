import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Simplified Auth0 implementation due to Next.js 15 compatibility issues
export async function GET(request: Request, { params }: { params: Promise<{ auth0: string[] }> }) {
  const { auth0 } = await params;
  const action = auth0[0]; // First segment of catch-all route
  
  // Redirect to Auth0 login for simplified implementation
  if (action === 'login') {
    const base = process.env.AUTH0_ISSUER_BASE_URL!;
    const clientId = process.env.AUTH0_CLIENT_ID!;
    const redirect = `${process.env.AUTH0_BASE_URL}/api/auth/callback`;
    const connection = process.env.AUTH0_PASSWORDLESS_CONNECTION || 'email';
    const url = `${base}/authorize?client_id=${encodeURIComponent(clientId)}&response_type=code&redirect_uri=${encodeURIComponent(redirect)}&scope=openid%20profile%20email&connection=${encodeURIComponent(connection)}`;
    return NextResponse.redirect(url);
  }
  
  // Redirect to Auth0 logout
  if (action === 'logout') {
    const logoutUrl = `${process.env.AUTH0_ISSUER_BASE_URL}/v2/logout?client_id=${process.env.AUTH0_CLIENT_ID}&returnTo=${process.env.AUTH0_BASE_URL}`;
    return NextResponse.redirect(logoutUrl);
  }
  
  // Basic callback handling - simplified for compatibility
  if (action === 'callback') {
    return NextResponse.redirect(`${process.env.AUTH0_BASE_URL}/portal`);
  }
  
  // User profile endpoint
  if (action === 'me') {
    return NextResponse.json({ user: null });
  }
  
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// Some flows (callback/logout) hit POST
export async function POST(request: Request, { params }: { params: Promise<{ auth0: string[] }> }) {
  // Handle POST requests the same way as GET for simplified implementation
  return GET(request, { params });
}