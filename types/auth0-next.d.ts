declare module '@auth0/nextjs-auth0' {
  // Minimal, runtime-safe types to satisfy TS when using conditional exports.
  export function handleAuth(handlers?: any): any;
  export function handleLogin(req: any, options?: any): any;
  export function getSession(...args: any[]): Promise<any>;
}