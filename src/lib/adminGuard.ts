import { auth0 } from '@/lib/auth0';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';

/**
 * Server-only admin guard.
 * - Redirects to /auth/login if unauthenticated
 * - Redirects to /portal if not an admin
 * - Accepts admin if ANY of:
 *    - Auth0 token claim role === 'admin'
 *    - Mongo user role === 'admin'
 *    - Mongo user accessLevel === 'admin'
 */
export async function requireAdmin() {
  // Get session via cookies (server-side)
  const cookieStore = await cookies();
  const session = await auth0.getSession(cookieStore as any);

  // Not signed in → go login
  if (!session?.user) {
    redirect('/auth/login');
  }

  // 1) Try role from Auth0 token claims
  const claimRole =
    (session.user as any)?.['https://resetbiology.com/claims/role'] ||
    (session.user as any)?.role ||
    null;

  // 2) Try Mongo user
  const email = (session.user.email || '').toLowerCase();
  const dbUser = email
    ? await prisma.user.findUnique({ where: { email } })
    : null;

  const isAdmin =
    claimRole === 'admin' ||
    dbUser?.role === 'admin' ||
    dbUser?.accessLevel === 'admin';

  if (!isAdmin) {
    // Signed in but not an admin → send to portal
    redirect('/portal');
  }

  return { session, dbUser };
}