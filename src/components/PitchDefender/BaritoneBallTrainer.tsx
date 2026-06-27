'use client';

// Track 3 v2 — the RIGHT build: a crisp baritone ribbon (OLIVER line cropped from
// the real PDF, joined horizontally) that scrolls in time with the audio. Dumb
// linear sync the singer nudges (Start offset + Speed) until it lines up; tap-the-
// beat per-strip anchoring is the next upgrade. Assets per song: ribbon.jpg +
// ribbon.json + audio.mp3 (built by scripts/build-baritone-ribbon.mjs).

import { useCallback, useEffect, useRef, useState } from 'react';

type Strip = { x: number; w: number; page: number };
type Ribbon = { w: number; h: number; strips: Strip[] };

const SONGS = [
  { id: 'lida-rose', label: 'Lida Rose', dir: '/lida-baritone' },
  { id: 'sincere', label: 'Ice Cream / Sincere', dir: '/sincere-baritone' },
  { id: 'itsyou', label: "It's You", dir: '/itsyou-baritone' },
  { id: 'goodnight', label: 'Goodnight Ladies', dir: '/goodnight-baritone' },
];
const MARKER_FRAC = 0.28;  // the "now" line sits this far from the left

export default function BaritoneBallTrainer() {
  const [songIdx, setSongIdx] = useState(0);
  const [ribbon, setRibbon] = useState<Ribbon | null>(null);
  const [notReady, setNotReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [offset, setOffset] = useState(0);   // sec before the baritone scroll begins
  const [scale, setScale] = useState(1);     // fine speed multiplier
  const [dur, setDur] = useState(0);
  const [t, setT] = useState(0);
  const [vw, setVw] = useState(0);
  const [viewH, setViewH] = useState(320);

  const audioRef = useRef<HTMLAudioElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dir = SONGS[songIdx].dir;
  const dispW = ribbon ? ribbon.w * (viewH / ribbon.h) : 0;

  useEffect(() => {
    setRibbon(null); setNotReady(false); setPlaying(false); setT(0); setOffset(0); setScale(1);
    fetch(`${dir}/ribbon.json`).then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setRibbon(d); else setNotReady(true); })
      .catch(() => setNotReady(true));
  }, [dir]);
  useEffect(() => {
    const on = () => { setVw(scrollRef.current?.clientWidth || 0); setViewH(Math.min(Math.max(260, window.innerHeight * 0.52), 480)); };
    on(); window.addEventListener('resize', on); return () => window.removeEventListener('resize', on);
  }, [ribbon]);

  const sync = useCallback((time: number) => {
    const sc = scrollRef.current; if (!sc || !ribbon || !dur) return;
    const eff = Math.max(0, time - offset) / Math.max(0.1, dur - offset);
    const x = Math.min(1, eff * scale) * dispW;
    sc.scrollLeft = Math.max(0, x - vw * MARKER_FRAC);
  }, [ribbon, dur, offset, scale, dispW, vw]);

  const onTime = () => { const a = audioRef.current; if (a) { setT(a.currentTime); sync(a.currentTime); } };
  const toggle = () => {
    const a = audioRef.current; if (!a) return;
    if (a.paused) { a.play(); setPlaying(true); } else { a.pause(); setPlaying(false); }
  };
  const restart = () => { const a = audioRef.current; if (a) { a.currentTime = 0; a.play(); setPlaying(true); } };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const curPage = ribbon && dispW ? (() => {
    const x = (scrollRef.current?.scrollLeft || 0) + vw * MARKER_FRAC;
    const ribX = (x / dispW) * ribbon.w;
    const s = ribbon.strips.find((st) => ribX >= st.x && ribX < st.x + st.w);
    return s?.page ?? 1;
  })() : 1;

  return (
    <div className="max-w-5xl mx-auto px-3 py-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl">🎼</span>
          <select value={songIdx} onChange={(e) => setSongIdx(Number(e.target.value))}
            className="bg-gray-800 border border-amber-500/40 rounded px-2 py-1 text-sm font-bold text-amber-300">
            {SONGS.map((s, i) => <option key={s.id} value={i}>{s.label}</option>)}
          </select>
          <span className="text-sm text-gray-400 hidden sm:inline">· Baritone</span>
        </div>
        <a href="/pitch-defender/vocal-trainer-3" className="text-sm text-amber-400 hover:text-amber-300 whitespace-nowrap">← Trainer</a>
      </div>

      <audio ref={audioRef} src={`${dir}/audio.mp3`} preload="auto"
        onLoadedMetadata={(e) => setDur((e.target as HTMLAudioElement).duration || 0)}
        onTimeUpdate={onTime} onEnded={() => setPlaying(false)} />

      {/* control bar */}
      <div className="flex flex-wrap items-center gap-3 bg-[#0a0a14]/95 border border-amber-500/30 rounded-xl px-3 py-2 mb-2">
        {playing
          ? <button onClick={toggle} className="w-12 h-12 rounded-full bg-amber-600 hover:bg-amber-500 text-white text-xl grid place-items-center">⏸</button>
          : <button onClick={toggle} className="w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xl grid place-items-center">▶</button>}
        <button onClick={restart} className="w-10 h-10 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white text-sm grid place-items-center" title="Restart">⏮</button>
        <span className="text-xs font-mono text-gray-400">{fmt(t)} / {fmt(dur)}</span>
        <div className="flex items-center gap-1.5 flex-1 min-w-[150px]">
          <span className="text-[11px] text-gray-400 whitespace-nowrap">Start</span>
          <input type="range" min={0} max={Math.max(8, dur)} step={0.1} value={offset} onChange={(e) => setOffset(Number(e.target.value))} className="flex-1 accent-amber-400" />
          <span className="text-[10px] font-mono text-amber-300 w-9">{offset.toFixed(1)}s</span>
        </div>
        <div className="flex items-center gap-1.5 flex-1 min-w-[150px]">
          <span className="text-[11px] text-gray-400 whitespace-nowrap">Speed</span>
          <input type="range" min={0.6} max={1.6} step={0.01} value={scale} onChange={(e) => setScale(Number(e.target.value))} className="flex-1 accent-cyan-400" />
          <span className="text-[10px] font-mono text-cyan-300 w-9">{scale.toFixed(2)}×</span>
        </div>
        {ribbon && <span className="text-[11px] text-gray-500">pg {curPage}</span>}
      </div>
      <p className="text-[11px] text-gray-500 mb-2">Press ▶, then drag <b>Start</b> so the line hits the first note when your part comes in, and nudge <b>Speed</b> until it tracks. The ball sits on the note you should be singing.</p>

      {/* horizontal ribbon viewport with a fixed "now" marker */}
      {notReady && <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-6 text-center text-sm text-gray-400">This song&apos;s ribbon is still being built — Lida Rose is ready now.</div>}
      {ribbon && (
        <div className="relative rounded-lg border border-gray-800 bg-white overflow-hidden" style={{ height: viewH }}>
          <div ref={scrollRef} className="absolute inset-0 overflow-x-hidden">
            <img src={`${dir}/ribbon.jpg`} alt="baritone line" draggable={false}
              style={{ height: viewH, width: dispW, maxWidth: 'none' }} className="select-none" />
          </div>
          {/* the "now" marker + bouncing ball */}
          <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: `${MARKER_FRAC * 100}%` }}>
            <div className="absolute top-0 bottom-0 w-[2px] bg-amber-500/70" />
            <div className="absolute w-5 h-5 rounded-full -translate-x-1/2"
              style={{ left: 0, top: viewH * 0.30 - 10 + (playing ? Math.abs(Math.sin(t * 3)) * -14 : 0),
                background: 'radial-gradient(circle at 38% 34%, #fff7d6 0%, #ffd24a 45%, #ff7a00 100%)', boxShadow: '0 0 12px 3px rgba(255,170,40,0.7)' }} />
          </div>
        </div>
      )}
    </div>
  );
}
