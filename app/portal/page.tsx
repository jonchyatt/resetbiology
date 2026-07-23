import { redirect } from 'next/navigation';
import { auth0 } from '@/lib/auth0';
import { prisma } from '@/lib/prisma';
import { EnhancedDashboard } from '@/components/Portal/EnhancedDashboard';

export const dynamic = 'force-dynamic';

export default async function PortalPage() {
  const session = await auth0.getSession();

  if (!session) {
    redirect('/auth/login');
  }

  // The /get-started intake asks "what should we call you?" — surface that
  // name in the portal greeting. Email-keyed, so it links up on first login.
  let intakeName: string | null = null;
  const email = session.user?.email;
  if (email) {
    try {
      const intake = await prisma.nEPQSubmission.findFirst({
        where: { email },
        orderBy: { createdAt: 'desc' },
        select: { name: true },
      });
      intakeName = intake?.name?.trim() || null;
    } catch {
      // Greeting nicety only — never block the portal on it.
    }
  }

  return <EnhancedDashboard intakeName={intakeName} />;
}
