// app/portal/page.tsx
import { redirect } from 'next/navigation';
import { auth0 } from '@/lib/auth0';
import { upsertUserFromAuth0 } from '@/lib/users/upsertFromAuth0';

export const dynamic = 'force-dynamic';

export default async function PortalPage() {
  const session = await auth0.getSession();
  if (!session) redirect('/auth/login');

  await upsertUserFromAuth0({
    sub: session.user.sub!,
    email: session.user.email as string | undefined,
    name: session.user.name as string | undefined,
    picture: session.user.picture as string | undefined,
  });

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Your Portal</h1>
      <p>Signed in as {session.user.email}</p>
      <p className="mt-4"><a href="/auth/logout">Sign out</a></p>
    </main>
  );
}