'use client';

import { UserProvider } from '@auth0/nextjs-auth0';

export function Auth0Provider({ children }: { children: React.ReactNode }) {
  return <UserProvider>{children}</UserProvider>;
}