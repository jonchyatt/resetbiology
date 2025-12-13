// src/lib/auth0-edge.ts
// Edge-compatible Auth0 client for middleware (no Prisma)
import { Auth0Client } from '@auth0/nextjs-auth0/server';

// Simple Auth0 client without database hooks - safe for Edge runtime
export const auth0Edge = new Auth0Client();
