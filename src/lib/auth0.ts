// src/lib/auth0.ts
import { Auth0Client } from '@auth0/nextjs-auth0/server';

export const auth0 = new Auth0Client({
  // Pick up values from env (AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, AUTH0_SECRET, APP_BASE_URL)
  // Optional tuning:
  authorizationParameters: {
    // If your Passwordless connection has a custom name, set AUTH0_PASSWORDLESS_CONNECTION env and uncomment next line:
    // connection: process.env.AUTH0_PASSWORDLESS_CONNECTION || 'email',
    scope: 'openid profile email',
  },
  // Redirect to Portal after login:
  signInReturnToPath: '/portal',
});