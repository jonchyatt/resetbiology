export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { auth0 } from '@/lib/auth0';
import { cookies } from 'next/headers';
import { headers } from 'next/headers';

export default async function AuthDebugPage() {
  const session = await auth0.getSession();
  const cookieStore = await cookies();
  const headersList = await headers();
  
  // Get important debug information
  const requestHost = headersList.get('host') || 'unknown';
  const forwardedHost = headersList.get('x-forwarded-host') || null;
  const forwardedProto = headersList.get('x-forwarded-proto') || 'http';
  const userAgent = headersList.get('user-agent') || 'unknown';
  
  // Construct the actual URL being accessed
  const actualUrl = `${forwardedProto}://${forwardedHost || requestHost}`;
  
  // Get Auth0 configuration (safely, without exposing secrets)
  const auth0Config = {
    AUTH0_ISSUER_BASE_URL: process.env.AUTH0_ISSUER_BASE_URL || '❌ NOT SET',
    AUTH0_BASE_URL: process.env.AUTH0_BASE_URL || '❌ NOT SET',
    AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID ? '✅ Set' : '❌ NOT SET',
    AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET ? '✅ Set' : '❌ NOT SET',
    AUTH0_SECRET: process.env.AUTH0_SECRET ? `✅ Set (${process.env.AUTH0_SECRET.length} chars)` : '❌ NOT SET',
  };
  
  // Check for domain mismatches
  const domainMismatch = process.env.AUTH0_BASE_URL && process.env.AUTH0_BASE_URL !== actualUrl;
  
  // Get all cookies (for debugging)
  const allCookies = cookieStore.getAll();
  const auth0Cookies = allCookies.filter(c => 
    c.name.includes('auth0') || 
    c.name.includes('state') || 
    c.name.includes('nonce') ||
    c.name.includes('session')
  );
  
  return (
    <main style={{ padding: 24, fontFamily: 'monospace' }}>
      <h1>🔍 Auth0 Debug Page</h1>
      
      {/* Quick Actions */}
      <div style={{ margin: '20px 0', padding: '15px', background: '#f0f0f0', borderRadius: '5px' }}>
        <h2>Quick Actions:</h2>
        {!session ? (
          <>
            <a 
              href="/auth/login?returnTo=%2Fauth%2Fdebug" 
              style={{ 
                display: 'inline-block', 
                padding: '10px 20px', 
                background: '#0066cc', 
                color: 'white', 
                textDecoration: 'none',
                borderRadius: '5px',
                marginRight: '10px'
              }}
            >
              🔐 Login
            </a>
            <span style={{ color: '#666' }}>← Click to test Auth0 login flow</span>
          </>
        ) : (
          <>
            <a 
              href="/auth/logout" 
              style={{ 
                display: 'inline-block', 
                padding: '10px 20px', 
                background: '#cc0000', 
                color: 'white', 
                textDecoration: 'none',
                borderRadius: '5px',
                marginRight: '10px'
              }}
            >
              🚪 Logout
            </a>
            <a 
              href="/admin/store" 
              style={{ 
                display: 'inline-block', 
                padding: '10px 20px', 
                background: '#00cc00', 
                color: 'white', 
                textDecoration: 'none',
                borderRadius: '5px',
                marginRight: '10px'
              }}
            >
              🛍️ Admin Store
            </a>
          </>
        )}
      </div>

      {/* Domain Mismatch Warning */}
      {domainMismatch && (
        <div style={{ 
          background: '#ffe0e0', 
          border: '2px solid #ff0000', 
          padding: '15px', 
          borderRadius: '5px',
          margin: '20px 0'
        }}>
          <h2 style={{ color: '#ff0000' }}>⚠️ DOMAIN MISMATCH DETECTED!</h2>
          <p><strong>Actual URL:</strong> {actualUrl}</p>
          <p><strong>AUTH0_BASE_URL:</strong> {process.env.AUTH0_BASE_URL}</p>
          <p style={{ color: '#cc0000' }}>
            This mismatch will cause "state parameter is invalid" errors!<br/>
            Fix: Update AUTH0_BASE_URL in Vercel to match: {actualUrl}
          </p>
        </div>
      )}

      {/* Session Status */}
      <div style={{ 
        background: session ? '#e0ffe0' : '#ffe0e0', 
        padding: '15px', 
        borderRadius: '5px',
        margin: '20px 0'
      }}>
        <h2>Session Status: {session ? '✅ Logged In' : '❌ Not Logged In'}</h2>
        {session && (
          <div>
            <p><strong>User Email:</strong> {session.user?.email || 'Not available'}</p>
            <p><strong>User Name:</strong> {session.user?.name || 'Not available'}</p>
            <p><strong>User ID:</strong> {session.user?.sub || 'Not available'}</p>
          </div>
        )}
      </div>

      {/* Environment Configuration */}
      <details open>
        <summary style={{ cursor: 'pointer', fontSize: '18px', fontWeight: 'bold', margin: '20px 0' }}>
          📋 Auth0 Configuration
        </summary>
        <pre style={{ background: '#f5f5f5', padding: '15px', borderRadius: '5px', overflow: 'auto' }}>
{JSON.stringify(auth0Config, null, 2)}
        </pre>
      </details>

      {/* Request Information */}
      <details open>
        <summary style={{ cursor: 'pointer', fontSize: '18px', fontWeight: 'bold', margin: '20px 0' }}>
          🌐 Request Information
        </summary>
        <pre style={{ background: '#f5f5f5', padding: '15px', borderRadius: '5px', overflow: 'auto' }}>
{JSON.stringify({
  'Actual URL Being Accessed': actualUrl,
  'Request Host': requestHost,
  'X-Forwarded-Host': forwardedHost,
  'X-Forwarded-Proto': forwardedProto,
  'User Agent': userAgent.substring(0, 50) + '...',
}, null, 2)}
        </pre>
      </details>

      {/* Auth0 Related Cookies */}
      <details>
        <summary style={{ cursor: 'pointer', fontSize: '18px', fontWeight: 'bold', margin: '20px 0' }}>
          🍪 Auth0 Related Cookies ({auth0Cookies.length})
        </summary>
        <pre style={{ background: '#f5f5f5', padding: '15px', borderRadius: '5px', overflow: 'auto' }}>
{JSON.stringify(auth0Cookies.map(c => ({
  name: c.name,
  value: c.value.substring(0, 20) + '...',
})), null, 2)}
        </pre>
      </details>

      {/* Full Session Object */}
      {session && (
        <details>
          <summary style={{ cursor: 'pointer', fontSize: '18px', fontWeight: 'bold', margin: '20px 0' }}>
            🔐 Full Session Object
          </summary>
          <pre style={{ background: '#f5f5f5', padding: '15px', borderRadius: '5px', overflow: 'auto' }}>
{JSON.stringify(session, null, 2)}
          </pre>
        </details>
      )}

      {/* Troubleshooting Guide */}
      <details>
        <summary style={{ cursor: 'pointer', fontSize: '18px', fontWeight: 'bold', margin: '20px 0' }}>
          🔧 Troubleshooting Guide
        </summary>
        <div style={{ background: '#f9f9f9', padding: '15px', borderRadius: '5px' }}>
          <h3>Common Issues & Solutions:</h3>
          
          <h4>1. "State parameter is invalid" Error</h4>
          <ul>
            <li>✓ Ensure AUTH0_BASE_URL matches your actual domain</li>
            <li>✓ Don't mix www and non-www domains</li>
            <li>✓ Clear all cookies and try again</li>
            <li>✓ Check Auth0 Allowed Callback URLs includes: {actualUrl}/auth/callback</li>
          </ul>
          
          <h4>2. Login redirects to wrong domain</h4>
          <ul>
            <li>✓ Update AUTH0_BASE_URL in Vercel environment variables</li>
            <li>✓ Redeploy after changing environment variables</li>
          </ul>
          
          <h4>3. Session not persisting</h4>
          <ul>
            <li>✓ Check AUTH0_SECRET is at least 32 characters</li>
            <li>✓ Ensure cookies aren't blocked by browser</li>
            <li>✓ Verify middleware.ts is running (check console logs)</li>
          </ul>
          
          <h4>Required Auth0 Dashboard Settings:</h4>
          <ul>
            <li><strong>Allowed Callback URLs:</strong> {actualUrl}/auth/callback</li>
            <li><strong>Allowed Logout URLs:</strong> {actualUrl}</li>
            <li><strong>Allowed Web Origins:</strong> {actualUrl}</li>
          </ul>
        </div>
      </details>
    </main>
  );
}