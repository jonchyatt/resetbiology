import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // Simple database connection test by querying user count
    const userCount = await prisma.user.count();
    return NextResponse.json({ ok: true, userCount, timestamp: new Date().toISOString() }, { status: 200 });
  } catch (err: any) {
    console.error('DB health check failed:', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'unknown' }, { status: 500 });
  }
}