export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { auth0 } from '@/lib/auth0';

export default async function AuthDebugPage() {
  const session = await auth0.getSession();
  return (
    <main style={{ padding: 24 }}>
      <h1>Auth Debug</h1>
      <p>
        <a href="/auth/login?returnTo=%2Fauth%2Fdebug">Login</a> &nbsp;|&nbsp; 
        <a href="/auth/logout">Logout</a>
      </p>
      <pre>{JSON.stringify(session, null, 2)}</pre>
    </main>
  );
}