import { getSession } from '@auth0/nextjs-auth0';

export async function requireAdmin() {
  const session = await getSession();
  if (!session?.user) {
    const err: any = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
  const role =
    (session.user as any)?.['https://resetbiology.com/claims/role'] ||
    (session.user as any)?.role ||
    'basic';
  if (role !== 'admin') {
    const err: any = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  return session;
}