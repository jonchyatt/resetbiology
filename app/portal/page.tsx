import { getSession } from '@auth0/nextjs-auth0';
import { redirect } from 'next/navigation';
import { upsertUserFromAuth0 } from '@/lib/users/upsertFromAuth0';

export const dynamic = 'force-dynamic';

export default async function PortalPage() {
  const session = await getSession();
  if (!session?.user) redirect('/api/auth/login');

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
      <p className="mt-4"><a href="/api/auth/logout">Sign out</a></p>
    </main>
  );
}