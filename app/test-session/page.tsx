export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { auth0 } from '@/lib/auth0';
import { cookies } from 'next/headers';

export default async function TestSessionPage() {
  try {
    // Try getting session directly
    const session1 = await auth0.getSession();
    
    // Try getting session with cookies
    const cookieStore = await cookies();
    const session2 = await auth0.getSession(cookieStore as any);
    
    return (
      <div style={{ padding: 24, fontFamily: 'monospace' }}>
        <h1>Session Test Page</h1>
        
        <h2>Method 1: Direct getSession()</h2>
        <pre style={{ background: '#f0f0f0', padding: 10 }}>
          {JSON.stringify(session1, null, 2)}
        </pre>
        
        <h2>Method 2: getSession with cookies</h2>
        <pre style={{ background: '#f0f0f0', padding: 10 }}>
          {JSON.stringify(session2, null, 2)}
        </pre>
        
        <h2>All Cookies</h2>
        <pre style={{ background: '#f0f0f0', padding: 10 }}>
          {JSON.stringify(cookieStore.getAll().map(c => ({ name: c.name, value: c.value.substring(0, 20) + '...' })), null, 2)}
        </pre>
        
        <hr />
        <a href="/auth/debug">Back to Debug</a>
      </div>
    );
  } catch (error: any) {
    return (
      <div style={{ padding: 24, fontFamily: 'monospace' }}>
        <h1>Session Test Error</h1>
        <pre style={{ background: '#ffe0e0', padding: 10, color: 'red' }}>
          {error.message}
          {'\n'}
          {error.stack}
        </pre>
      </div>
    );
  }
}