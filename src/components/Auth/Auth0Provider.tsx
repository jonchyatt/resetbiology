'use client';

// Auth0 v4 doesn't have UserProvider - authentication is handled by middleware
// This component is kept for compatibility but doesn't wrap children anymore
export function Auth0Provider({ children }: { children: React.ReactNode }) {
  // Auth0 v4 uses middleware-based authentication
  // No provider wrapper needed
  return <>{children}</>;
}