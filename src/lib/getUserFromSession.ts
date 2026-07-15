// src/lib/getUserFromSession.ts
import { prisma } from '@/lib/prisma';
import type { SessionData } from '@auth0/nextjs-auth0/types';
import type { User } from '@prisma/client';

/**
 * Discriminated result of resolving a Prisma User from an Auth0 session.
 * - 'ok': resolved (existing sub match, verified-email reattach, or fresh create)
 * - 'unverified_email': an existing User row owns this email, but the session's
 *   email is not verified — the caller must NOT merge and must NOT create a
 *   second row for the same email (split-brain). Surface as 403 verify_email.
 */
export type UserResolution =
  | { status: 'ok'; user: User }
  | { status: 'unverified_email'; email: string };

/**
 * Resolves (or creates) a Prisma User from an Auth0 session, guarding the
 * email-fallback reattach path: it only fires when the session's email is
 * VERIFIED (Auth0 `email_verified === true` on session.user — the claim is
 * absent unless Auth0 populated it, so absence is treated as NOT verified).
 *
 * @param session - The Auth0 session object
 * @returns UserResolution, or null if the session itself is invalid
 */
export async function resolveUserFromSession(
  session: SessionData | null | undefined
): Promise<UserResolution | null> {
  console.log('[getUserFromSession] Called with session:', session ? 'EXISTS' : 'NULL');

  if (!session?.user) {
    console.log('[getUserFromSession] No session or user, returning null');
    return null;
  }

  const auth0User = session.user;
  const emailVerified = auth0User.email_verified === true;
  console.log('[getUserFromSession] Auth0 user:', {
    sub: auth0User.sub,
    email: auth0User.email,
    name: auth0User.name,
    emailVerified
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
      const existingByEmail = await prisma.user.findUnique({
        where: { email: auth0User.email }
      });
      console.log('[getUserFromSession] User found by email:', existingByEmail ? 'YES' : 'NO');

      if (existingByEmail && !emailVerified) {
        // Unverified email + an existing row with that email: do NOT merge,
        // do NOT create a fresh user (would split-brain the same email).
        console.log('[getUserFromSession] Blocking merge: unverified email matches existing user', auth0User.email);
        return { status: 'unverified_email', email: auth0User.email };
      }

      if (existingByEmail) {
        // Verified reattach of a new sub to an existing user.
        console.log(`[getUserFromSession] Updating Auth0 ID for existing user: ${auth0User.email}`);
        user = await prisma.user.update({
          where: { id: existingByEmail.id },
          data: { auth0Sub: auth0User.sub }
        });
        console.log('[identity-merge]', {
          existingUserId: existingByEmail.id,
          newSub: auth0User.sub,
          email: auth0User.email,
          emailVerified: true
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
          rbClientId: `rb_${Date.now()}_${Math.random().toString(36).substring(7)}`, // Generate unique ID
        }
      });
      console.log(`[getUserFromSession] ✅ User created successfully! ID: ${user.id}, Email: ${user.email}`);
    } else {
      console.log('[getUserFromSession] Returning existing user:', user.email);
    }

    return { status: 'ok', user };
  } catch (error) {
    console.error('[getUserFromSession] ❌ ERROR in user lookup/creation:', error);
    console.error('[getUserFromSession] Error details:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Backward-compatible wrapper for the ~45 existing callers that only handle
 * `User | null`. The unverified-email backstop collapses to `null` here
 * (same shape as "no user found" — those callers already 404/401 on null),
 * so this is a non-breaking addition. Callers that need to distinguish the
 * verify-email case (e.g. API routes that should return 403 verify_email)
 * should call `resolveUserFromSession` directly instead.
 *
 * @param session - The Auth0 session object
 * @returns The user from the database, or null if session is invalid,
 *   creation failed, or the email-verification guard blocked the merge.
 */
export async function getUserFromSession(session: SessionData | null | undefined): Promise<User | null> {
  const result = await resolveUserFromSession(session);
  if (!result || result.status !== 'ok') return null;
  return result.user;
}
