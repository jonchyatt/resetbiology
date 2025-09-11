// app/lib/auth0.ts
import { Auth0Client } from '@auth0/nextjs-auth0/server';

export const auth0 = new Auth0Client({
  // Force passwordless Email connection + standard OIDC scope
  authorizationParameters: {
    connection: process.env.AUTH0_PASSWORDLESS_CONNECTION || 'email',
    scope: 'openid profile email',
    prompt: 'login', // force interactive Universal Login the first time
  },
  appBaseUrl: process.env.APP_BASE_URL,       // e.g. https://resetbiology.com
  signInReturnToPath: '/portal',              // where to land after login
  // All other values (domain, clientId, clientSecret, secret) are read from env
});