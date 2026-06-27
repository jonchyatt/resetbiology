'use client';

// ScoreViewer — shows the real Music Man score (rendered page images in
// public/score/page-NNN.jpg) right inside the trainer so Jalen & Jevan can
// follow the actual notes while a track plays. Jump-to-song uses the PDF's
// table of contents; PDF page = printed page + 3 (front-matter offset, verified
// on "Goodnight Ladies" = printed 97 → PDF 100).

import { useState, useRef, useEffect, type TouchEvent as ReactTouchEvent } from 'react';

interface SongRef { title: string; page: number; bbs?: boolean }

const SONGS: SongRef[] = [
  { title: 'Overture', page: 4 },
  { title: 'Rock Island', page: 14 },
  { title: 'Iowa Stubborn', page: 22 },
  { title: 'Ya Got Trouble', page: 33 },
  { title: 'Goodnight My Someone', page: 56 },
  { title: 'Seventy-Six Trombones', page: 72 },
  { title: 'Ice Cream / Sincere', page: 89, bbs: true },
  { title: 'Pick-a-Little / Goodnight Ladies', page: 100, bbs: true },
  { title: 'Marian the Librarian', page: 112 },
  { title: 'My White Knight', page: 137 },
  { title: 'Wells Fargo Wagon', page: 143, bbs: true },
  { title: '— Act Two —', page: 153 },
  { title: "It's You", page: 165 },
  { title: 'Shipoopi', page: 168 },
  { title: 'Lida Rose & Will I Ever Tell You', page: 196, bbs: true },
  { title: 'Gary, Indiana', page: 207 },
  { title: 'Till There Was You', page: 221 },
  { title: 'Ice Cream Sociable', page: 230, bbs: true },
];

const TOTAL_PAGES = 248;
const pad = (n: number) => String(n).padStart(3, '0');

export default function ScoreViewer({ jumpToPage }: { jumpToPage?: number | null } = {}) {
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(false);
  const clamp = (n: number) => Math.max(1, Math.min(TOTAL_PAGES, n));
  const go = (n: number) => setPage(clamp(n));
  // V3.6: when a song is selected in the trainer, default the viewer to that song's pages.
  useEffect(() => { if (jumpToPage && jumpToPage > 0) setPage(clamp(jumpToPage)); }, [jumpToPage]);

  // Horizontal swipe → turn the page (works even while zoomed/scrolled).
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: ReactTouchEvent) => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY }; };
  const onTouchEnd = (e: ReactTouchEvent) => {
    if (!touch.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.current.x, dy = t.clientY - touch.current.y;
    // a mostly-horizontal swipe of >50px turns the page; vertical scroll is left alone
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(page + (dx < 0 ? 1 : -1));
    touch.current = null;
  };

  return (
    <details className="bg-gray-900/60 border border-amber-500/20 rounded-lg p-4">
      <summary className="text-lg font-semibold text-amber-300 cursor-pointer select-none">
        📄 Sheet Music
        <span className="ml-2 text-xs font-normal text-gray-500">— follow the real score while you sing</span>
      </summary>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="text-xs text-gray-400 flex items-center gap-1">
          Jump to song
          <select
            value=""
            onChange={(e) => { const p = Number(e.target.value); if (p) setPage(p); }}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100"
          >
            <option value="">Pick a song…</option>
            {SONGS.map((s, i) => (
              <option key={i} value={s.page} disabled={s.title.startsWith('—')}>
                {s.bbs ? '★ ' : ''}{s.title}{s.title.startsWith('—') ? '' : ` (p.${s.page})`}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-1 text-sm">
          <button onClick={() => setPage(clamp(page - 1))}
            className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700">◀</button>
          <input type="number" value={page} min={1} max={TOTAL_PAGES}
            onChange={(e) => setPage(clamp(Number(e.target.value) || 1))}
            className="w-16 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-center text-gray-100" />
          <span className="text-xs text-gray-500">/ {TOTAL_PAGES}</span>
          <button onClick={() => setPage(clamp(page + 1))}
            className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700">▶</button>
        </div>

        <button onClick={() => setZoom(!zoom)}
          className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded border border-gray-700">
          {zoom ? 'Fit width' : 'Zoom in'}
        </button>
        <span className="text-[10px] text-gray-600">★ = barbershop quartet number</span>
      </div>

      <div className="relative mt-3">
        <div
          className="overflow-auto bg-white rounded border border-gray-700"
          style={{ maxHeight: '88vh' }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <img
            src={`/score/page-${pad(page)}.jpg`}
            alt={`Music Man score — page ${page}`}
            style={{ width: zoom ? 'auto' : '100%', maxWidth: zoom ? 'none' : '100%', display: 'block', margin: '0 auto' }}
            key={page}
          />
        </div>
        {/* always-visible page arrows — stay put while you scroll up/down to read */}
        <button onClick={() => go(page - 1)} aria-label="previous page"
          className="absolute left-1 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/55 text-white text-xl flex items-center justify-center backdrop-blur active:bg-black/80 disabled:opacity-30"
          disabled={page <= 1}>‹</button>
        <button onClick={() => go(page + 1)} aria-label="next page"
          className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/55 text-white text-xl flex items-center justify-center backdrop-blur active:bg-black/80 disabled:opacity-30"
          disabled={page >= TOTAL_PAGES}>›</button>
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[11px] text-white bg-black/55 rounded-full px-2.5 py-0.5 backdrop-blur pointer-events-none">
          p.{page} / {TOTAL_PAGES}
        </div>
      </div>
      <p className="text-[10px] text-gray-600 mt-1">
        Swipe left/right (or tap the ‹ › arrows) to turn pages — they stay put while you scroll up/down to read.
        Page jumps are approximate; nudge with the arrows if a song starts a page over.
      </p>
    </details>
  );
}
