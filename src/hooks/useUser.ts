// Simple user hook for our mock auth implementation
import { useState, useEffect } from 'react';

export function useUser() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Check if user is logged in via cookie
    // In production, this would validate a JWT token
    const checkAuth = async () => {
      try {
        // For now, assume logged in if we have the cookie
        const hasAuth = document.cookie.includes('auth0-session=logged-in');
        if (hasAuth) {
          setUser({
            name: 'Test User',
            email: 'test@example.com',
            sub: 'auth0|mock-user-id'
          });
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, []);
  
  return { user, isLoading, error: null };
}