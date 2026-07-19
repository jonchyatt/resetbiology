'use client';

import { Auth0Provider } from '@auth0/nextjs-auth0';
import type { User } from '@auth0/nextjs-auth0/types';

export function ClientAuth0Provider({ user, children }: { user?: User; children: React.ReactNode }) {
  return <Auth0Provider user={user}>{children}</Auth0Provider>;
}