import { auth0 } from '@/lib/auth0';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';

/**
 * Server-only admin guard.
 * - If not authenticated => redirect to /auth/login with ?returnTo=...
 * - If authenticated but not admin => redirect to /portal
 * - Admin if: Auth0 claim role === 'admin' OR Mongo user role/accessLevel === 'admin'
 */
export async function requireAdmin(returnTo: string = '/portal') {
  const session = await auth0.getSession();

  // Not signed in → go login and come back
  if (!session?.user) {
    const rt = encodeURIComponent(returnTo);
    redirect(`/auth/login?returnTo=${rt}`);
  }

  // Try role from Auth0 token claim
  const claimRole =
    (session.user as any)?.['https://resetbiology.com/claims/role'] ||
    (session.user as any)?.role ||
    null;

  // Try DB user
  const email = (session.user.email || '').toLowerCase();
  const dbUser = email
    ? await prisma.user.findUnique({ where: { email } })
    : null;

  const isAdmin =
    claimRole === 'admin' ||
    dbUser?.role === 'admin' ||
    dbUser?.accessLevel === 'admin';

  if (!isAdmin) {
    redirect('/portal');
  }

  return { session, dbUser };
}

/**
 * API-route variant: returns true/false instead of redirecting,
 * so JSON handlers can respond 401 rather than 307-to-login.
 */
export async function isAdminRequest(): Promise<boolean> {
  try {
    const session = await auth0.getSession();
    if (!session?.user) return false;

    const claimRole =
      (session.user as any)?.['https://resetbiology.com/claims/role'] ||
      (session.user as any)?.role ||
      null;
    if (claimRole === 'admin') return true;

    const email = (session.user.email || '').toLowerCase();
    const dbUser = email
      ? await prisma.user.findUnique({ where: { email } })
      : null;
    return dbUser?.role === 'admin' || dbUser?.accessLevel === 'admin';
  } catch {
    return false;
  }
}

/**
 * API-route variant for any-authenticated-user gating (not admin-only):
 * returns true if a valid session exists, so JSON handlers can respond 401.
 */
export async function requireSession(): Promise<boolean> {
  try {
    const session = await auth0.getSession();
    return !!session?.user;
  } catch {
    return false;
  }
}