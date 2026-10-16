'use client';

import { Auth0Provider } from '@auth0/nextjs-auth0';
import type { User } from '@auth0/nextjs-auth0/types';
import { SWRConfig } from 'swr';

// Signed-in: unchanged (server user seeds useUser()'s cache).
// Anonymous: seed the cache with null (a defined value) and turn off revalidation, so
// useUser() never calls /auth/profile (it 401s and logs a console error on every public page).
// Login is a full-page navigation to /auth/login, so the layout re-renders with the real user.
// ponytail: `swr` is a transitive dep of @auth0/nextjs-auth0 (hoisted); add it to package.json if the hoist ever changes.
export function ClientAuth0Provider({ user, children }: { user?: User; children: React.ReactNode }) {
  if (user) return <Auth0Provider user={user}>{children}</Auth0Provider>;
  return (
    <SWRConfig value={{ revalidateIfStale: false, revalidateOnFocus: false, revalidateOnReconnect: false }}>
      <Auth0Provider user={null as unknown as User}>{children}</Auth0Provider>
    </SWRConfig>
  );
}
