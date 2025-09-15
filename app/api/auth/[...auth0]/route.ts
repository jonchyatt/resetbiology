// app/api/auth/[...auth0]/route.ts
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ auth0: string[] }> }) {
  const { auth0 } = await params;
  const path = auth0[0]; // Get the first segment (login, logout, callback)
  
  if (path === 'login') {
    // Redirect to Auth0 login
    // Use production URL if we're on resetbiology.com, otherwise localhost
    const baseUrl = request.headers.get('host')?.includes('resetbiology.com') 
      ? 'https://resetbiology.com' 
      : process.env.AUTH0_BASE_URL;
    
    const authParams = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.AUTH0_CLIENT_ID!,
      redirect_uri: `${baseUrl}/api/auth/callback`,
      scope: 'openid profile email',
      state: 'randomState'
    });
    
    const loginUrl = `${process.env.AUTH0_ISSUER_BASE_URL}/authorize?${authParams}`;
    return Response.redirect(loginUrl);
  }
  
  if (path === 'logout') {
    // Clear the session cookie and redirect to Auth0 logout
    const logoutUrl = `${process.env.AUTH0_ISSUER_BASE_URL}/v2/logout?returnTo=${encodeURIComponent(process.env.AUTH0_BASE_URL!)}`;
    const headers = new Headers();
    headers.set('Location', logoutUrl);
    headers.set('Set-Cookie', 'auth0-session=; Path=/; HttpOnly; Max-Age=0');
    
    return new Response(null, {
      status: 302,
      headers: headers
    });
  }
  
  if (path === 'callback') {
    // Handle OAuth callback
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    
    if (code) {
      // Exchange code for tokens (simplified for now)
      // TODO: Implement proper token exchange and session creation
      
      // For now, set a simple cookie to indicate logged in status
      const baseUrl = request.headers.get('host')?.includes('resetbiology.com') 
        ? 'https://resetbiology.com' 
        : process.env.AUTH0_BASE_URL;
      
      const headers = new Headers();
      headers.set('Location', `${baseUrl}/portal`);
      headers.set('Set-Cookie', 'auth0-session=logged-in; Path=/; HttpOnly');
      
      return new Response(null, {
        status: 302,
        headers: headers
      });
    }
    
    return new Response('Callback handled', { status: 200 });
  }
  
  return new Response(`Auth endpoint: ${path}`, { status: 200 });
}