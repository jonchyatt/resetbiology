// app/portal/page.tsx
import { auth0 } from '@/lib/auth0';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function PortalPage() {
  const session = await auth0.getSession();
  if (!session?.user) redirect('/api/auth/login');

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Your Portal</h1>
      <p className="mt-2">Signed in as {session.user.email}</p>

      <div className="mt-6 grid gap-4">
        <a href="/api/auth/logout" className="underline">Sign out</a>
        {/* TODO: add dashboard widgets here (orders, peptides, etc.) */}
      </div>
    </main>
  );
}