// GET /api/vocal-trainer/library
// Lists all vocal-trainer templates from Vercel Blob.
// Returns: [{ id, title, audioUrl, templateUrl, createdAt, noteCount }]
import { NextResponse } from 'next/server';
import { list } from '@vercel/blob';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface LibraryEntry {
  id: string;
  title: string;
  audioUrl: string | null;
  templateUrl: string;
  createdAt: string | null;
  noteCount: number;
}

export async function GET() {
  try {
    const out: LibraryEntry[] = [];
    let cursor: string | undefined;
    const seen = new Set<string>();

    do {
      const res = await list({ prefix: 'vocal-trainer/', cursor, limit: 1000 });
      cursor = res.cursor;

      // Find every template.json
      const templates = res.blobs.filter(b => b.pathname.endsWith('/template.json'));
      for (const b of templates) {
        // Path: vocal-trainer/<id>/template.json
        const parts = b.pathname.split('/');
        if (parts.length < 3) continue;
        const id = parts[1];
        if (seen.has(id)) continue;
        seen.add(id);

        try {
          const r = await fetch(b.url, { cache: 'no-store' });
          if (!r.ok) continue;
          const t = await r.json();
          const noteCount = Array.isArray(t.notes) ? t.notes.length : 0;
          out.push({
            id,
            title: t.title || id,
            audioUrl: t.audioUrl || null,
            templateUrl: b.url,
            createdAt: t.createdAt || null,
            noteCount,
          });
        } catch {
          // skip broken template
        }
      }
    } while (cursor);

    out.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return NextResponse.json({ templates: out });
  } catch (err) {
    console.error('[vocal-trainer/library] error:', err);
    return NextResponse.json({
      error: 'list failed',
      details: err instanceof Error ? err.message : String(err),
      templates: [],
    }, { status: 500 });
  }
}
