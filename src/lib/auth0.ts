// src/lib/auth0.ts
import { Auth0Server } from '@auth0/nextjs-auth0';

// Auth0 v4 SDK uses standard environment variable names
// No need to pass them explicitly if they follow the naming convention
export const auth0 = new Auth0Server();