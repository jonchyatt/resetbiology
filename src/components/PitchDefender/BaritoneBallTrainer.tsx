'use client';

// Track 3 — the "ugly house": follow-the-bouncing-ball over Jon's highlighted
// Lida Rose Baritone pages. Dumb adjustable tempo (seconds-per-line) the singer
// nudges until the ball matches the recording. Tap-the-beat upgrade comes later.
// Path comes from /lida-baritone/path.json (yellow-highlight bands per page).

import { useEffect, useMemo, useRef, useState } from 'react';

type Band = { x0: number; x1: number; yc: number; bh: number };
type Page = { file: string; w: number; h: number; bands: Band[] };

const SONGS = [
  { id: 'lida-rose', label: 'Lida Rose', dir: '/lida-baritone' },
  { id: 'sincere', label: 'Ice Cream / Sincere', dir: '/sincere-baritone' },
  { id: 'itsyou', label: "It's You", dir: '/itsyou-baritone' },
];
const GAP = 10;

export default function BaritoneBallTrainer() {
  const [pages, setPages] = useState<Page[]>([]);
  const [songIdx, setSongIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<'ball' | 'scroll'>('ball'); // 'scroll' = no guide, just glide the pages (Jon's fallback)
  const [secPerLine, setSecPerLine] = useState(4);   // the dumb tempo knob
  const [width, setWidth] = useState(0);
  const [ball, setBall] = useState<{ x: number; y: number; show: boolean }>({ x: 0, y: 0, show: false });
  const [resting, setResting] = useState(false);
  const [curPage, setCurPage] = useState(0);

  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const idxRef = useRef(0);
  const startRef = useRef(0);

  useEffect(() => {
    setPlaying(false); idxRef.current = 0; setBall((b) => ({ ...b, show: false })); setResting(false); setPages([]);
    fetch(`${SONGS[songIdx].dir}/path.json`).then((r) => r.json()).then((d) => setPages(d.pages || [])).catch(() => {});
  }, [songIdx]);
  useEffect(() => {
    const on = () => setWidth(scrollRef.current?.clientWidth || wrapRef.current?.clientWidth || 0);
    on(); window.addEventListener('resize', on); return () => window.removeEventListener('resize', on);
  }, [pages]);

  const layout = useMemo(() => {
    const heights = pages.map((p) => (width && p.w) ? width * (p.h / p.w) : 0);
    const offsets: number[] = []; let acc = 0;
    for (const h of heights) { offsets.push(acc); acc += h + GAP; }
    return { heights, offsets, total: acc };
  }, [pages, width]);

  // flatten every band into one playable sequence; a page with 0 bands = a rest
  const sequence = useMemo(() => {
    const seq: { pageIdx: number; band: Band | null }[] = [];
    pages.forEach((p, pi) => { if (!p.bands.length) seq.push({ pageIdx: pi, band: null }); else p.bands.forEach((b) => seq.push({ pageIdx: pi, band: b })); });
    return seq;
  }, [pages]);

  useEffect(() => {
    if (!playing || !sequence.length || !width) return;
    if (idxRef.current >= sequence.length) idxRef.current = 0;
    startRef.current = performance.now();

    // 'scroll' mode — no ball, just glide the pages top→bottom over the whole song.
    if (mode === 'scroll') {
      setBall((b) => ({ ...b, show: false })); setResting(false);
      const sc = scrollRef.current;
      const totalSec = Math.max(8, sequence.length * secPerLine);
      const scrollLoop = (now: number) => {
        if (!sc) return;
        const elapsed = (now - startRef.current) / 1000;
        const maxTop = Math.max(0, layout.total - sc.clientHeight);
        const top = Math.min(maxTop, (elapsed / totalSec) * maxTop);
        sc.scrollTo({ top, behavior: 'auto' });
        if (top >= maxTop) { setPlaying(false); return; }
        rafRef.current = requestAnimationFrame(scrollLoop);
      };
      rafRef.current = requestAnimationFrame(scrollLoop);
      return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }

    const loop = (now: number) => {
      const seg = sequence[idxRef.current];
      if (!seg) { setPlaying(false); return; }
      const dur = (seg.band ? secPerLine : Math.max(1.5, secPerLine * 0.6)) * 1000;
      const prog = Math.min(1, (now - startRef.current) / dur);
      setCurPage(seg.pageIdx);
      const pi = seg.pageIdx;
      const sc = scrollRef.current;
      if (seg.band) {
        setResting(false);
        const b = seg.band;
        const x = (b.x0 + (b.x1 - b.x0) * prog) * width;
        const bandY = layout.offsets[pi] + b.yc * layout.heights[pi];
        const hops = Math.max(4, Math.round((b.x1 - b.x0) * 10));
        const bounce = Math.abs(Math.sin(((prog * hops) % 1) * Math.PI)) * 20;
        setBall({ x, y: bandY - bounce, show: true });
        if (sc) sc.scrollTo({ top: Math.max(0, bandY - sc.clientHeight * 0.42), behavior: 'auto' });
      } else {
        setResting(true); setBall((b) => ({ ...b, show: false }));
        if (sc) sc.scrollTo({ top: Math.max(0, layout.offsets[pi] + layout.heights[pi] * 0.3 - sc.clientHeight * 0.42), behavior: 'auto' });
      }
      if (prog >= 1) {
        idxRef.current += 1; startRef.current = now;
        if (idxRef.current >= sequence.length) { setPlaying(false); setBall((b) => ({ ...b, show: false })); return; }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, sequence, width, secPerLine, layout, mode]);

  const restart = () => { idxRef.current = 0; setResting(false); setPlaying(true); };

  return (
    <div ref={wrapRef} className="max-w-3xl mx-auto px-3 py-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl">🎈</span>
          <select value={songIdx} onChange={(e) => setSongIdx(Number(e.target.value))}
            className="bg-gray-800 border border-amber-500/40 rounded px-2 py-1 text-sm font-bold text-amber-300">
            {SONGS.map((s, i) => <option key={s.id} value={i}>{s.label}</option>)}
          </select>
          <span className="text-sm text-gray-400 whitespace-nowrap hidden sm:inline">· Baritone</span>
        </div>
        <a href="/pitch-defender/vocal-trainer-3" className="text-sm text-amber-400 hover:text-amber-300 whitespace-nowrap">← Trainer</a>
      </div>

      {/* control bar */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 bg-[#0a0a14]/95 backdrop-blur border border-amber-500/30 rounded-xl px-3 py-2 mb-2">
        {playing
          ? <button onClick={() => setPlaying(false)} className="w-12 h-12 rounded-full bg-amber-600 hover:bg-amber-500 text-white text-xl grid place-items-center">⏸</button>
          : <button onClick={() => setPlaying(true)} className="w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xl grid place-items-center">▶</button>}
        <button onClick={restart} className="w-10 h-10 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white text-sm grid place-items-center" title="Restart from the top">⏮</button>
        <div className="inline-flex rounded-full border border-gray-700 overflow-hidden text-xs">
          <button onClick={() => setMode('ball')} className={mode === 'ball' ? 'px-3 py-1.5 bg-amber-600 text-white' : 'px-3 py-1.5 bg-gray-800 text-gray-300'}>🎈 Ball</button>
          <button onClick={() => setMode('scroll')} className={mode === 'scroll' ? 'px-3 py-1.5 bg-amber-600 text-white' : 'px-3 py-1.5 bg-gray-800 text-gray-300'}>📜 Scroll</button>
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
          <span className="text-xs text-gray-400 whitespace-nowrap">Tempo</span>
          <input type="range" min={1.5} max={9} step={0.25} value={secPerLine}
            onChange={(e) => setSecPerLine(Number(e.target.value))} className="flex-1 accent-amber-400" />
          <span className="text-xs font-mono text-amber-300 w-16 text-right">{secPerLine.toFixed(2)}s/line</span>
        </div>
        <span className="text-[11px] text-gray-500">pg {curPage + 1}/{pages.length || 11}</span>
      </div>
      <p className="text-[11px] text-gray-500 mb-2">Press ▶ when the recording starts, then drag <b>Tempo</b> until the ball reaches the end of each line right when the singers do. Page&nbsp;5 is your rest (the ladies sing).</p>

      {/* scrolling pages + bouncing ball */}
      <div ref={scrollRef} className="relative overflow-y-auto rounded-lg border border-gray-800 bg-white" style={{ height: '74vh' }}>
        <div className="relative" style={{ height: layout.total || 1 }}>
          {pages.map((p, i) => (
            <img key={p.file} src={p.file} alt={`page ${i + 1}`} draggable={false}
              className="absolute left-0 w-full select-none"
              style={{ top: layout.offsets[i] || 0, height: layout.heights[i] || 'auto' }} />
          ))}
          {ball.show && (
            <div className="absolute z-10 pointer-events-none" style={{ left: ball.x - 13, top: ball.y - 26 }}>
              <div className="w-[26px] h-[26px] rounded-full"
                style={{ background: 'radial-gradient(circle at 38% 34%, #fff7d6 0%, #ffd24a 45%, #ff7a00 100%)', boxShadow: '0 0 14px 4px rgba(255,170,40,0.7)' }} />
            </div>
          )}
          {resting && (
            <div className="absolute z-10 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-cyan-700/90 text-white text-sm font-semibold"
              style={{ top: (layout.offsets[curPage] || 0) + (layout.heights[curPage] || 0) * 0.18 }}>
              🎤 Rest — the ladies sing
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
