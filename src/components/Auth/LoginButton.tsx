'use client';

export function LoginButton() {
  // Simplified login button - authentication system being updated
  return (
    <button 
      onClick={() => console.log('Login clicked')}
      className="text-gray-700 hover:text-teal-600 font-medium transition-colors"
    >
      Sign in
    </button>
  );
}