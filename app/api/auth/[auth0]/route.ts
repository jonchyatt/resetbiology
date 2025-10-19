import { handleAuth, handleCallback, Session } from '@auth0/nextjs-auth0';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Extend Auth0's callback to auto-create users in our database
async function afterCallback(req: NextRequest, session: Session) {
  if (session?.user) {
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

      // If still no user, create a new one
      if (!user) {
        console.log(`[Auth0] Creating new user: ${auth0User.email}`);
        user = await prisma.user.create({
          data: {
            auth0Sub: auth0User.sub,
            email: auth0User.email || '',
            name: auth0User.name || auth0User.email?.split('@')[0] || 'User',
            emailVerified: auth0User.email_verified || false,
          }
        });
        console.log(`[Auth0] ✅ User created successfully with ID: ${user.id}`);
      } else {
        console.log(`[Auth0] ✅ User already exists: ${user.email} (ID: ${user.id})`);
      }
    } catch (error) {
      console.error('[Auth0] ❌ Error handling user creation:', error);
      // Don't fail the login if user creation fails - Auth0 session still works
      // But log the error so we can investigate
    }
  }

  return session;
}

// Export Auth0 route handlers with our custom callback
export const GET = handleAuth({
  callback: handleCallback({ afterCallback })
});
