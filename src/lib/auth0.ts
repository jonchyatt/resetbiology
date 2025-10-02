// src/lib/auth0.ts
import { Auth0Client } from '@auth0/nextjs-auth0/server';

// Auth0 v4 SDK uses standard environment variable names
// No need to pass them explicitly if they follow the naming convention
export const auth0 = new Auth0Client();