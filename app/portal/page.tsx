import { redirect } from 'next/navigation';
import { auth0 } from '@/lib/auth0';
import { EnhancedDashboard } from '@/components/Portal/EnhancedDashboard';

export const dynamic = 'force-dynamic';

export default async function PortalPage() {
  const session = await auth0.getSession();
  
  if (!session) {
    redirect('/auth/login');
  }

  return <EnhancedDashboard />;
}