// Simplified Auth0 helpers for our custom implementation
import { NextRequest } from 'next/server';

export async function getSession(request: NextRequest) {
  // For now, check if the auth0-session cookie exists
  // In production, this should validate the JWT token
  const authCookie = request.cookies.get('auth0-session');
  
  if (authCookie?.value === 'logged-in') {
    // Mock session for development
    // In production, decode the JWT to get real user info
    return {
      user: {
        sub: 'auth0|mock-user-id',
        name: 'Test User',
        email: 'test@example.com'
      }
    };
  }
  
  return null;
}