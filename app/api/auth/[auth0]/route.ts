import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Simplified Auth0 implementation due to Next.js 15 compatibility issues
export async function GET(request: Request, { params }: { params: Promise<{ auth0: string }> }) {
  const { auth0 } = await params;
  
  // Redirect to Auth0 login for simplified implementation
  if (auth0 === 'login') {
    const authUrl = `${process.env.AUTH0_ISSUER_BASE_URL}/authorize?response_type=code&client_id=${process.env.AUTH0_CLIENT_ID}&redirect_uri=${process.env.AUTH0_BASE_URL}/api/auth/callback&scope=openid%20profile%20email&connection=email`;
    return NextResponse.redirect(authUrl);
  }
  
  // Redirect to Auth0 logout
  if (auth0 === 'logout') {
    const logoutUrl = `${process.env.AUTH0_ISSUER_BASE_URL}/v2/logout?client_id=${process.env.AUTH0_CLIENT_ID}&returnTo=${process.env.AUTH0_BASE_URL}`;
    return NextResponse.redirect(logoutUrl);
  }
  
  // Basic callback handling - simplified for compatibility
  if (auth0 === 'callback') {
    return NextResponse.redirect(`${process.env.AUTH0_BASE_URL}/portal`);
  }
  
  // User profile endpoint
  if (auth0 === 'me') {
    return NextResponse.json({ user: null });
  }
  
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// Add POST for callback/logout that use POST under the hood
export async function POST(request: Request, { params }: { params: Promise<{ auth0: string }> }) {
  // Handle POST requests the same way as GET for simplified implementation
  return GET(request, { params });
}