import { auth0 } from '@/lib/auth0';
import { cookies } from 'next/headers';

export async function requireAdmin() {
  const cookieStore = await cookies();
  const session = await auth0.getSession(cookieStore as any);
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