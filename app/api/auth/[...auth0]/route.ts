import { handleAuth, handleLogin } from '@auth0/nextjs-auth0';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PASSWORDLESS = process.env.AUTH0_PASSWORDLESS_CONNECTION || 'email';

// Use the official SDK so callbacks set the session cookie
export const GET = handleAuth({
  login: (req) =>
    handleLogin(req, {
      authorizationParams: {
        connection: PASSWORDLESS,
        scope: 'openid profile email',
        redirect_uri: `${process.env.AUTH0_BASE_URL}/api/auth/callback`,
      },
    }),
});

// Some flows use POST under the hood
export const POST = handleAuth();