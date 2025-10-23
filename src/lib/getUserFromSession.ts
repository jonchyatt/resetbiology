// src/lib/getUserFromSession.ts
import { prisma } from '@/lib/prisma';
import type { SessionData } from '@auth0/nextjs-auth0/types';

/**
 * Gets or creates a user from an Auth0 session.
 * This function handles user auto-creation on first login.
 *
 * @param session - The Auth0 session object
 * @returns The user from the database, or null if session is invalid
 */
export async function getUserFromSession(session: SessionData | null | undefined) {
  if (!session?.user) {
    return null;
  }

  const auth0User = session.user;

  try {
    // Check if user exists by Auth0 ID
    let user = await prisma.user.findUnique({
      where: { auth0Sub: auth0User.sub }
    });

    // If not found by Auth0 ID, check by email (handles Auth0 ID changes)
    if (!user && auth0User.email) {
      user = await prisma.user.findUnique({
        where: { email: auth0User.email }
      });

      // If found by email, update their Auth0 ID
      if (user) {
        console.log(`[Auth0] Updating Auth0 ID for existing user: ${auth0User.email}`);
        user = await prisma.user.update({
          where: { id: user.id },
          data: { auth0Sub: auth0User.sub }
        });
      }
    }

    // If still no user, create a new one (auto-create on first login)
    if (!user) {
      console.log(`[Auth0] Creating new user: ${auth0User.email}`);
      user = await prisma.user.create({
        data: {
          auth0Sub: auth0User.sub,
          email: auth0User.email || '',
          name: auth0User.name || auth0User.email?.split('@')[0] || 'User',
          emailVerified: auth0User.email_verified ? new Date() : null,
        }
      });
      console.log(`[Auth0] ✅ User created successfully with ID: ${user.id}`);
    }

    return user;
  } catch (error) {
    console.error('[Auth0] ❌ Error handling user lookup/creation:', error);
    return null;
  }
}
