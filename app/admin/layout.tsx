import { ReactNode } from 'react';
import { requireAdmin } from '@/lib/adminGuard';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin('/admin');
  return <>{children}</>;
}
