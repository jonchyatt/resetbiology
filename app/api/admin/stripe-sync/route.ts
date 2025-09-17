import { NextResponse } from 'next/server';
import { requireAdmin } from '@/src/lib/adminGuard';
import { ensureStripeSync } from '@/src/lib/stripeSync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const contentType = req.headers.get('content-type') || '';
    let body: any = {};
    if (contentType.includes('application/json')) body = await req.json();
    else if (contentType.includes('application/x-www-form-urlencoded')) {
      const form = await req.formData();
      body = Object.fromEntries(form.entries());
    }
    const productId = String(body.productId || '');
    if (!productId) return NextResponse.json({ ok: false, error: 'Missing productId' }, { status: 400 });
    const result = await ensureStripeSync(productId);
    return NextResponse.json({ ok: true, result });
  } catch (err: any) {
    const status = err?.status || 500;
    return NextResponse.json({ ok: false, error: err?.message || 'Internal error' }, { status });
  }
}