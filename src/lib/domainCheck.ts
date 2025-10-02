/**
 * Domain consistency utilities for Auth0
 * Helps detect and prevent domain mismatch issues that cause "state parameter invalid" errors
 */

import { headers } from 'next/headers';

/**
 * Get the actual URL being accessed by the user
 * This considers forwarded headers from proxies/load balancers
 */
export async function getActualUrl(): Promise<string> {
  const headersList = await headers();
  
  const host = headersList.get('host') || 'localhost:3000';
  const forwardedHost = headersList.get('x-forwarded-host');
  const forwardedProto = headersList.get('x-forwarded-proto') || 'http';
  
  // Use forwarded host if available (common in production environments)
  const actualHost = forwardedHost || host;
  const actualProto = forwardedProto;
  
  return `${actualProto}://${actualHost}`;
}

/**
 * Check if the configured AUTH0_BASE_URL matches the actual URL being accessed
 * Returns true if they match, false if there's a mismatch
 */
export async function checkAuth0DomainConsistency(): Promise<{
  isConsistent: boolean;
  actualUrl: string;
  configuredUrl: string;
  message?: string;
}> {
  const actualUrl = await getActualUrl();
  const configuredUrl = process.env.AUTH0_BASE_URL || '';
  
  if (!configuredUrl) {
    return {
      isConsistent: false,
      actualUrl,
      configuredUrl: 'NOT SET',
      message: 'AUTH0_BASE_URL environment variable is not set',
    };
  }
  
  // Normalize URLs for comparison (remove trailing slashes)
  const normalizedActual = actualUrl.replace(/\/$/, '').toLowerCase();
  const normalizedConfigured = configuredUrl.replace(/\/$/, '').toLowerCase();
  
  // Check for localhost special cases
  if (normalizedActual.includes('localhost') && normalizedConfigured.includes('localhost')) {
    // For local development, just check the port matches
    const actualPort = normalizedActual.split(':')[2] || '80';
    const configuredPort = normalizedConfigured.split(':')[2] || '80';
    
    if (actualPort !== configuredPort) {
      return {
        isConsistent: false,
        actualUrl,
        configuredUrl,
        message: `Port mismatch: actual ${actualPort} vs configured ${configuredPort}`,
      };
    }
    return {
      isConsistent: true,
      actualUrl,
      configuredUrl,
    };
  }
  
  // For production, exact match is required
  if (normalizedActual !== normalizedConfigured) {
    // Check for common misconfigurations
    if (normalizedActual.includes('www.') && !normalizedConfigured.includes('www.')) {
      return {
        isConsistent: false,
        actualUrl,
        configuredUrl,
        message: 'Actual URL uses www but AUTH0_BASE_URL does not',
      };
    }
    
    if (!normalizedActual.includes('www.') && normalizedConfigured.includes('www.')) {
      return {
        isConsistent: false,
        actualUrl,
        configuredUrl,
        message: 'AUTH0_BASE_URL uses www but actual URL does not',
      };
    }
    
    if (normalizedActual.startsWith('https') && normalizedConfigured.startsWith('http:')) {
      return {
        isConsistent: false,
        actualUrl,
        configuredUrl,
        message: 'Protocol mismatch: actual uses HTTPS but AUTH0_BASE_URL uses HTTP',
      };
    }
    
    return {
      isConsistent: false,
      actualUrl,
      configuredUrl,
      message: 'Domain mismatch will cause authentication failures',
    };
  }
  
  return {
    isConsistent: true,
    actualUrl,
    configuredUrl,
  };
}

/**
 * Log domain consistency check for debugging
 * Use this in middleware or route handlers to track domain issues
 */
export async function logDomainCheck(context: string = 'Unknown'): Promise<void> {
  const check = await checkAuth0DomainConsistency();
  
  if (!check.isConsistent) {
    console.error(`[AUTH0 DOMAIN MISMATCH - ${context}]`, {
      actual: check.actualUrl,
      configured: check.configuredUrl,
      message: check.message,
      fix: `Update AUTH0_BASE_URL in Vercel to: ${check.actualUrl}`,
    });
  } else if (process.env.NODE_ENV === 'development') {
    console.log(`[AUTH0 DOMAIN OK - ${context}]`, {
      url: check.actualUrl,
    });
  }
}