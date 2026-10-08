const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1']);

/**
 * Return a shared parent domain for the transient Auth0 transaction cookie.
 *
 * Auth0 validates `state` by reading a transaction cookie on the callback
 * request. Scope that cookie to the configured application host so a login
 * begun on a canonical alias can complete on the configured callback host.
 * Loopback development hosts must keep their host-only cookies.
 */
export function getAuth0TransactionCookieDomain(
  appBaseUrl = process.env.AUTH0_BASE_URL,
): string | undefined {
  if (!appBaseUrl) {
    return undefined;
  }

  try {
    const hostname = new URL(appBaseUrl).hostname.toLowerCase();
    return loopbackHosts.has(hostname) ? undefined : hostname;
  } catch {
    return undefined;
  }
}
