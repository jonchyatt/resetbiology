import { handleAuth, handleLogin } from '@auth0/nextjs-auth0';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PASSWORDLESS = process.env.AUTH0_PASSWORDLESS_CONNECTION || 'email';

export const GET = handleAuth({
  // Force Passwordless Email and send users to /portal after login
  login: (req: NextRequest) =>
    handleLogin(req, {
      returnTo: '/portal',
      authorizationParams: {
        connection: PASSWORDLESS,
        scope: 'openid profile email',
      },
    }),
});

export const POST = handleAuth();