import { auth0 } from '@/lib/auth0';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Auth0 v4 dynamic route handler
// Handles: /auth/login, /auth/logout, /auth/callback, /auth/me
const handler = auth0.handleAuth();

export { handler as GET, handler as POST };