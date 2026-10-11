import type { ReactNode } from 'react';
import { requireAdmin } from '@/lib/adminGuard';
export const dynamic = 'force-dynamic';
export default async function Layout({ children }: { children: ReactNode }) {
  await requireAdmin('/pitch-defender/crepe-benchmark');
  return <>{children}</>;
}
