import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export async function GET() {
  const base = process.env.AUTH0_ISSUER_BASE_URL!;
  const clientId = process.env.AUTH0_CLIENT_ID!;
  const redirect = `${process.env.AUTH0_BASE_URL}/api/auth/callback`;
  const connection = process.env.AUTH0_PASSWORDLESS_CONNECTION || 'email';
  const url = `${base}/authorize?client_id=${encodeURIComponent(clientId)}&response_type=code&redirect_uri=${encodeURIComponent(redirect)}&scope=openid%20profile%20email&connection=${encodeURIComponent(connection)}`;
  return NextResponse.redirect(url);
}