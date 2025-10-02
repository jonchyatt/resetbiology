export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { auth0 } from '@/lib/auth0';
import { prisma } from '@/lib/prisma';

export default async function AdminTestPage() {
  try {
    // Get session
    const session = await auth0.getSession();
    
    if (!session?.user) {
      return (
        <div style={{ padding: 24 }}>
          <h1>Admin Test - No Session</h1>
          <p>You are not logged in.</p>
          <a href="/auth/login?returnTo=/admin/test">Login</a>
        </div>
      );
    }
    
    const email = (session.user.email || '').toLowerCase();
    const dbUser = email ? await prisma.user.findUnique({ where: { email } }) : null;
    
    const checks = {
      sessionEmail: email,
      sessionUserId: session.user.sub,
      dbUserFound: !!dbUser,
      dbUserId: dbUser?.id,
      dbUserRole: dbUser?.role,
      dbUserAccessLevel: dbUser?.accessLevel,
      isAdminViaRole: dbUser?.role === 'admin',
      isAdminViaAccessLevel: dbUser?.accessLevel === 'admin',
      isAdminFinal: dbUser?.role === 'admin' || dbUser?.accessLevel === 'admin',
    };
    
    return (
      <div style={{ padding: 24, fontFamily: 'monospace' }}>
        <h1>Admin Test Page - Debug Info</h1>
        
        <h2>Session Info:</h2>
        <pre style={{ background: '#f0f0f0', padding: 10 }}>
          {JSON.stringify(session.user, null, 2)}
        </pre>
        
        <h2>Admin Checks:</h2>
        <pre style={{ background: checks.isAdminFinal ? '#e0ffe0' : '#ffe0e0', padding: 10 }}>
          {JSON.stringify(checks, null, 2)}
        </pre>
        
        {checks.isAdminFinal ? (
          <div style={{ background: '#e0ffe0', padding: 20, marginTop: 20 }}>
            <h2>✅ You ARE an admin!</h2>
            <p>You should be able to access:</p>
            <ul>
              <li><a href="/admin/store">Admin Store</a></li>
              <li><a href="/admin/db">Admin DB</a></li>
            </ul>
          </div>
        ) : (
          <div style={{ background: '#ffe0e0', padding: 20, marginTop: 20 }}>
            <h2>❌ You are NOT an admin</h2>
            <p>To fix this, your user needs either:</p>
            <ul>
              <li>role: "admin" in the database</li>
              <li>accessLevel: "admin" in the database</li>
            </ul>
            <p>Current values: role={dbUser?.role || 'null'}, accessLevel={dbUser?.accessLevel || 'null'}</p>
          </div>
        )}
        
        <hr style={{ margin: '20px 0' }} />
        <a href="/auth/debug">Back to Auth Debug</a>
      </div>
    );
  } catch (error: any) {
    return (
      <div style={{ padding: 24, fontFamily: 'monospace' }}>
        <h1>Admin Test Error</h1>
        <pre style={{ background: '#ffe0e0', padding: 10, color: 'red' }}>
          {error.message}
          {'\n'}
          {error.stack}
        </pre>
      </div>
    );
  }
}