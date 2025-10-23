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
  console.log('[getUserFromSession] Called with session:', session ? 'EXISTS' : 'NULL');

  if (!session?.user) {
    console.log('[getUserFromSession] No session or user, returning null');
    return null;
  }

  const auth0User = session.user;
  console.log('[getUserFromSession] Auth0 user:', {
    sub: auth0User.sub,
    email: auth0User.email,
    name: auth0User.name
  });

  try {
    // Check if user exists by Auth0 ID
    console.log('[getUserFromSession] Looking up user by auth0Sub:', auth0User.sub);
    let user = await prisma.user.findUnique({
      where: { auth0Sub: auth0User.sub }
    });
    console.log('[getUserFromSession] User found by auth0Sub:', user ? 'YES' : 'NO');

    // If not found by Auth0 ID, check by email (handles Auth0 ID changes)
    if (!user && auth0User.email) {
      console.log('[getUserFromSession] Looking up user by email:', auth0User.email);
      user = await prisma.user.findUnique({
        where: { email: auth0User.email }
      });
      console.log('[getUserFromSession] User found by email:', user ? 'YES' : 'NO');

      // If found by email, update their Auth0 ID
      if (user) {
        console.log(`[getUserFromSession] Updating Auth0 ID for existing user: ${auth0User.email}`);
        user = await prisma.user.update({
          where: { id: user.id },
          data: { auth0Sub: auth0User.sub }
        });
        console.log('[getUserFromSession] Auth0 ID updated successfully');
      }
    }

    // If still no user, create a new one (auto-create on first login)
    if (!user) {
      console.log(`[getUserFromSession] 🚀 CREATING NEW USER: ${auth0User.email}`);
      console.log('[getUserFromSession] User data:', {
        auth0Sub: auth0User.sub,
        email: auth0User.email,
        name: auth0User.name || auth0User.email?.split('@')[0] || 'User'
      });

      user = await prisma.user.create({
        data: {
          auth0Sub: auth0User.sub,
          email: auth0User.email || '',
          name: auth0User.name || auth0User.email?.split('@')[0] || 'User',
          emailVerified: auth0User.email_verified ? new Date() : null,
        }
      });
      console.log(`[getUserFromSession] ✅ User created successfully! ID: ${user.id}, Email: ${user.email}`);
    } else {
      console.log('[getUserFromSession] Returning existing user:', user.email);
    }

    return user;
  } catch (error) {
    console.error('[getUserFromSession] ❌ ERROR in user lookup/creation:', error);
    console.error('[getUserFromSession] Error details:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}
