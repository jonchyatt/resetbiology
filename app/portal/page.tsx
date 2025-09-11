// app/portal/page.tsx
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';

export default async function PortalPage() {
  // Simplified implementation due to Next.js 15 Auth0 compatibility issues
  // TODO: Replace with proper Auth0 session handling once compatibility is resolved
  
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Your Portal</h1>
      <p>Portal access - Auth0 integration pending Next.js 15 compatibility fix</p>
      <p>
        <a href="/api/auth/login">Sign in</a>
        <a href="/api/auth/logout" className="ml-4">Sign out</a>
      </p>
    </main>
  );
}