import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Dashboard } from '@/components/Portal/Dashboard';

export const dynamic = 'force-dynamic';

export default async function PortalPage() {
  const cookieStore = await cookies();
  const authSession = cookieStore.get('auth0-session');
  
  if (!authSession) {
    redirect('/api/auth/login');
  }

  return <Dashboard />;
}