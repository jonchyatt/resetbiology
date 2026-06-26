// POST /api/score-verify/verdict  — persist Jon's A4 court read (the 5 BLOCKING suspects).
// GET  /api/score-verify/verdict  — read the latest read back.
// Stored to Vercel Blob (Vercel FS is read-only). This captures Jon's INTENT; the actual
// ENGRAVING-LOCK still flips only via the verified pipeline + verify-packet-ready.mjs in the
// repo — the browser cannot fabricate the lock. Court of record = Jon; this is his signed read.
import { NextRequest, NextResponse } from 'next/server';
import { put, list } from '@vercel/blob';

export const runtime = 'nodejs';

const KEY = 'score-verify/lida-rose-a4-verdicts.json';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body || !Array.isArray(body.verdicts)) {
      return NextResponse.json({ error: 'verdicts[] required' }, { status: 400 });
    }
    const record = {
      song: 'lida-rose',
      part: 'Baritone',
      signedBy: body.signedBy || 'Jon',
      submittedAt: new Date().toISOString(),
      verdicts: body.verdicts, // [{ id, word, engraving, verdict: 'correct'|'wrong', correctedPitch?, note? }]
    };
    const blob = await put(KEY, JSON.stringify(record, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return NextResponse.json({ success: true, url: blob.url, record });
  } catch (err) {
    console.error('[score-verify/verdict POST]', err);
    return NextResponse.json({ error: 'save failed', details: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { blobs } = await list({ prefix: KEY });
    if (!blobs.length) return NextResponse.json({ exists: false });
    const resp = await fetch(blobs[0].url, { cache: 'no-store' });
    const record = await resp.json();
    return NextResponse.json({ exists: true, record });
  } catch (err) {
    return NextResponse.json({ exists: false, error: err instanceof Error ? err.message : String(err) });
  }
}
