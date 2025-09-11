// src/components/Navigation/AuthButtons.tsx
import { auth0 } from '@/lib/auth0';

export default async function AuthButtons() {
  const session = await auth0.getSession();
  const user = session?.user;

  // Use SDK routes for Auth0
  if (!user) {
    return (
      <a href="/api/auth/login" className="btn">
        Login
      </a>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <a href="/portal" className="btn">Portal</a>
      <a href="/api/auth/logout" className="btn">Sign out</a>
    </div>
  );
}