import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export async function GET() {
  return NextResponse.json({
    AUTH0_BASE_URL: !!process.env.AUTH0_BASE_URL,
    AUTH0_ISSUER_BASE_URL: !!process.env.AUTH0_ISSUER_BASE_URL,
    AUTH0_CLIENT_ID: !!process.env.AUTH0_CLIENT_ID,
    AUTH0_CLIENT_SECRET: !!process.env.AUTH0_CLIENT_SECRET,
    AUTH0_SECRET: !!process.env.AUTH0_SECRET,
    AUTH0_PASSWORDLESS_CONNECTION: process.env.AUTH0_PASSWORDLESS_CONNECTION || 'email',
  });
}