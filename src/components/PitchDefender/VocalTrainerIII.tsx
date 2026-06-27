'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VocalTrainerIII — Blast-capable clone of VocalTrainer (V1 stays untouched)
// ═══════════════════════════════════════════════════════════════════════════════
//
// V3 = V1 plus the mixing desk (built for Music Man barbershop part practice):
//   • Per-stream L/R BALANCE sliders — pan no longer hardcoded; defaults match
//     V1 (vocals -0.7 / music 0 / mic +1)
//   • Volume range 0-400% per stream through a master brick-wall limiter
//     (DynamicsCompressorNode) so "blast" gets LOUD instead of clipping harshly
//   • Live level METERS per stream (post-gain) — visual proof the sliders work
//   • AudioContext always latencyHint:'interactive' — V1's default 'usb' profile
//     created the context with 'playback' (~100-200ms lag on the live mic monitor)
//
// Inherited V1 workflow:
//   1. Drag-drop or pick an audio file (m4a/mp3/wav)
//   2. BasicPitch extracts notes in the browser
//   3. Greedy melody-line filter (top voice per ~50ms window) cleans piano accompaniment
//   4. Note editor — click any note to delete it (garbage notes from harmonics)
//   5. Save → POST to /api/vocal-trainer/upload (audio + notes JSON to Vercel Blob)
//   6. Practice mode — dichotic L/R: Donny on left, mic monitor on right, visual cursor
//   7. Mic profile dropdown (laptop vs USB interface) sets latencyHint + gain
//   8. Synthesia adapter — every saved template auto-publishes to localStorage
//
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  extractNotesFromAudio,
  rawNotesToSongNotes,
  extractMelodyLine,
  publishToSynthesia,
  type RawNote,
  type ExtractionProgress,
  type PitchContourPoint,
} from './extractNotesFromAudio';
import { usePitchDetection } from './usePitchDetection';
import { PitchDetector } from 'pitchy';
import ScoreViewer from './ScoreViewer';
import ScoreEngraving from './ScoreEngraving';
import { getOmrTarget } from './omrTargets';
import { SoundTouch, SimpleFilter, WebAudioBufferSource } from 'soundtouchjs';

// V3.7 — Pitch-preserving time-stretch (the Tempo Trainer).
// Render `buffer` to a NEW AudioBuffer whose duration is scaled by 1/speed
// (speed>1 = faster/shorter, speed<1 = slower/longer) while keeping pitch dead
// constant. This is a real phase-vocoder (SoundTouch), NOT AudioBufferSourceNode
// .playbackRate (which would chipmunk/Darth-Vader the pitch). We render OFFLINE,
// before play, then play the stretched buffer at native rate — so the proven
// sample-accurate lockstep player (the dichotic engine) is left completely intact.
function stretchBuffer(ctx: AudioContext, buffer: AudioBuffer, speed: number): AudioBuffer {
  const st = new SoundTouch();
  st.tempo = speed; // tempo>1 → faster, pitch unchanged
  const source = new WebAudioBufferSource(buffer);
  const filter = new SimpleFilter(source, st);
  const BLOCK = 8192;
  const interleaved = new Float32Array(BLOCK * 2);
  // Upper-bound the output length (frames grow as 1/speed), then trim to actual.
  const cap = Math.ceil(buffer.length / Math.max(0.25, speed)) + BLOCK * 4;
  const left = new Float32Array(cap);
  const right = new Float32Array(cap);
  let total = 0;
  let n = filter.extract(interleaved, BLOCK);
  while (n > 0 && total + n <= cap) {
    for (let i = 0; i < n; i++) {
      left[total + i] = interleaved[i * 2];
      right[total + i] = interleaved[i * 2 + 1];
    }
    total += n;
    n = filter.extract(interleaved, BLOCK);
  }
  const out = ctx.createBuffer(2, Math.max(1, total), buffer.sampleRate);
  out.copyToChannel(left.subarray(0, total), 0);
  out.copyToChannel(right.subarray(0, total), 1);
  return out;
}

// V3.8 — a real mixing-console dial. Small by default; SHORT-PRESS opens a big
// spin-knob you drag up/down to set, then collapse back (Jon: "literal dials that
// short press to open bigger spin knobs"). Drag-on-small also works for quick nudges.
function MixKnob({ label, value, min, max, step, onChange, format, color = '#fbbf24', size = 40 }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; format: (v: number) => string; color?: string; size?: number;
}) {
  const [open, setOpen] = useState(false);
  const drag = useRef<{ y: number; v: number; moved: boolean } | null>(null);
  const pct = max === min ? 0 : (value - min) / (max - min);
  const angle = -135 + pct * 270;
  const clampStep = (v: number) => Math.max(min, Math.min(max, Math.round(v / step) * step));
  const Dial = ({ sz }: { sz: number }) => (
    <div className="relative rounded-full" style={{
      width: sz, height: sz,
      background: 'radial-gradient(circle at 38% 34%, #5b6675 0%, #2a323e 62%, #0c1017 100%)',
      boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.18), inset 0 -2px 4px rgba(0,0,0,0.5), 0 2px 5px rgba(0,0,0,0.6)',
    }}>
      <div className="absolute left-1/2 top-1/2" style={{
        width: Math.max(2, sz * 0.045), height: sz * 0.4, background: color,
        transformOrigin: 'bottom center', transform: `translate(-50%,-100%) rotate(${angle}deg)`,
        borderRadius: 3, boxShadow: `0 0 5px ${color}`,
      }} />
    </div>
  );
  const onDown = (e: React.PointerEvent) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); drag.current = { y: e.clientY, v: value, moved: false }; };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    if (Math.abs(e.clientY - d.y) < 3 && !d.moved) return;
    d.moved = true;
    onChange(clampStep(d.v + ((d.y - e.clientY) / 140) * (max - min)));
  };
  const onUp = () => { drag.current = null; };
  return (
    <div className="flex flex-col items-center gap-0.5 leading-none">
      <button onClick={() => setOpen(true)} className="grid place-items-center" title={`${label} — tap to adjust`}><Dial sz={size} /></button>
      <span className="text-[8px] uppercase tracking-wide text-gray-500">{label}</span>
      <span className="text-[9px] font-mono" style={{ color }}>{format(value)}</span>
      {open && (
        <div className="fixed inset-0 z-[10002] grid place-items-center bg-black/55" onClick={() => setOpen(false)}>
          <div className="rounded-2xl bg-neutral-900 border border-neutral-700 px-6 py-5 shadow-2xl flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-semibold text-gray-200">{label}</div>
            <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} className="touch-none cursor-ns-resize select-none"><Dial sz={120} /></div>
            <div className="text-xl font-mono" style={{ color }}>{format(value)}</div>
            <div className="flex items-center gap-3">
              <button onClick={() => onChange(clampStep(value - step * 4))} className="w-10 h-10 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white text-lg">−</button>
              <button onClick={() => onChange(clampStep(value + step * 4))} className="w-10 h-10 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white text-lg">+</button>
            </div>
            <div className="text-[10px] text-gray-500">drag the knob up / down to spin</div>
            <button onClick={() => setOpen(false)} className="mt-1 px-5 py-1.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-gray-200 text-sm">✕ Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Convert a frequency (Hz) to a MIDI note number (69 = A4 = 440 Hz).
function freqToMidi(freq: number): number {
  if (freq <= 0) return 0;
  return 69 + 12 * Math.log2(freq / 440);
}

interface LibraryItem {
  id: string;
  title: string;
  audioUrl: string | null;
  templateUrl: string;
  createdAt: string | null;
  noteCount: number;
}

interface FullTemplate {
  id: string;
  title: string;
  audioUrl: string | null;
  audioContentType: string | null;
  notes: RawNote[];
  tempo: number;
  durationSec: number;
  createdAt?: string;
}

type PracticeNote = { pitchMidi: number; startTimeSeconds: number; durationSeconds: number; src?: string };
type SyncNote = PracticeNote;

interface ScoreHealthPayload {
  song: string;
  part: string;
  scoreVersion: string;
  keyFifths: number;
  noteCount: number;
  generatedAt: string;
  wholeNotes: Array<{ measure: number; pitch: string }>;
  checks: Array<{ id: string; label: string; status: 'pass' | 'fail'; detail: string }>;
}

interface PracticePhrase {
  id: string;
  label: string;
  shortLabel?: string;
  start: number;
  end: number;
  noteCount: number;
  page?: number;
  noteStart?: number;
  noteEnd?: number;
}

interface CoachStats {
  samples: number;
  onPitch: number;
  sharp: number;
  flat: number;
  sumAbsCents: number;
  sumSignedCents: number;
  lastCents: number | null;
}

interface PhraseManifestPayload {
  song: string;
  part: string;
  scoreVersion: string;
  phrases: Array<{
    id: string;
    shortLabel?: string;
    label: string;
    page?: number;
    noteStart: number;
    noteEnd: number;
  }>;
}

interface SourcePartHealthPayload {
  song: string;
  scoreVersion: string;
  parts: Array<{
    part: string;
    sourceNoteCount: number;
    generatedMusicXml: string;
  }>;
  checks: Array<{ id: string; label: string; status: 'pass' | 'fail'; detail: string }>;
}

interface LeadNoteMapPayload {
  song: string;
  part: string;
  scoreVersion: string;
  notes: Array<{
    index: number;
    measure: number;
    page: number;
    pitch: string;
    phraseId?: string | null;
    phraseLabel?: string | null;
    phraseShortLabel?: string | null;
  }>;
}

interface TakeSummary {
  id: string;
  createdAt: string;
  title: string;
  reason: 'stopped' | 'ended';
  durationSec: number;
  samples: number;
  accuracyPct: number;
  avgCents: number;
  meanAbsCents: number;
  sharpPct: number;
  flatPct: number;
}

interface EngravingReport {
  id: string;
  createdAt: string;
  title: string;
  timeSeconds: number;
  noteIndex: number | null;
  measure: number | null;
  page: number | null;
  pitch: string | null;
  phraseId: string | null;
  phrase: string | null;
  scoreVersion: string | null;
  sourcePageImage: string | null;
  activeScore: unknown;
  svgSnapshot: string | null;
  svgTruncated: boolean;
  viewport: { width: number; height: number };
}

type MicProfile = 'phone' | 'laptop' | 'usb';

// V3: latencyHint removed from profiles — the context is ALWAYS 'interactive'
// (live monitoring app; 'playback' added 100-200ms echo on the singer's voice).
// Profiles set input makeup gain + whether the OS auto-gain/noise pipeline runs.
// `agc:true` matters on phones: Android mics are VERY quiet with AGC disabled.
const MIC_PROFILES: Record<MicProfile, { label: string; gain: number; agc: boolean }> = {
  phone:  { label: 'Phone mic (auto-boost)', gain: 3.0, agc: true },
  laptop: { label: 'Laptop built-in mic', gain: 1.5, agc: false },
  usb:    { label: 'USB / Audio interface', gain: 0.9, agc: false },
};

const IS_MOBILE = typeof navigator !== 'undefined' && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);

const VOL_MAX = 400; // V3: percent ceiling per stream (V1 was 200)
const PLUNK_DEFAULT_VOL = 180;
const PLUNK_GAIN_SCALE = 0.55;
const PLUNK_LOOKAHEAD_SECONDS = 0.45;
const PLUNK_SCHEDULER_MS = 35;
const PLUNK_MAX_TONE_SECONDS = 4.0;
const TAKE_HISTORY_KEY = 'vt3_take_summaries_v1';
const ENGRAVING_REPORTS_KEY = 'vt3_engraving_reports_v1';

// Vocal range used for both extraction filter and editor display
const PITCH_MIN = 48; // C3
const PITCH_MAX = 84; // C6

const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function midiToName(m: number): string {
  return `${PITCH_NAMES[m % 12]}${Math.floor(m / 12) - 1}`;
}

function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

function freshCoachStats(): CoachStats {
  return {
    samples: 0,
    onPitch: 0,
    sharp: 0,
    flat: 0,
    sumAbsCents: 0,
    sumSignedCents: 0,
    lastCents: null,
  };
}

function foldedPitchCents(micMidi: number, targetMidi: number): number {
  const rawCents = (micMidi - targetMidi) * 100;
  return ((rawCents + 600) % 1200 + 1200) % 1200 - 600;
}

function centsLabel(cents: number | null): string {
  if (cents == null) return 'silent';
  if (Math.abs(cents) < 5) return '0c';
  return `${cents > 0 ? '+' : ''}${Math.round(cents)}c`;
}

// ─── V3.1: Music Man barbershop title taxonomy ──────────────────────────
// Library titles are saved as "<Part> - <Song> - <Mix>",
// e.g. "Lead - Wells Fargo - No Lead" / "Bass - Ice Cream - Bass Dominant".
// The library grouping parses this from the title string (no data migration).
const MM_PARTS = ['Lead', 'Tenor', 'Baritone', 'Bass'] as const;
const MODE_LABEL: Record<string, string> = {
  learn: 'Learn — your part is loud',
  'sing-in': 'Sing-in — your part removed',
  other: 'Other mixes',
};
interface MmMeta { part: string; song: string; mix: string; mode: 'learn' | 'sing-in' | 'other'; }
function parseMmTitle(title: string): MmMeta | null {
  const segs = title.split(' - ').map((s) => s.trim());
  if (segs.length < 2) return null;
  const part = MM_PARTS.find((p) => p.toLowerCase() === segs[0].toLowerCase());
  if (!part) return null;
  const mix = segs[segs.length - 1];
  const song = segs.slice(1, segs.length - 1).join(' - ') || mix;
  const mode: MmMeta['mode'] = /^no\s/i.test(mix) ? 'sing-in' : /dominant/i.test(mix) ? 'learn' : 'other';
  return { part, song, mix, mode };
}

// Codex cleanup #4 — classify a library item into a ROLE so cards show a short
// label + badge instead of a giant "BARITONE ONLY (isolated · left ear)" string.
type ItemRole = 'reference' | 'backing' | 'original' | 'notes' | 'needs';
function classifyRole(mm: MmMeta | null, item: { noteCount: number; audioUrl: string | null; title: string }): ItemRole {
  const mix = (mm?.mix || item.title).toLowerCase();
  if (/\bno\s|minus|backing/.test(mix)) return 'backing';
  if (/original|stereo/.test(mix)) return 'original';
  if (!item.audioUrl && item.noteCount > 0) return 'notes';
  if (item.noteCount === 0) return 'needs';
  return 'reference';
}
const ROLE_BADGE: Record<ItemRole, { label: string; cls: string }> = {
  reference: { label: 'Reference', cls: 'bg-emerald-900/50 text-emerald-300 border-emerald-700/50' },
  backing:   { label: 'Backing',   cls: 'bg-blue-900/50 text-blue-300 border-blue-700/50' },
  original:  { label: 'Original',  cls: 'bg-purple-900/50 text-purple-300 border-purple-700/50' },
  notes:     { label: 'Notes',     cls: 'bg-gray-700/60 text-gray-300 border-gray-600/50' },
  needs:     { label: 'Needs extraction', cls: 'bg-amber-900/50 text-amber-300 border-amber-700/50' },
};

// Codex addendum #4 — a normalized frontend model derived from the API item, so
// search/chips/favorites don't re-parse messy titles everywhere.
type LibraryAsset = {
  id: string; rawTitle: string; displayTitle: string;
  song: string; part: string; role: ItemRole;
  audioUrl: string | null; noteCount: number; hasNotes: boolean;
  createdAt: string | null; favorite: boolean;
};
function normalizeAsset(item: LibraryItem, favorites: Set<string>): LibraryAsset {
  const mm = parseMmTitle(item.title);
  const song = mm?.song || 'Other';
  const part = mm?.part || '—';
  return {
    id: item.id, rawTitle: item.title,
    displayTitle: mm ? `${song} · ${part}` : item.title,
    song, part, role: classifyRole(mm, item),
    audioUrl: item.audioUrl, noteCount: item.noteCount, hasNotes: item.noteCount > 0,
    createdAt: item.createdAt, favorite: favorites.has(item.id),
  };
}

// Codex addendum #6 — collapse likely duplicates (same song+part+role) to ONE
// canonical item (most notes / has audio wins); the rest go under "More versions".
function dedupeItems(items: LibraryItem[]): { canonical: LibraryItem[]; more: LibraryItem[] } {
  const byKey = new Map<string, LibraryItem[]>();
  for (const it of items) {
    const mm = parseMmTitle(it.title);
    const key = `${(mm?.song || '?').toLowerCase()}|${(mm?.part || '?').toLowerCase()}|${classifyRole(mm, it)}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(it);
  }
  const canonical: LibraryItem[] = [], more: LibraryItem[] = [];
  for (const arr of byKey.values()) {
    arr.sort((a, b) => (b.noteCount - a.noteCount) || ((b.audioUrl ? 1 : 0) - (a.audioUrl ? 1 : 0)) || a.title.localeCompare(b.title));
    canonical.push(arr[0]);
    more.push(...arr.slice(1));
  }
  return { canonical, more };
}

const LIDA_ROSE_SCORE_PARTS = {
  Lead: {
    part: 'Lead',
    label: 'Lida Rose · Lead',
    musicXMLUrl: '/musicxml/lida-rose-lead.musicxml',
    syncUrl: '/musicxml/lida-rose-lead-sync.json',
    syncV2Url: '/musicxml/lida-rose-lead-sync-v2.json',
    reconciledUrl: '/musicxml/lida-rose-lead-reconciled.json',
    reconciledV2Url: '/musicxml/lida-rose-lead-reconciled-v2.json',
    healthUrl: '/musicxml/lida-rose-lead-score-health.json',
    healthV2Url: '/musicxml/lida-rose-lead-score-health-v2.json',
    phrasesUrl: '/musicxml/lida-rose-lead-phrases.json',
    noteMapUrl: '/musicxml/lida-rose-lead-note-map.json',
    title: 'Lida Rose — Lead (pp.196-198)',
  },
  Baritone: {
    part: 'Baritone',
    label: 'Lida Rose · Baritone',
    musicXMLUrl: '/musicxml/lida-rose-baritone.musicxml',
    syncUrl: '/musicxml/lida-rose-baritone-sync.json',
    syncV2Url: '/musicxml/lida-rose-baritone-sync-v2.json',
    reconciledUrl: '/musicxml/lida-rose-baritone-reconciled.json',
    reconciledV2Url: '/musicxml/lida-rose-baritone-reconciled-v2.json',
    healthUrl: '/musicxml/lida-rose-baritone-score-health.json',
    healthV2Url: '/musicxml/lida-rose-baritone-score-health-v2.json',
    phrasesUrl: '/musicxml/lida-rose-baritone-phrases.json',
    noteMapUrl: '/musicxml/lida-rose-baritone-note-map.json',
    title: 'Lida Rose — Baritone (pp.196-198)',
  },
} as const;

type ScoreTimingMode = 'current' | 'v2';
type LidaRoseScorePart = typeof LIDA_ROSE_SCORE_PARTS[keyof typeof LIDA_ROSE_SCORE_PARTS];

function getLidaRoseScorePart(mm: MmMeta | null): LidaRoseScorePart | null {
  if (!mm || !/lida\s*rose/i.test(mm.song)) return null;
  return LIDA_ROSE_SCORE_PARTS[mm.part as keyof typeof LIDA_ROSE_SCORE_PARTS] ?? null;
}

function getActiveLidaRoseScorePart(part: LidaRoseScorePart | null, mode: ScoreTimingMode) {
  if (!part) return null;
  if (mode === 'current') {
    return { ...part, timingMode: 'current' as const, timingLabel: 'Current' };
  }
  return {
    ...part,
    syncUrl: part.syncV2Url,
    reconciledUrl: part.reconciledV2Url,
    healthUrl: part.healthV2Url,
    label: `${part.label} - Conductor v2`,
    title: `${part.title} - Conductor v2`,
    timingMode: 'v2' as const,
    timingLabel: 'Conductor v2',
  };
}

export default function VocalTrainerIII() {
  // ─── Library + selected template ────────────────────────────────────────
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentTemplate, setCurrentTemplate] = useState<FullTemplate | null>(null);
  const currentMm = useMemo(() => currentTemplate ? parseMmTitle(currentTemplate.title) : null, [currentTemplate]);
  const lidaRoseScorePart = useMemo(() => getLidaRoseScorePart(currentMm), [currentMm]);

  // ─── Upload + extraction state ──────────────────────────────────────────
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState<ExtractionProgress | null>(null);
  const [extractedNotes, setExtractedNotes] = useState<RawNote[]>([]);
  const [extractedDuration, setExtractedDuration] = useState(0);
  const [vocalContour, setVocalContour] = useState<PitchContourPoint[]>([]);
  const [tempo, setTempo] = useState(100);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // ─── V3.1: library grouping + per-item extraction ───────────────────────
  const [groupBy, setGroupBy] = useState<'part' | 'song' | 'mode' | 'flat'>('song'); // Codex #4: Song-first
  const [scoreView, setScoreView] = useState<'pages' | 'engraved'>('engraved');
  const [scoreTimingMode, setScoreTimingMode] = useState<ScoreTimingMode>('v2');
  const activeLidaRoseScorePart = useMemo(
    () => getActiveLidaRoseScorePart(lidaRoseScorePart, scoreTimingMode),
    [lidaRoseScorePart, scoreTimingMode],
  );
  const [libFilter, setLibFilter] = useState('');
  // Codex addendum: favorites (localStorage) + filter chips
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());
  const [chips, setChips] = useState<Set<string>>(() => new Set());
  useEffect(() => { try { const s = localStorage.getItem('vt3_favorites'); if (s) setFavorites(new Set(JSON.parse(s))); } catch {} }, []);
  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id);
      try { localStorage.setItem('vt3_favorites', JSON.stringify([...n])); } catch {}
      return n;
    });
  }, []);
  const toggleChip = useCallback((c: string) => {
    setChips((prev) => { const n = new Set(prev); if (n.has(c)) n.delete(c); else n.add(c); return n; });
  }, []);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [extractAllRun, setExtractAllRun] = useState(false);

  const libraryGroups = useMemo(() => {
    const q = libFilter.trim().toLowerCase();
    const tokens = q ? q.split(/\s+/) : [];
    const curSong = (currentMm?.song || '').toLowerCase();
    const pass = (it: LibraryItem) => {
      const a = normalizeAsset(it, favorites);
      if (tokens.length) {
        const hay = `${a.song} ${a.part} ${a.role} ${it.title} ${a.hasNotes ? 'notes' : 'needs extraction'}`.toLowerCase();
        if (!tokens.every((t) => hay.includes(t))) return false;
      }
      if (chips.size) {
        if (chips.has('favorites') && !a.favorite) return false;
        if (chips.has('reference') && a.role !== 'reference') return false;
        if (chips.has('backing') && a.role !== 'backing') return false;
        if (chips.has('original') && a.role !== 'original') return false;
        if (chips.has('hasNotes') && !a.hasNotes) return false;
        if (chips.has('needs') && a.role !== 'needs') return false;
        if (chips.has('currentSong') && a.song.toLowerCase() !== curSong) return false;
      }
      return true;
    };
    const items = library.filter(pass);
    if (groupBy === 'flat') return [{ key: 'all', label: `All songs (${items.length})`, items }];
    const map = new Map<string, LibraryItem[]>();
    const order: string[] = [];
    for (const it of items) {
      const mm = parseMmTitle(it.title);
      const key = !mm ? 'Other'
        : groupBy === 'part' ? mm.part
        : groupBy === 'song' ? mm.song
        : (MODE_LABEL[mm.mode] || 'Other mixes');
      if (!map.has(key)) { map.set(key, []); order.push(key); }
      map.get(key)!.push(it);
    }
    const partRank = (k: string) => { const i = (MM_PARTS as readonly string[]).indexOf(k); return i < 0 ? 99 : i; };
    order.sort((a, b) =>
      (groupBy === 'part' ? partRank(a) - partRank(b) : (a === 'Other' ? 1 : 0) - (b === 'Other' ? 1 : 0))
      || a.localeCompare(b));
    return order.map((key) => ({
      key,
      label: `${key} (${map.get(key)!.length})`,
      // Playable items (have an extracted melody) FIRST, then alphabetical — so the one good
      // Baritone/Lead track isn't buried under "no melody yet" decoys (V3.5 discoverability fix).
      items: map.get(key)!.slice().sort((a, b) =>
        (b.noteCount > 0 ? 1 : 0) - (a.noteCount > 0 ? 1 : 0) || a.title.localeCompare(b.title)),
    }));
  }, [library, groupBy, libFilter, favorites, chips, currentMm]);

  // Pinned Favorites — starred items, regardless of group/collapse (addendum #1)
  const favoriteAssets = useMemo(
    () => library.filter((i) => favorites.has(i.id)).map((i) => normalizeAsset(i, favorites)),
    [library, favorites],
  );

  // Collapse ALL groups by default — compact page (Jon 2026-06-27: "stop having the libraries
  // default to open"). Playable items still sort to the top within each group when expanded.
  const didInitCollapse = useRef(false);
  useEffect(() => {
    if (didInitCollapse.current || libraryGroups.length === 0) return;
    didInitCollapse.current = true;
    if (libraryGroups.length > 1) setCollapsed(new Set(libraryGroups.map((g) => g.key)));
  }, [libraryGroups]);

  // ─── Editor state ───────────────────────────────────────────────────────
  const [zoom, setZoom] = useState(80); // px per second

  // ─── V3.6 TransportOrb (Codex layout plan, Jon 2026-06-27): floating, draggable, always-
  // reachable Play/Stop. It IS the Play button, so it can never be permanently covered.
  // Phone: floats freely; position persisted per device. ──
  const [orbPos, setOrbPos] = useState<{ x: number; y: number } | null>(null);
  const [mixerOpen, setMixerOpen] = useState(false); // V3.7: full Mixing Desk as an orb-launched bottom-sheet
  const [orbExpanded, setOrbExpanded] = useState(false); // V3.8: WODEN-style — short-press menu (transport)
  const [scoreFocus, setScoreFocus] = useState(false);   // V3.8: Score Focus — hide everything but the score + orb (Codex cleanup #1)
  const [sourcesOpen, setSourcesOpen] = useState(false); // V3.8: Sources drawer — Library + Add/Extract behind an orb button (Codex #3 / Jon)
  const [helpOpen, setHelpOpen] = useState(false);       // V3.8: 'How to practice' guide behind a ? help button (Codex #8)
  const [abOpen, setAbOpen] = useState(false);           // V3.8: long-press Play → A/B/repeat cluster for focus practice (Jon)
  const [editNotes, setEditNotes] = useState(false);     // V3.8: Pitch Tracker defaults to TRACKING; toggle to correct/delete notes (Codex cleanup #5)
  const playLongTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playDidLongRef = useRef(false);
  // V3.8: orb progress bar — tap = seek there, hold = A/B + speed popup, drag = scrub
  const orbSeekElRef = useRef<HTMLDivElement | null>(null);
  const orbSeekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const orbSeekRef = useRef<{ x: number; moved: boolean; didLong: boolean } | null>(null);
  const [orbNavOpen, setOrbNavOpen] = useState(false);   // V3.8: WODEN-style — long-press menu (jump/nav)
  // WODEN-style free drag: grab ANYWHERE on the orb and move it in 2D. A small
  // threshold distinguishes a tap (button press) from a drag, and we only capture
  // the pointer once it's truly a drag so button taps still fire.
  const orbDragRef = useRef<{ sx: number; sy: number; ox: number; oy: number; pid: number; moved: boolean; cap: boolean } | null>(null);
  const orbMovedRef = useRef(false);   // true during a drag + 400ms after — gates tap/long/double like WODEN
  const orbLongTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const orbDidLongRef = useRef(false);
  const orbDidDoubleRef = useRef(false);
  useEffect(() => { try { const s = localStorage.getItem('vt3_orb_pos'); if (s) setOrbPos(JSON.parse(s)); } catch {} }, []);
  // Keep the orb on-screen across rotation / resize (else it vanishes off-edge).
  useEffect(() => {
    const reclamp = () => setOrbPos((p) => p ? {
      x: Math.max(4, Math.min(window.innerWidth - 48, p.x)),
      y: Math.max(4, Math.min(window.innerHeight - 48, p.y)),
    } : p);
    window.addEventListener('resize', reclamp);
    window.addEventListener('orientationchange', reclamp);
    return () => { window.removeEventListener('resize', reclamp); window.removeEventListener('orientationchange', reclamp); };
  }, []);
  const onOrbDown = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    orbDragRef.current = { sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, pid: e.pointerId, moved: false, cap: false };
  };
  const onOrbMove = (e: React.PointerEvent) => {
    const d = orbDragRef.current;
    if (!d || e.pointerId !== d.pid) return;
    const ddx = e.clientX - d.sx, ddy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(ddx, ddy) < 6) return; // below threshold ⇒ still a tap
    if (!d.cap) { try { (e.currentTarget as HTMLElement).setPointerCapture(d.pid); d.cap = true; } catch {} }
    d.moved = true;
    orbMovedRef.current = true;
    if (orbLongTimer.current) { clearTimeout(orbLongTimer.current); orbLongTimer.current = null; } // a drag cancels long-press
    if (playLongTimer.current) { clearTimeout(playLongTimer.current); playLongTimer.current = null; }
    const x = Math.max(4, Math.min(window.innerWidth - 48, d.ox + ddx));
    const y = Math.max(4, Math.min(window.innerHeight - 48, d.oy + ddy));
    setOrbPos({ x, y });
  };
  const onOrbUp = (e: React.PointerEvent) => {
    const d = orbDragRef.current;
    orbDragRef.current = null;
    if (!d) return;
    if (d.cap) { try { (e.currentTarget as HTMLElement).releasePointerCapture(d.pid); } catch {} }
    // keep movedRef true briefly so the tap/long/double arbitration (fires up to +260ms) is suppressed
    if (d.moved) {
      try { setOrbPos((p) => { if (p) localStorage.setItem('vt3_orb_pos', JSON.stringify(p)); return p; }); } catch {}
      setTimeout(() => { orbMovedRef.current = false; }, 400);
    }
  };
  // Swallow the click that ends a drag so a menu-button tap doesn't fire after moving.
  const onOrbClickCapture = (e: React.MouseEvent) => {
    if (orbMovedRef.current) { e.stopPropagation(); e.preventDefault(); }
  };
  // ── Orb ball gestures (WODEN model): short-press → transport menu, long-press
  //    (500ms) → jump/nav menu, double-tap → Mixing Desk. Drag suppresses all. ──
  const onBallDown = () => {
    orbDidLongRef.current = false;
    if (orbLongTimer.current) clearTimeout(orbLongTimer.current);
    orbLongTimer.current = setTimeout(() => {
      if (orbMovedRef.current) return;       // dragging — not a long-press
      orbDidLongRef.current = true;
      setOrbNavOpen(true); setOrbExpanded(false);
    }, 500);
  };
  const onBallUp = () => {
    if (orbLongTimer.current) { clearTimeout(orbLongTimer.current); orbLongTimer.current = null; }
    if (orbDidLongRef.current) return;
    setTimeout(() => {                        // +260ms so a double-tap can pre-empt the single
      if (!orbDidDoubleRef.current && !orbMovedRef.current) { setOrbNavOpen(false); setOrbExpanded((v) => !v); }
      orbDidDoubleRef.current = false;
    }, 260);
  };
  const onBallCancel = () => { if (orbLongTimer.current) { clearTimeout(orbLongTimer.current); orbLongTimer.current = null; } };
  const onBallDouble = () => { orbDidDoubleRef.current = true; setOrbNavOpen(false); setOrbExpanded(false); setMixerOpen(true); };
  // Play button: SHORT press = play/pause; LONG press (500ms) = toggle the A/B/
  // repeat cluster for focus-practice looping (Jon 2026-06-27).
  const onPlayDown = () => {
    playDidLongRef.current = false;
    if (playLongTimer.current) clearTimeout(playLongTimer.current);
    playLongTimer.current = setTimeout(() => { playDidLongRef.current = true; setAbOpen((v) => !v); }, 500);
  };
  const onPlayUp = () => {
    if (playLongTimer.current) { clearTimeout(playLongTimer.current); playLongTimer.current = null; }
    if (playDidLongRef.current || orbMovedRef.current) return;
    if (playbackState === 'playing') pausePlayback(); else playOrResume();
  };
  const onPlayCancel = () => { if (playLongTimer.current) { clearTimeout(playLongTimer.current); playLongTimer.current = null; } };
  // Orb progress bar gestures: tap → seek there · hold → A/B + speed popup · drag → scrub.
  const orbSeekFromEvent = (e: React.PointerEvent) => {
    const el = orbSeekElRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    seekTo(frac * (playbackDurationRef.current || 0));
  };
  const onOrbSeekDown = (e: React.PointerEvent) => {
    e.stopPropagation(); // don't start an orb drag
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
    orbSeekRef.current = { x: e.clientX, moved: false, didLong: false };
    if (orbSeekTimer.current) clearTimeout(orbSeekTimer.current);
    orbSeekTimer.current = setTimeout(() => { const d = orbSeekRef.current; if (d && !d.moved) { d.didLong = true; setAbOpen(true); } }, 500);
  };
  const onOrbSeekMove = (e: React.PointerEvent) => {
    const d = orbSeekRef.current; if (!d) return;
    e.stopPropagation();
    if (Math.abs(e.clientX - d.x) > 5) {
      d.moved = true;
      if (orbSeekTimer.current) { clearTimeout(orbSeekTimer.current); orbSeekTimer.current = null; }
      orbSeekFromEvent(e); // live scrub
    }
  };
  const onOrbSeekUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    const d = orbSeekRef.current; orbSeekRef.current = null;
    if (orbSeekTimer.current) { clearTimeout(orbSeekTimer.current); orbSeekTimer.current = null; }
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    if (d && !d.moved && !d.didLong) orbSeekFromEvent(e); // a plain tap = seek there
  };
  // Soft reload of the CURRENT song — re-fetch template + re-decode audio + reset
  // the score, without a full page reload (keeps mic permission, page state). For
  // when playback/score gets into a bad spot (Jon 2026-06-27).
  const reloadSong = () => {
    const id = selectedId;
    if (!id) return;
    setSelectedId(null);
    setTimeout(() => setSelectedId(id), 60);
  };
  // Long-press nav: scroll to a section by matching its heading text (first hit wins).
  const orbJumpTo = (keywords: string[]) => {
    const els = Array.from(document.querySelectorAll('h1,h2,h3,summary'));
    for (const kw of keywords) {
      const t = els.find((e) => (e.textContent || '').toLowerCase().includes(kw));
      if (t) { t.scrollIntoView({ behavior: 'smooth', block: 'start' }); break; }
    }
    setOrbNavOpen(false);
  };

  // ─── Dichotic player state (shared between Quick Play and template practice) ──
  // Three independent tracks:
  //   1. Vocals  — hard-LEFT   (Jon's vocal-only stem)
  //   2. Music   — CENTER      (Jon's instrumental/backing stem, optional)
  //   3. Mic     — hard-RIGHT  (live voice)
  const [playbackState, setPlaybackState] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [practiceTime, setPracticeTime] = useState(0);
  const [playbackLabel, setPlaybackLabel] = useState('');
  const [vocalVol, setVocalVol] = useState(150);  // 0-VOL_MAX percent, start loud (stems are quieter than masters)
  const [musicVol, setMusicVol] = useState(150);  // 0-VOL_MAX percent
  const [micVol, setMicVol] = useState(150);      // 0-VOL_MAX percent (V3: starts hotter — raw mic is quiet vs mastered tracks)
  const [micProfile, setMicProfile] = useState<MicProfile>('usb');
  const [micEnabled, setMicEnabled] = useState(false);
  const [plunkEnabled, setPlunkEnabled] = useState(false); // V3.7: OFF by default — plunk is opt-in (Jon 2026-06-27)
  const [plunkVol, setPlunkVol] = useState(PLUNK_DEFAULT_VOL);
  // V3: per-stream balance (-1 hard-left … +1 hard-right). Defaults = V1's fixed pans.
  const [vocalPan, setVocalPan] = useState(-0.7);
  const [musicPan, setMusicPan] = useState(0);
  const [micPan, setMicPan] = useState(1);
  // V3: seek bar + A/B loop state. durationSec mirrors playbackDurationRef for UI.
  const [durationSec, setDurationSec] = useState(0);
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);
  const loopARef = useRef<number | null>(null);
  const loopBRef = useRef<number | null>(null);
  const [loopWhole, setLoopWhole] = useState(false); // V3.6: loop the WHOLE song (Jon 2026-06-27)
  const loopWholeRef = useRef(false);
  // V3.7: pitch-preserving Tempo (the Tempo Trainer). Percent of original speed,
  // 50–125, default 100. Singers think in "tempo," so that's the label.
  const [tempoPct, setTempoPct] = useState(100);
  const tempoRef = useRef(1);          // tempoPct/100, read by the audio clock + plunk
  const [stretching, setStretching] = useState(false); // true while rendering stretched buffers
  useEffect(() => { loopARef.current = loopA; }, [loopA]);
  useEffect(() => { loopBRef.current = loopB; }, [loopB]);
  useEffect(() => { loopWholeRef.current = loopWhole; }, [loopWhole]);
  const startAudioSourceRef = useRef<(() => Promise<void>) | null>(null);
  const seekBarElRef = useRef<HTMLDivElement | null>(null);

  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [musicFileName, setMusicFileName] = useState<string>('');

  const audioCtxRef = useRef<AudioContext | null>(null);

  // Vocal chain (hard-left)
  const vocalGainNodeRef = useRef<GainNode | null>(null);
  const vocalPanNodeRef = useRef<StereoPannerNode | null>(null);
  const vocalSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const vocalBufRef = useRef<AudioBuffer | null>(null);
  const vocalPlayBufRef = useRef<AudioBuffer | null>(null); // V3.7: tempo-stretched; null ⇒ 100% ⇒ play original

  // Music chain (center, optional)
  const musicGainNodeRef = useRef<GainNode | null>(null);
  const musicPanNodeRef = useRef<StereoPannerNode | null>(null);
  const musicSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const musicBufRef = useRef<AudioBuffer | null>(null);
  const musicPlayBufRef = useRef<AudioBuffer | null>(null); // V3.7: tempo-stretched; null ⇒ 100% ⇒ play original
  // Which (source buffers, speed) the current stretched play buffers were rendered for.
  const tempoStampRef = useRef<{ voc: AudioBuffer | null; mus: AudioBuffer | null; spd: number }>({ voc: null, mus: null, spd: 1 });

  const playbackDurationRef = useRef(0);
  const startedAtRef = useRef(0);
  const pauseOffsetRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const micStreamRef = useRef<MediaStream | null>(null);
  const micSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micProfileGainNodeRef = useRef<GainNode | null>(null);
  const micUserGainNodeRef = useRef<GainNode | null>(null);
  const micPanNodeRef = useRef<StereoPannerNode | null>(null);

  const plunkEnabledRef = useRef(false);
  const plunkVolRef = useRef(PLUNK_DEFAULT_VOL);
  const plunkNotesRef = useRef<SyncNote[]>([]);
  const plunkSyncUrlRef = useRef<string | null>(null);
  const plunkTimingModeRef = useRef<ScoreTimingMode>('v2');
  const plunkFetchStartedRef = useRef(false);
  const plunkOscsRef = useRef<any[]>([]);
  const plunkGainRef = useRef<GainNode | null>(null);
  const plunkTimerRef = useRef<number | null>(null);
  const plunkScheduledRef = useRef<Set<string>>(new Set());

  // V3: master brick-wall limiter — every stream routes through it so 400%
  // boosts get loud-but-clean instead of hard-clipping the destination.
  const limiterRef = useRef<DynamicsCompressorNode | null>(null);
  // V3: per-stream post-gain analysers + meter DOM refs (rAF-driven widths —
  // no React re-render per audio frame).
  const vocalAnalyserRef = useRef<AnalyserNode | null>(null);
  const musicAnalyserRef = useRef<AnalyserNode | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  // V3.2 — dedicated 2048-fft analysers for live pitch tracking (reference + voice).
  // 2048 (vs the 256 meter analysers) resolves low barbershop notes (bass ~80Hz).
  const refPitchAnalyserRef = useRef<AnalyserNode | null>(null);
  const micPitchAnalyserRef = useRef<AnalyserNode | null>(null);
  const vocalMeterElRef = useRef<HTMLDivElement | null>(null);
  const musicMeterElRef = useRef<HTMLDivElement | null>(null);
  const micMeterElRef = useRef<HTMLDivElement | null>(null);
  const meterRafRef = useRef<number | null>(null);

  // Mirrors of state used inside stable callbacks so those callbacks don't
  // rebuild on every volume/profile tweak (which would retrigger useEffects).
  const vocalVolRef = useRef(150);
  const musicVolRef = useRef(150);
  const micVolRef = useRef(150);
  const micProfileRef = useRef<MicProfile>('usb');
  useEffect(() => { plunkEnabledRef.current = plunkEnabled; }, [plunkEnabled]);
  useEffect(() => { plunkVolRef.current = plunkVol; }, [plunkVol]);
  useEffect(() => {
    plunkSyncUrlRef.current = activeLidaRoseScorePart?.syncUrl ?? null;
    plunkTimingModeRef.current = activeLidaRoseScorePart?.timingMode ?? scoreTimingMode;
  }, [activeLidaRoseScorePart?.syncUrl, activeLidaRoseScorePart?.timingMode, scoreTimingMode]);
  // V3: pan mirrors for the same stable-callback reason.
  const vocalPanRef = useRef(-0.7);
  const musicPanRef = useRef(0);
  const micPanRef = useRef(1);
  useEffect(() => { vocalPanRef.current = vocalPan; }, [vocalPan]);
  useEffect(() => { musicPanRef.current = musicPan; }, [musicPan]);
  useEffect(() => { micPanRef.current = micPan; }, [micPan]);
  useEffect(() => { vocalVolRef.current = vocalVol; }, [vocalVol]);
  useEffect(() => { musicVolRef.current = musicVol; }, [musicVol]);
  useEffect(() => { micVolRef.current = micVol; }, [micVol]);
  useEffect(() => { micProfileRef.current = micProfile; }, [micProfile]);

  // Pitchforks v1 lock state — the ONE canonical feedback meter.
  // matchStartRef === 0 → idle. > 0 → locked at that timestamp.
  const [matchProgress, setMatchProgress] = useState(0);
  const matchStartRef = useRef(0);
  const currentTargetRef = useRef<PracticeNote | null>(null);
  const livePitchFrameRef = useRef<number | null>(null);
  const [coachStats, setCoachStats] = useState<CoachStats>(() => freshCoachStats());
  const coachStatsRef = useRef<CoachStats>(freshCoachStats());
  const lastCoachSampleMsRef = useRef(0);
  const resetCoachStats = useCallback(() => {
    const fresh = freshCoachStats();
    coachStatsRef.current = fresh;
    lastCoachSampleMsRef.current = 0;
    setCoachStats(fresh);
  }, []);
  const [takeHistory, setTakeHistory] = useState<TakeSummary[]>([]);
  const [engravingReports, setEngravingReports] = useState<EngravingReport[]>([]);
  const [reportStatus, setReportStatus] = useState<string | null>(null);
  const currentTemplateRef = useRef<FullTemplate | null>(null);
  const playbackLabelRef = useRef('');
  const practiceTimeRef = useRef(0);
  useEffect(() => { currentTemplateRef.current = currentTemplate; }, [currentTemplate]);
  useEffect(() => { playbackLabelRef.current = playbackLabel; }, [playbackLabel]);
  useEffect(() => { practiceTimeRef.current = practiceTime; }, [practiceTime]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setTakeHistory(JSON.parse(localStorage.getItem(TAKE_HISTORY_KEY) || '[]'));
    } catch {
      setTakeHistory([]);
    }
    try {
      setEngravingReports(JSON.parse(localStorage.getItem(ENGRAVING_REPORTS_KEY) || '[]'));
    } catch {
      setEngravingReports([]);
    }
  }, []);
  const saveTakeSummary = useCallback((reason: TakeSummary['reason'], endTimeSec = practiceTimeRef.current) => {
    const stats = coachStatsRef.current;
    if (!stats.samples || stats.samples < 3) return;
    const accuracyPct = Math.round((stats.onPitch / stats.samples) * 100);
    const summary: TakeSummary = {
      id: `take-${Date.now()}`,
      createdAt: new Date().toISOString(),
      title: currentTemplateRef.current?.title || playbackLabelRef.current || 'Practice take',
      reason,
      durationSec: Math.max(0, endTimeSec),
      samples: stats.samples,
      accuracyPct,
      avgCents: Math.round(stats.sumSignedCents / stats.samples),
      meanAbsCents: Math.round(stats.sumAbsCents / stats.samples),
      sharpPct: Math.round((stats.sharp / stats.samples) * 100),
      flatPct: Math.round((stats.flat / stats.samples) * 100),
    };
    setTakeHistory((prev) => {
      const next = [summary, ...prev].slice(0, 10);
      try { localStorage.setItem(TAKE_HISTORY_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);
  const clearTakeHistory = useCallback(() => {
    setTakeHistory([]);
    try { localStorage.removeItem(TAKE_HISTORY_KEY); } catch {}
  }, []);

  // Editor scroll container for auto-scrolling the piano-roll with the playhead.
  const editorScrollRef = useRef<HTMLDivElement | null>(null);

  // Pitch detection for the Pitchforks v1 slider bar. Uses its own mic
  // stream with AEC/noise-suppression ON (opposite of the routing stream,
  // which keeps AEC off for zero-latency monitoring). Both streams coexist.
  const {
    pitch: livePitch,
    pitchRef: livePitchRef,
    startListening: startPitchDetect,
    stopListening: stopPitchDetect,
  } = usePitchDetection({ noiseGateDb: -45 });

  // ─── V3.2: live pitch tracking — your voice vs the REAL audio, in real time ──
  // The reference line is detected from the PLAYING audio (not the BasicPitch
  // transcription), so it's the true sung pitch even on un-extracted tracks.
  // The mic pitch is detected off the monitoring stream Jon can already hear,
  // so it doesn't depend on the (fragile) second usePitchDetection stream.
  const refDetectorRef = useRef<PitchDetector<Float32Array<ArrayBuffer>> | null>(null);
  const micDetectorRef = useRef<PitchDetector<Float32Array<ArrayBuffer>> | null>(null);
  const refBufRef = useRef<Float32Array<ArrayBuffer> | null>(null);
  const micBufRef = useRef<Float32Array<ArrayBuffer> | null>(null);
  const refMidiRef = useRef<number | null>(null);   // live reference pitch (fractional MIDI)
  const trackMicMidiRef = useRef<number | null>(null); // live voice pitch (fractional MIDI)
  const refSmoothRef = useRef(0);
  const micSmoothRef = useRef(0);
  // V3.3: hold-last-value timestamps (bridge <150ms mic dropouts so the trace
  // doesn't snap to nothing) + the SimplySing-style glowing voice trail buffer.
  const refLastMsRef = useRef(0);
  const micLastMsRef = useRef(0);
  const micTrailRef = useRef<{ t: number; midi: number; on: boolean }[]>([]);
  const [refMidi, setRefMidi] = useState<number | null>(null);
  const [trackMicMidi, setTrackMicMidi] = useState<number | null>(null);
  // Headphones (default) keeps echo-cancellation OFF for zero-latency dichotic
  // monitoring; Speakers turns it ON so the reference bleed can't fake a match.
  const [outputMode, setOutputMode] = useState<'headphones' | 'speakers'>('headphones');
  const outputModeRef = useRef<'headphones' | 'speakers'>('headphones');
  useEffect(() => { outputModeRef.current = outputMode; }, [outputMode]);

  // ───────────────────────────────────────────────────────────────────────
  // Library fetch
  // ───────────────────────────────────────────────────────────────────────
  const refreshLibrary = useCallback(async () => {
    setLoadingLibrary(true);
    try {
      const r = await fetch('/api/vocal-trainer/library', { cache: 'no-store' });
      const j = await r.json();
      setLibrary(j.templates || []);
    } catch (e) {
      console.error('[VocalTrainer] library fetch failed:', e);
    } finally {
      setLoadingLibrary(false);
    }
  }, []);

  useEffect(() => { refreshLibrary(); }, [refreshLibrary]);

  // Load a template (notes + metadata) when selected. The audio decode runs
  // in a separate useEffect below — that one is defined after loadTemplateAudio
  // to avoid a temporal-dead-zone reference.
  useEffect(() => {
    if (!selectedId) { setCurrentTemplate(null); return; }
    const lib = library.find(l => l.id === selectedId);
    if (!lib) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(lib.templateUrl, { cache: 'no-store' });
        const tpl = await r.json();
        if (cancelled) return;
        setCurrentTemplate(tpl);
        setExtractedNotes(tpl.notes || []);
        setExtractedDuration(tpl.durationSec || 0);
        setTempo(tpl.tempo || 100);
        setStatusMsg(`Loaded "${tpl.title}" — ${tpl.notes?.length || 0} notes`);
      } catch (e) {
        console.error('[VocalTrainer] template load failed:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedId, library]);

  // Auto-publish loaded template to Synthesia localStorage
  useEffect(() => {
    if (!currentTemplate || !currentTemplate.notes?.length) return;
    const songNotes = rawNotesToSongNotes(currentTemplate.notes, currentTemplate.tempo || 100);
    publishToSynthesia({ id: currentTemplate.id, title: currentTemplate.title, songNotes });
  }, [currentTemplate]);

  // Publish ALL library templates to Synthesia on mount (so they appear in song picker)
  useEffect(() => {
    if (library.length === 0) return;
    (async () => {
      for (const item of library) {
        try {
          const r = await fetch(item.templateUrl, { cache: 'no-store' });
          const tpl = await r.json();
          if (Array.isArray(tpl.notes) && tpl.notes.length > 0) {
            const songNotes = rawNotesToSongNotes(tpl.notes, tpl.tempo || 100);
            publishToSynthesia({ id: tpl.id, title: tpl.title, songNotes });
          }
        } catch {}
      }
    })();
  }, [library]);

  // ───────────────────────────────────────────────────────────────────────
  // Drag-drop + extraction
  // ───────────────────────────────────────────────────────────────────────
  const handleFileChosen = useCallback((file: File) => {
    setUploadFile(file);
    setUploadTitle(file.name.replace(/\.[^.]+$/, ''));
    setExtractedNotes([]);
    setStatusMsg(null);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileChosen(f);
  }, [handleFileChosen]);

  const runExtraction = useCallback(async () => {
    if (!uploadFile) return;
    setExtracting(true);
    setStatusMsg(null);
    try {
      const { rawNotes, durationSec, pitchContour } = await extractNotesFromAudio(uploadFile, {
        onProgress: setExtractProgress,
        midiMin: PITCH_MIN,
        midiMax: PITCH_MAX,
      });
      // Greedy melody-line filter
      const melody = extractMelodyLine(rawNotes, 0.05);
      setExtractedNotes(melody);
      setExtractedDuration(durationSec);
      setVocalContour(pitchContour);
      setStatusMsg(`Extracted ${rawNotes.length} notes → ${melody.length} after melody filter + ${pitchContour.length}-point pitch curve. Edit obvious garbage, then Save.`);
    } catch (e) {
      console.error('[VocalTrainer] extract failed:', e);
      setStatusMsg(`Extraction failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setExtracting(false);
      setExtractProgress(null);
    }
  }, [uploadFile]);

  // ───────────────────────────────────────────────────────────────────────
  // Save (upload to blob)
  // ───────────────────────────────────────────────────────────────────────
  const saveTemplate = useCallback(async () => {
    if (!uploadFile || extractedNotes.length === 0) {
      setStatusMsg('Nothing to save — pick an audio file and run extraction first.');
      return;
    }
    setSaving(true);
    try {
      const template = {
        title: uploadTitle || 'Untitled',
        notes: extractedNotes,
        tempo,
        durationSec: extractedDuration,
      };
      const fd = new FormData();
      fd.append('audio', uploadFile);
      fd.append('template', JSON.stringify(template));
      const r = await fetch('/api/vocal-trainer/upload', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'upload failed');
      setStatusMsg(`✓ Saved "${j.template.title}" (id: ${j.id}). Now in library + Synthesia.`);
      // Publish to Synthesia immediately
      const songNotes = rawNotesToSongNotes(extractedNotes, tempo);
      publishToSynthesia({ id: j.id, title: j.template.title, songNotes });
      // Refresh library, select the new entry
      await refreshLibrary();
      setSelectedId(j.id);
      setUploadFile(null);
    } catch (e) {
      console.error('[VocalTrainer] save failed:', e);
      setStatusMsg(`Save failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }, [uploadFile, extractedNotes, uploadTitle, tempo, extractedDuration, refreshLibrary]);

  // Update an existing template's edited notes
  const saveEditedTemplate = useCallback(async () => {
    if (!currentTemplate) return;
    setSaving(true);
    try {
      const updated = { ...currentTemplate, notes: extractedNotes, tempo, durationSec: extractedDuration };
      const r = await fetch('/api/vocal-trainer/upload', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'update failed');
      setStatusMsg(`✓ Updated "${currentTemplate.title}" — ${extractedNotes.length} notes`);
      const songNotes = rawNotesToSongNotes(extractedNotes, tempo);
      publishToSynthesia({ id: currentTemplate.id, title: currentTemplate.title, songNotes });
      await refreshLibrary();
    } catch (e) {
      setStatusMsg(`Update failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }, [currentTemplate, extractedNotes, tempo, extractedDuration, refreshLibrary]);

  // ───────────────────────────────────────────────────────────────────────
  // V3.1 — Extract the vocal line for an item ALREADY in the library.
  // Same BasicPitch melody+contour pipeline as the upload path, but sourced
  // from the item's stored audioUrl, then PUT back (re-publishes to Synthesia).
  // This is what backfills the notes:0 entries (the 40 Music Man part tracks).
  // ───────────────────────────────────────────────────────────────────────
  const extractLibraryItem = useCallback(async (item: LibraryItem, opts?: { silent?: boolean }) => {
    if (!item.audioUrl) {
      if (!opts?.silent) setStatusMsg(`"${item.title}" has no audio to extract.`);
      return false;
    }
    setExtractingId(item.id);
    if (!opts?.silent) setStatusMsg(`Extracting vocal line for "${item.title}"…`);
    try {
      const tpl = await (await fetch(item.templateUrl, { cache: 'no-store' })).json();
      const blob = await (await fetch(item.audioUrl, { cache: 'no-store' })).blob();
      const { rawNotes, durationSec, pitchContour } = await extractNotesFromAudio(blob, {
        onProgress: setExtractProgress,
        midiMin: PITCH_MIN,
        midiMax: PITCH_MAX,
      });
      const melody = extractMelodyLine(rawNotes, 0.05);
      const updated = {
        ...tpl,
        notes: melody,
        durationSec: durationSec || tpl.durationSec || 0,
        tempo: tpl.tempo || 100,
      };
      const put = await fetch('/api/vocal-trainer/upload', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      if (!put.ok) throw new Error((await put.json()).error || 'update failed');
      const songNotes = rawNotesToSongNotes(melody, updated.tempo);
      publishToSynthesia({ id: updated.id, title: updated.title, songNotes });
      // If this item is open in the editor, reflect the new notes + contour live.
      if (selectedId === item.id) {
        setCurrentTemplate(updated);
        setExtractedNotes(melody);
        setExtractedDuration(updated.durationSec);
        setVocalContour(pitchContour);
        setTempo(updated.tempo);
      }
      if (!opts?.silent) {
        setStatusMsg(`✓ Extracted "${item.title}" — ${melody.length} notes`);
        await refreshLibrary();
      }
      return true;
    } catch (e) {
      console.error('[VocalTrainer] library extract failed:', e);
      if (!opts?.silent) setStatusMsg(`Extract failed for "${item.title}": ${e instanceof Error ? e.message : String(e)}`);
      return false;
    } finally {
      setExtractingId(null);
      setExtractProgress(null);
    }
  }, [selectedId, refreshLibrary]);

  // V3.1 — Extract every notes:0 item in a group, one at a time (BasicPitch is heavy).
  const extractAllMissing = useCallback(async (items: LibraryItem[]) => {
    const missing = items.filter((i) => i.noteCount === 0 && i.audioUrl);
    if (missing.length === 0) { setStatusMsg('No un-extracted songs in this group.'); return; }
    setExtractAllRun(true);
    let done = 0;
    for (const it of missing) {
      setStatusMsg(`Extracting ${done + 1}/${missing.length}: "${it.title}"…`);
      await extractLibraryItem(it, { silent: true });
      done++;
    }
    await refreshLibrary();
    setExtractAllRun(false);
    setStatusMsg(`✓ Extracted ${done} song${done === 1 ? '' : 's'} in this group.`);
  }, [extractLibraryItem, refreshLibrary]);

  // ───────────────────────────────────────────────────────────────────────
  // Dichotic player — quick-play OR template practice, shared audio graph
  // ───────────────────────────────────────────────────────────────────────

  // Build AudioContext + vocal/music chains on first use.
  // Reads initial volumes / mic profile from refs so its identity stays
  // stable across UI tweaks — downstream callbacks would otherwise rebuild.
  const ensureAudioGraph = useCallback(() => {
    if (!audioCtxRef.current) {
      // V3: ALWAYS 'interactive' — this is a live-monitoring surface; V1's
      // 'playback' hint (usb profile default) added ~100-200ms mic echo.
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        latencyHint: 'interactive',
      });
    }
    const ctx = audioCtxRef.current!;
    if (!limiterRef.current) {
      // Brick-wall safety limiter on the master bus: 400% stream boosts get
      // loud-but-clean instead of hard-clipping the DAC.
      const lim = ctx.createDynamicsCompressor();
      lim.threshold.value = -3;
      lim.knee.value = 0;
      lim.ratio.value = 20;
      lim.attack.value = 0.001;
      lim.release.value = 0.1;
      lim.connect(ctx.destination);
      limiterRef.current = lim;
    }
    if (!vocalGainNodeRef.current) {
      const gain = ctx.createGain();
      gain.gain.value = vocalVolRef.current / 100;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const pan = ctx.createStereoPanner();
      pan.pan.value = vocalPanRef.current; // V3: user-adjustable balance (default -0.7)
      gain.connect(analyser).connect(pan).connect(limiterRef.current!);
      // V3.2: 2048-fft leaf tap off the gain node (pre-pan, pre-limiter) so the
      // live reference-pitch read reflects the recording content regardless of
      // L/R balance or master limiting.
      const pitchAnalyser = ctx.createAnalyser();
      pitchAnalyser.fftSize = 2048;
      gain.connect(pitchAnalyser);
      refPitchAnalyserRef.current = pitchAnalyser;
      vocalGainNodeRef.current = gain;
      vocalAnalyserRef.current = analyser;
      vocalPanNodeRef.current = pan;
    }
    if (!musicGainNodeRef.current) {
      const gain = ctx.createGain();
      gain.gain.value = musicVolRef.current / 100;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const pan = ctx.createStereoPanner();
      pan.pan.value = musicPanRef.current; // V3: user-adjustable balance (default center)
      gain.connect(analyser).connect(pan).connect(limiterRef.current!);
      musicGainNodeRef.current = gain;
      musicAnalyserRef.current = analyser;
      musicPanNodeRef.current = pan;
    }
    return ctx;
  }, []);

  const currentPlunkGain = () => (plunkVolRef.current / 100) * PLUNK_GAIN_SCALE;

  const ensurePlunkGain = useCallback((ctx: AudioContext) => {
    if (!plunkGainRef.current || plunkGainRef.current.context !== ctx) {
      try { plunkGainRef.current?.disconnect(); } catch {}
      const gain = ctx.createGain();
      gain.gain.value = currentPlunkGain();
      gain.connect(limiterRef.current ?? ctx.destination);
      plunkGainRef.current = gain;
    }
    return plunkGainRef.current;
  }, []);

  const stopPlunkNodes = useCallback(() => {
    if (plunkTimerRef.current != null) {
      window.clearInterval(plunkTimerRef.current);
      plunkTimerRef.current = null;
    }
    for (const node of plunkOscsRef.current) {
      try { if (typeof node.stop === 'function') node.stop(); } catch {}
      try { if (typeof node.disconnect === 'function') node.disconnect(); } catch {}
    }
    plunkOscsRef.current = [];
    plunkScheduledRef.current.clear();
  }, []);

  const playPlunkTone = useCallback((ctx: AudioContext, note: SyncNote, toneStart: number, scoreNow: number) => {
    const noteEnd = note.startTimeSeconds + note.durationSeconds;
    const remaining = note.startTimeSeconds < scoreNow
      ? noteEnd - scoreNow
      : note.durationSeconds;
    // song-seconds of audible note, then ÷spd to wall-clock so the blip lasts as
    // long as the (stretched) note. Cap stays a wall-clock ceiling.
    const songDur = Math.max(0.04, Math.min(remaining, note.durationSeconds));
    const toneDuration = Math.min(songDur / (tempoRef.current || 1), PLUNK_MAX_TONE_SECONDS);
    if (!Number.isFinite(toneDuration) || toneDuration <= 0.02) return;

    const toneEnd = toneStart + toneDuration;
    const freq = midiToFreq(note.pitchMidi);
    const attack = Math.min(0.018, Math.max(0.005, toneDuration * 0.12));
    const release = Math.min(0.18, Math.max(0.025, toneDuration * 0.22));
    const releaseStart = Math.max(toneStart + attack, toneEnd - release);

    const tri = ctx.createOscillator();
    tri.type = 'triangle';
    tri.frequency.setValueAtTime(freq, toneStart);

    const sine = ctx.createOscillator();
    sine.type = 'sine';
    sine.frequency.setValueAtTime(freq, toneStart);
    sine.detune.setValueAtTime(3, toneStart);

    const partialGain = ctx.createGain();
    partialGain.gain.setValueAtTime(0.7, toneStart);

    const noteGain = ctx.createGain();
    // V3.8: gentle acoustic envelope (matched to ChoirPractice.playGuideNote) —
    // soft peak + exponential decay instead of a 0.95 spike + linear-to-zero
    // "plunk." This is why choir tones sound nicer; same fix here.
    noteGain.gain.setValueAtTime(0.0001, toneStart);
    noteGain.gain.linearRampToValueAtTime(0.22, toneStart + attack);
    noteGain.gain.setValueAtTime(0.16, releaseStart);
    noteGain.gain.exponentialRampToValueAtTime(0.0008, toneEnd);

    const plunkGain = ensurePlunkGain(ctx);
    tri.connect(noteGain);
    sine.connect(partialGain).connect(noteGain);
    noteGain.connect(plunkGain);
    tri.start(toneStart);
    sine.start(toneStart);
    tri.stop(toneEnd + 0.01);
    sine.stop(toneEnd + 0.01);
    tri.onended = () => {
      for (const node of [tri, sine, partialGain, noteGain]) {
        try { node.disconnect(); } catch {}
      }
    };
    plunkOscsRef.current.push(tri, sine, partialGain, noteGain);
  }, [ensurePlunkGain]);

  const schedulePlunkWindow = useCallback(() => {
    if (!plunkEnabledRef.current) return;
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state === 'closed') return;
    const notes = plunkNotesRef.current;
    if (!notes.length) return;

    const spd = tempoRef.current || 1;
    const scoreNow = Math.max(0, (ctx.currentTime - startedAtRef.current) * spd); // song-seconds
    const windowEnd = scoreNow + PLUNK_LOOKAHEAD_SECONDS;
    ensurePlunkGain(ctx).gain.setTargetAtTime(currentPlunkGain(), ctx.currentTime, 0.012);
    let scheduledThisWindow = 0;

    notes.forEach((note, index) => {
      const noteEnd = note.startTimeSeconds + note.durationSeconds;
      if (noteEnd < scoreNow - 0.015) return;
      if (note.startTimeSeconds > windowEnd) return;
      const key = `${index}:${note.startTimeSeconds.toFixed(4)}:${note.pitchMidi}`;
      if (plunkScheduledRef.current.has(key)) return;
      plunkScheduledRef.current.add(key);
      // note time is song-seconds; convert to wall-clock for scheduling (÷spd)
      const scoreAlignedStart = startedAtRef.current + note.startTimeSeconds / spd;
      const toneStart = Math.max(ctx.currentTime + 0.012, scoreAlignedStart);
      playPlunkTone(ctx, note, toneStart, scoreNow);
      scheduledThisWindow++;
    });

    (window as any).__VT3_PLUNK_ACTIVE__ = {
      noteCount: notes.length,
      scheduledCount: plunkScheduledRef.current.size,
      scheduledThisWindow,
      scoreNow,
      windowEnd,
      volumePercent: plunkVolRef.current,
      gain: currentPlunkGain(),
      syncUrl: plunkSyncUrlRef.current,
      timingMode: plunkTimingModeRef.current,
    };
  }, [ensurePlunkGain, playPlunkTone]);

  const startPlunkScheduler = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || !plunkEnabledRef.current) return;
    ensurePlunkGain(ctx);
    if (plunkTimerRef.current != null) window.clearInterval(plunkTimerRef.current);
    plunkScheduledRef.current.clear();
    schedulePlunkWindow();
    plunkTimerRef.current = window.setInterval(schedulePlunkWindow, PLUNK_SCHEDULER_MS);
  }, [ensurePlunkGain, schedulePlunkWindow]);

  useEffect(() => {
    plunkNotesRef.current = [];
    plunkFetchStartedRef.current = false;
    stopPlunkNodes();
  }, [activeLidaRoseScorePart?.syncUrl, currentTemplate?.id, stopPlunkNodes]);

  useEffect(() => {
    if (!plunkEnabled) {
      stopPlunkNodes();
      return;
    }
    if (plunkFetchStartedRef.current || plunkNotesRef.current.length) return;
    // V3.6 (Jon 2026-06-27): PLUNK MIRRORS THE VOICE — the loaded item's own EXTRACTED notes
    // drive the plunk, for EVERY song (not just Lida Rose). Fixes "nothing came out" on the
    // studio items + uses the better isolated-audio notes. Falls back to the score sync only
    // when an item has no notes of its own.
    const tplNotes = currentTemplate?.notes;
    if (Array.isArray(tplNotes) && tplNotes.length) {
      plunkNotesRef.current = (tplNotes
        .filter((n) => n != null && Number.isFinite(n.pitchMidi) && Number.isFinite(n.startTimeSeconds) && Number.isFinite(n.durationSeconds))
        .map((n) => ({ pitchMidi: n.pitchMidi, startTimeSeconds: n.startTimeSeconds, durationSeconds: n.durationSeconds }))
        .sort((a, b) => a.startTimeSeconds - b.startTimeSeconds)) as SyncNote[];
      plunkFetchStartedRef.current = true;
      return;
    }
    if (!activeLidaRoseScorePart?.syncUrl) return;
    plunkFetchStartedRef.current = true;
    (async () => {
      try {
        const r = await fetch(activeLidaRoseScorePart.syncUrl, { cache: 'no-store' });
        if (!r.ok) throw new Error(`fetch ${r.status} ${r.statusText}`);
        const j = await r.json();
        plunkNotesRef.current = Array.isArray(j.notes)
          ? (j.notes.filter((n: Partial<SyncNote> | null | undefined) =>
              n != null
              && Number.isFinite(n.pitchMidi)
              && Number.isFinite(n.startTimeSeconds)
              && Number.isFinite(n.durationSeconds)
            ) as SyncNote[]).sort((a, b) => a.startTimeSeconds - b.startTimeSeconds)
          : [];
      } catch (e) {
        console.error('[VocalTrainer] plunk sync-note load failed:', e);
      }
    })();
  }, [activeLidaRoseScorePart?.syncUrl, plunkEnabled, currentTemplate, stopPlunkNodes]);

  useEffect(() => {
    if (!plunkGainRef.current) return;
    try {
      plunkGainRef.current.gain.setValueAtTime(
        currentPlunkGain(),
        plunkGainRef.current.context.currentTime,
      );
    } catch {}
  }, [plunkVol]);

  useEffect(() => {
    if (!plunkEnabled) {
      stopPlunkNodes();
      return;
    }
    if (playbackState === 'playing') startPlunkScheduler();
  }, [plunkEnabled, playbackState, startPlunkScheduler, stopPlunkNodes]);

  // Stop any in-flight BufferSources (both vocal + music) + cancel the RAF tick.
  const stopAudioSource = useCallback(() => {
    if (vocalSourceRef.current) {
      try { vocalSourceRef.current.onended = null; } catch {}
      try { vocalSourceRef.current.stop(); } catch {}
      try { vocalSourceRef.current.disconnect(); } catch {}
      vocalSourceRef.current = null;
    }
    if (musicSourceRef.current) {
      try { musicSourceRef.current.onended = null; } catch {}
      try { musicSourceRef.current.stop(); } catch {}
      try { musicSourceRef.current.disconnect(); } catch {}
      musicSourceRef.current = null;
    }
    stopPlunkNodes();
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, [stopPlunkNodes]);

  // V3.7: make sure the tempo-stretched play buffers match the current
  // (source buffers, speed). Renders only when something changed — at 100% it
  // clears the play buffers so the originals play (zero-cost identity path).
  const ensureTempoBuffers = useCallback(() => {
    const spd = tempoRef.current || 1;
    if (Math.abs(spd - 1) < 0.001) {
      vocalPlayBufRef.current = null;
      musicPlayBufRef.current = null;
      tempoStampRef.current = { voc: null, mus: null, spd: 1 };
      return;
    }
    const s = tempoStampRef.current;
    const fresh = s.spd === spd && s.voc === vocalBufRef.current && s.mus === musicBufRef.current
      && (!!vocalPlayBufRef.current || !vocalBufRef.current)
      && (!!musicPlayBufRef.current || !musicBufRef.current);
    if (fresh) return;
    const ctx = ensureAudioGraph();
    vocalPlayBufRef.current = vocalBufRef.current ? stretchBuffer(ctx, vocalBufRef.current, spd) : null;
    musicPlayBufRef.current = musicBufRef.current ? stretchBuffer(ctx, musicBufRef.current, spd) : null;
    tempoStampRef.current = { voc: vocalBufRef.current, mus: musicBufRef.current, spd };
  }, [ensureAudioGraph]);

  // V3.7: change tempo (percent of original). Pitch-locked. Re-renders the
  // stretched buffers and, if playing, seamlessly resumes at the same song spot.
  const changeTempo = useCallback((pct: number) => {
    const clamped = Math.max(50, Math.min(200, Math.round(pct)));
    const newSpd = clamped / 100;
    const oldSpd = tempoRef.current || 1;
    const ctx = audioCtxRef.current;
    const wasPlaying = playbackState === 'playing';
    // current song-position under the OLD tempo (must read before we change it)
    const pos = wasPlaying && ctx
      ? Math.max(0, Math.min((ctx.currentTime - startedAtRef.current) * oldSpd, playbackDurationRef.current))
      : pauseOffsetRef.current;
    if (wasPlaying) stopAudioSource();
    setTempoPct(clamped);
    tempoRef.current = newSpd;
    const needsRender = Math.abs(newSpd - 1) > 0.001 && (!!vocalBufRef.current || !!musicBufRef.current);
    setStretching(needsRender);
    // defer the (blocking) render so the "Stretching…" hint paints first
    setTimeout(() => {
      ensureTempoBuffers();
      setStretching(false);
      pauseOffsetRef.current = pos;
      setPracticeTime(pos);
      if (wasPlaying) startAudioSourceRef.current?.();
    }, needsRender ? 30 : 0);
  }, [playbackState, ensureTempoBuffers, stopAudioSource]);

  // Start playback from pauseOffsetRef. Fires both vocal + music sources in
  // lockstep so they stay synchronized even under pause/resume.
  const startAudioSource = useCallback(async () => {
    const vocBuf = vocalBufRef.current;
    const musBuf = musicBufRef.current;
    if (!vocBuf && !musBuf) {
      setStatusMsg('Nothing loaded — upload a vocal track, a music track, or pick a library template.');
      return;
    }
    const ctx = ensureAudioGraph();
    if (ctx.state === 'suspended') await ctx.resume();

    // Clean up any lingering sources (no state change).
    stopAudioSource();

    // V3.7: make the tempo-stretched buffers current for (source, speed); at
    // 100% the play refs stay null and we play the originals (identity path).
    ensureTempoBuffers();
    const spd = tempoRef.current || 1;
    const vocPlay = vocalPlayBufRef.current ?? vocBuf;
    const musPlay = musicPlayBufRef.current ?? musBuf;

    const offset = Math.max(0, Math.min(
      pauseOffsetRef.current,
      playbackDurationRef.current - 0.01,
    ));

    // Fire both sources at the SAME ctx.currentTime so they stay aligned.
    const startAt = ctx.currentTime + 0.02; // tiny lookahead to align both

    if (vocPlay) {
      const src = ctx.createBufferSource();
      src.buffer = vocPlay;
      src.connect(vocalGainNodeRef.current!);
      // offset is ORIGINAL song-seconds; the play buffer is time-scaled by 1/spd
      const vocOffset = Math.min(offset, (vocBuf?.duration ?? offset)) / spd;
      src.start(startAt, Math.max(0, Math.min(vocOffset, vocPlay.duration - 0.01)));
      vocalSourceRef.current = src;
      src.onended = () => {
        if (vocalSourceRef.current === src) {
          // Natural end of vocal — let the music/tick continue; the tick will
          // stop at playbackDurationRef.current.
          vocalSourceRef.current = null;
        }
      };
    }
    if (musPlay) {
      const src = ctx.createBufferSource();
      src.buffer = musPlay;
      src.connect(musicGainNodeRef.current!);
      const musOffset = Math.min(offset, (musBuf?.duration ?? offset)) / spd;
      src.start(startAt, Math.max(0, Math.min(musOffset, musPlay.duration - 0.01)));
      musicSourceRef.current = src;
      src.onended = () => {
        if (musicSourceRef.current === src) {
          musicSourceRef.current = null;
        }
      };
    }

    // startedAt anchors the song clock: songtime = (currentTime - startedAt)*spd,
    // and equals `offset` at this start moment.
    startedAtRef.current = startAt - offset / spd;
    if (plunkEnabledRef.current) startPlunkScheduler();
    setPlaybackState('playing');

    const tick = () => {
      const c = audioCtxRef.current;
      if (!c) return;
      // song-seconds = wall-seconds × speed (the play buffer is time-scaled 1/spd)
      const elapsed = Math.max(0, (c.currentTime - startedAtRef.current) * (tempoRef.current || 1));
      setPracticeTime(elapsed);
      // V3: A/B loop — when the playhead crosses B, jump back to A and keep going.
      const la = loopARef.current;
      const lb = loopBRef.current;
      if (la != null && lb != null && lb > la && elapsed >= lb) {
        stopAudioSource();
        pauseOffsetRef.current = la;
        setPracticeTime(la);
        startAudioSourceRef.current?.();
        return;
      }
      if (elapsed >= playbackDurationRef.current) {
        // V3.6: full-song loop — restart from 0 instead of stopping (Jon 2026-06-27)
        if (loopWholeRef.current) {
          stopAudioSource();
          pauseOffsetRef.current = 0;
          setPracticeTime(0);
          startAudioSourceRef.current?.();
          return;
        }
        saveTakeSummary('ended', playbackDurationRef.current);
        stopAudioSource();
        pauseOffsetRef.current = 0;
        setPracticeTime(0);
        setPlaybackState('idle');
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [ensureAudioGraph, ensureTempoBuffers, saveTakeSummary, startPlunkScheduler, stopAudioSource]);

  // V3: keep a ref to the latest startAudioSource so the tick closure (and
  // seek) can restart playback without stale-closure issues.
  useEffect(() => { startAudioSourceRef.current = startAudioSource; });

  const pausePlayback = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || playbackState !== 'playing') return;
    const elapsed = (ctx.currentTime - startedAtRef.current) * (tempoRef.current || 1);
    pauseOffsetRef.current = Math.max(0, Math.min(elapsed, playbackDurationRef.current));
    stopAudioSource();
    setPracticeTime(pauseOffsetRef.current);
    setPlaybackState('paused');
  }, [playbackState, stopAudioSource]);

  const stopPlayback = useCallback(() => {
    saveTakeSummary('stopped', practiceTime);
    stopAudioSource();
    pauseOffsetRef.current = 0;
    setPracticeTime(0);
    setPlaybackState('idle');
    resetCoachStats();
  }, [practiceTime, saveTakeSummary, stopAudioSource, resetCoachStats]);

  const playOrResume = useCallback(async () => {
    if (playbackState === 'playing') return;
    if (playbackState === 'idle' || pauseOffsetRef.current <= 0.02) resetCoachStats();
    await startAudioSource();
  }, [playbackState, resetCoachStats, startAudioSource]);

  // Recompute the effective playback duration from whichever tracks are loaded.
  const recomputeDuration = useCallback(() => {
    const vocDur = vocalBufRef.current?.duration ?? 0;
    const musDur = musicBufRef.current?.duration ?? 0;
    playbackDurationRef.current = Math.max(vocDur, musDur);
    setDurationSec(playbackDurationRef.current); // V3: mirror for the seek-bar UI
    // New material invalidates old loop points.
    setLoopA(null);
    setLoopB(null);
  }, []);

  // ─── V3: seek + A/B loop controls ────────────────────────────────────────

  // Jump to an absolute time. Works idle, paused, or mid-playback.
  const seekTo = useCallback((t: number) => {
    const dur = playbackDurationRef.current;
    if (dur <= 0) return;
    const clamped = Math.max(0, Math.min(t, dur - 0.01));
    pauseOffsetRef.current = clamped;
    setPracticeTime(clamped);
    if (playbackState === 'playing') {
      stopAudioSource();
      startAudioSourceRef.current?.();
    } else if (playbackState === 'idle') {
      setPlaybackState('paused'); // show the playhead where they clicked
    }
  }, [playbackState, stopAudioSource]);

  const loopPhrase = useCallback((phrase: PracticePhrase) => {
    const dur = playbackDurationRef.current || phrase.end;
    const start = Math.max(0, Math.min(phrase.start, dur - 0.01));
    const end = Math.max(start + 0.2, Math.min(phrase.end, dur));
    setLoopA(start);
    setLoopB(end);
    seekTo(start);
  }, [seekTo]);

  // Click (or drag) on the seek bar → seek proportionally.
  const handleSeekBarPointer = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = seekBarElRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekTo(frac * playbackDurationRef.current);
  }, [seekTo]);

  const markLoopA = useCallback(() => {
    const t = pauseOffsetRef.current && playbackState !== 'playing'
      ? pauseOffsetRef.current
      : practiceTime;
    setLoopA(t);
    // Keep the loop sane: A must precede B.
    if (loopB != null && t >= loopB) setLoopB(null);
  }, [practiceTime, playbackState, loopB]);

  const markLoopB = useCallback(() => {
    const t = practiceTime;
    if (loopA != null && t <= loopA) return; // B must come after A
    setLoopB(t);
  }, [practiceTime, loopA]);

  const clearLoop = useCallback(() => { setLoopA(null); setLoopB(null); }, []);

  const fmtTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = t - m * 60;
    return `${m}:${s.toFixed(1).padStart(4, '0')}`;
  };

  // Load a raw uploaded file as the VOCAL track (Quick Play — no extraction).
  const loadQuickFile = useCallback(async (file: File) => {
    stopAudioSource();
    pauseOffsetRef.current = 0;
    setPracticeTime(0);
    setPlaybackState('idle');
    vocalBufRef.current = null;
    try {
      const ctx = ensureAudioGraph();
      const ab = await file.arrayBuffer();
      const buf = await ctx.decodeAudioData(ab);
      vocalBufRef.current = buf;
      recomputeDuration();
      setPlaybackLabel(`Quick: ${file.name}`);
      setStatusMsg(`Loaded "${file.name}" as the vocal track (${buf.duration.toFixed(1)}s). Press Play.`);
    } catch (e) {
      setStatusMsg(`Could not decode audio: ${e instanceof Error ? e.message : e}`);
    }
  }, [ensureAudioGraph, stopAudioSource, recomputeDuration]);

  // Load the secondary MUSIC/instrumental track (optional third channel).
  const loadMusicFile = useCallback(async (file: File) => {
    stopAudioSource();
    pauseOffsetRef.current = 0;
    setPracticeTime(0);
    setPlaybackState('idle');
    musicBufRef.current = null;
    try {
      const ctx = ensureAudioGraph();
      const ab = await file.arrayBuffer();
      const buf = await ctx.decodeAudioData(ab);
      musicBufRef.current = buf;
      setMusicFileName(file.name);
      recomputeDuration();
      setStatusMsg(`Loaded "${file.name}" as the music track (${buf.duration.toFixed(1)}s). Press Play.`);
    } catch (e) {
      setStatusMsg(`Could not decode music track: ${e instanceof Error ? e.message : e}`);
    }
  }, [ensureAudioGraph, stopAudioSource, recomputeDuration]);

  // V3.6: load Track 2 (music/backing) from a LIBRARY item's audioUrl — the fix for the
  // "Track 2 only takes a dropped file, not a library item" gap (Jon 2026-06-27).
  const loadMusicFromUrl = useCallback(async (url: string, title: string) => {
    stopAudioSource();
    pauseOffsetRef.current = 0;
    setPracticeTime(0);
    setPlaybackState('idle');
    musicBufRef.current = null;
    try {
      const ctx = ensureAudioGraph();
      const ab = await (await fetch(url)).arrayBuffer();
      const buf = await ctx.decodeAudioData(ab);
      musicBufRef.current = buf;
      setMusicFileName(title);
      recomputeDuration();
      setStatusMsg(`Loaded "${title}" as Track 2 (${buf.duration.toFixed(1)}s). Press Play.`);
    } catch (e) {
      setStatusMsg(`Could not load Track 2 from library: ${e instanceof Error ? e.message : e}`);
    }
  }, [ensureAudioGraph, stopAudioSource, recomputeDuration]);

  // Clear the music track.
  const clearMusicFile = useCallback(() => {
    stopAudioSource();
    pauseOffsetRef.current = 0;
    setPracticeTime(0);
    setPlaybackState('idle');
    musicBufRef.current = null;
    setMusicFile(null);
    setMusicFileName('');
    recomputeDuration();
  }, [stopAudioSource, recomputeDuration]);

  // Load a template's audio URL (called from the template-selection useEffect).
  const loadTemplateAudio = useCallback(async (url: string, title: string) => {
    stopAudioSource();
    pauseOffsetRef.current = 0;
    setPracticeTime(0);
    setPlaybackState('idle');
    vocalBufRef.current = null;
    try {
      const ctx = ensureAudioGraph();
      const r = await fetch(url);
      const ab = await r.arrayBuffer();
      const buf = await ctx.decodeAudioData(ab);
      vocalBufRef.current = buf;
      recomputeDuration();
      setPlaybackLabel(`Template: ${title}`);
    } catch (e) {
      setStatusMsg(`Could not load template audio: ${e instanceof Error ? e.message : e}`);
    }
  }, [ensureAudioGraph, stopAudioSource, recomputeDuration]);

  // Mic monitor (right channel), with separate profile-gain and user-gain nodes.
  // Also starts/stops the pitch-detection stream so Jon sees live "You: D4 +12¢".
  // V3: split into stop/start so (a) profile changes can restart the stream with
  // new getUserMedia constraints and (b) pagehide can release the mic — a held
  // mic stream keeps Android Bluetooth stuck in SCO call-mode and hijacks the
  // phone's audio routing until restart.
  const stopMicMonitor = useCallback(() => {
    if (micSourceNodeRef.current) { try { micSourceNodeRef.current.disconnect(); } catch {} micSourceNodeRef.current = null; }
    if (micProfileGainNodeRef.current) { try { micProfileGainNodeRef.current.disconnect(); } catch {} micProfileGainNodeRef.current = null; }
    if (micUserGainNodeRef.current) { try { micUserGainNodeRef.current.disconnect(); } catch {} micUserGainNodeRef.current = null; }
    if (micAnalyserRef.current) { try { micAnalyserRef.current.disconnect(); } catch {} micAnalyserRef.current = null; }
    if (micPitchAnalyserRef.current) { try { micPitchAnalyserRef.current.disconnect(); } catch {} micPitchAnalyserRef.current = null; }
    if (micPanNodeRef.current) { try { micPanNodeRef.current.disconnect(); } catch {} micPanNodeRef.current = null; }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    stopPitchDetect();
    trackMicMidiRef.current = null; setTrackMicMidi(null);
    micSmoothRef.current = 0;
    setMicEnabled(false);
  }, [stopPitchDetect]);

  const startMicMonitor = useCallback(async () => {
    try {
      // V3: phone profile turns the OS gain pipeline ON — Android mics are
      // near-silent without autoGainControl. Desktop profiles keep raw input.
      const agc = MIC_PROFILES[micProfileRef.current].agc;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // V3.2: Headphones → AEC off (zero-latency dichotic monitoring).
          // Speakers → AEC on so the reference bleed can't fake a perfect match.
          echoCancellation: outputModeRef.current === 'speakers',
          noiseSuppression: agc,
          autoGainControl: agc,
        },
      });
      micStreamRef.current = stream;
      const ctx = ensureAudioGraph();
      if (ctx.state === 'suspended') await ctx.resume();
      const src = ctx.createMediaStreamSource(stream);
      const profileGain = ctx.createGain();
      profileGain.gain.value = MIC_PROFILES[micProfileRef.current].gain;
      const userGain = ctx.createGain();
      userGain.gain.value = micVolRef.current / 100;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const pan = ctx.createStereoPanner();
      pan.pan.value = micPanRef.current; // V3: user-adjustable balance (default hard-right)
      src.connect(profileGain).connect(userGain).connect(analyser).connect(pan).connect(limiterRef.current!);
      // V3.2: 2048-fft leaf tap off the RAW mic source for live voice-pitch
      // detection — same stream Jon hears (so it's proven live), independent of
      // the user volume slider, and not subject to the second-getUserMedia flakiness.
      const micPitch = ctx.createAnalyser();
      micPitch.fftSize = 2048;
      src.connect(micPitch);
      micPitchAnalyserRef.current = micPitch;
      micSourceNodeRef.current = src;
      micProfileGainNodeRef.current = profileGain;
      micUserGainNodeRef.current = userGain;
      micAnalyserRef.current = analyser;
      micPanNodeRef.current = pan;
      setMicEnabled(true);
      // V3.2: live voice + reference pitch are read by the trackPitch RAF loop
      // (below), off the monitoring stream — no separate pitch-detect stream.
    } catch (e) {
      setStatusMsg(`Mic access failed: ${e instanceof Error ? e.message : e}`);
    }
  }, [ensureAudioGraph, startPitchDetect]);

  const toggleMicMonitor = useCallback(async () => {
    if (micEnabled) stopMicMonitor();
    else await startMicMonitor();
  }, [micEnabled, stopMicMonitor, startMicMonitor]);

  const micEnabledRef = useRef(false);
  useEffect(() => { micEnabledRef.current = micEnabled; }, [micEnabled]);

  // V3: default to the phone profile on mobile devices (Android mics need AGC).
  useEffect(() => {
    if (IS_MOBILE) setMicProfile('phone');
  }, []);

  // Update mic profile gain live + RESTART the stream when constraints change
  // (AGC on/off requires a fresh getUserMedia — gain alone can update in place).
  const prevProfileRef = useRef<MicProfile | null>(null);
  useEffect(() => {
    const prev = prevProfileRef.current;
    prevProfileRef.current = micProfile;
    if (micProfileGainNodeRef.current) {
      micProfileGainNodeRef.current.gain.value = MIC_PROFILES[micProfile].gain;
    }
    if (prev && prev !== micProfile && micEnabledRef.current
        && MIC_PROFILES[prev].agc !== MIC_PROFILES[micProfile].agc) {
      stopMicMonitor();
      // micProfileRef is synced by its own effect; defer restart a tick so the
      // new constraints are read.
      setTimeout(() => { startMicMonitor(); }, 50);
    }
  }, [micProfile, stopMicMonitor, startMicMonitor]);

  // V3.2: restart the mic when Headphones/Speakers changes (echoCancellation is
  // fixed at getUserMedia time, so the new constraint needs a fresh stream).
  const prevOutputRef = useRef(outputMode);
  useEffect(() => {
    const prev = prevOutputRef.current;
    prevOutputRef.current = outputMode;
    if (prev !== outputMode && micEnabledRef.current) {
      stopMicMonitor();
      setTimeout(() => { startMicMonitor(); }, 60);
    }
  }, [outputMode, stopMicMonitor, startMicMonitor]);

  // V3: release the mic when the page is hidden/left. A held mic stream keeps
  // Android Bluetooth in SCO call-mode and breaks ALL phone audio until reboot.
  useEffect(() => {
    let micWasOn = false;
    const release = () => { if (micEnabledRef.current) { micWasOn = true; stopMicMonitor(); } };
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        release();
      } else {
        // V3.7: back on the page — un-stall. Phone Chrome suspends the
        // AudioContext (clock + buffer playback freeze) and we released the mic;
        // resume the context so playback/clock continue, and re-arm the mic.
        const ctx = audioCtxRef.current;
        if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
        if (micWasOn) { micWasOn = false; setTimeout(() => { startMicMonitor(); }, 80); }
      }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', release);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', release);
    };
  }, [stopMicMonitor, startMicMonitor]);

  // Decode template audio when the current template changes. Split out from the
  // template-metadata effect so loadTemplateAudio is defined by this point.
  useEffect(() => {
    if (!currentTemplate?.audioUrl) return;
    loadTemplateAudio(currentTemplate.audioUrl, currentTemplate.title);
    setSourcesOpen(false);  // close the Sources drawer after a pick…
    setScoreFocus(true);    // …and default into score-focused layout (Codex #1/#3)
    // load wires audio + SCORE together: show the engraved staff if this part has
    // one (Lida Rose Lead/Baritone), else fall back to the printed PDF pages.
    setScoreView(getLidaRoseScorePart(parseMmTitle(currentTemplate.title)) ? 'engraved' : 'pages');
  }, [currentTemplate, loadTemplateAudio]);

  // Update vocal track volume live (without restarting playback).
  const handleVocalVolChange = useCallback((pct: number) => {
    const clamped = Math.max(0, Math.min(VOL_MAX, pct));
    setVocalVol(clamped);
    if (vocalGainNodeRef.current) {
      vocalGainNodeRef.current.gain.value = clamped / 100;
    }
  }, []);

  // Update music track volume live.
  const handleMusicVolChange = useCallback((pct: number) => {
    const clamped = Math.max(0, Math.min(VOL_MAX, pct));
    setMusicVol(clamped);
    if (musicGainNodeRef.current) {
      musicGainNodeRef.current.gain.value = clamped / 100;
    }
  }, []);

  // Update mic user volume live.
  const handleMicVolChange = useCallback((pct: number) => {
    const clamped = Math.max(0, Math.min(VOL_MAX, pct));
    setMicVol(clamped);
    if (micUserGainNodeRef.current) {
      micUserGainNodeRef.current.gain.value = clamped / 100;
    }
  }, []);

  // V3: live balance updates per stream (no playback restart).
  const handleVocalPanChange = useCallback((v: number) => {
    const clamped = Math.max(-1, Math.min(1, v));
    setVocalPan(clamped);
    if (vocalPanNodeRef.current) vocalPanNodeRef.current.pan.value = clamped;
  }, []);
  const handleMusicPanChange = useCallback((v: number) => {
    const clamped = Math.max(-1, Math.min(1, v));
    setMusicPan(clamped);
    if (musicPanNodeRef.current) musicPanNodeRef.current.pan.value = clamped;
  }, []);
  const handleMicPanChange = useCallback((v: number) => {
    const clamped = Math.max(-1, Math.min(1, v));
    setMicPan(clamped);
    if (micPanNodeRef.current) micPanNodeRef.current.pan.value = clamped;
  }, []);

  // V3: level-meter loop — reads each post-gain analyser at display rate and
  // writes meter widths straight to the DOM (zero React re-renders).
  useEffect(() => {
    const monitoring = playbackState === 'playing' || micEnabled;
    if (!monitoring) {
      if (meterRafRef.current) { cancelAnimationFrame(meterRafRef.current); meterRafRef.current = null; }
      for (const el of [vocalMeterElRef.current, musicMeterElRef.current, micMeterElRef.current]) {
        if (el) { el.style.width = '0%'; }
      }
      return;
    }
    const buf = new Uint8Array(128);
    const readLevel = (an: AnalyserNode | null): number => {
      if (!an) return 0;
      an.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const c = (buf[i] - 128) / 128;
        sum += c * c;
      }
      return Math.sqrt(sum / buf.length); // RMS 0..~1
    };
    const paint = (el: HTMLDivElement | null, rms: number) => {
      if (!el) return;
      // Map RMS to a perceptual-ish bar: 0 → 0%, ~0.5+ → 100%.
      const pct = Math.min(100, Math.round(rms * 200));
      el.style.width = `${pct}%`;
      el.style.background = pct > 92 ? '#ef4444' : pct > 70 ? '#f59e0b' : '#22c55e';
    };
    const loop = () => {
      paint(vocalMeterElRef.current, readLevel(vocalAnalyserRef.current));
      paint(musicMeterElRef.current, readLevel(musicAnalyserRef.current));
      paint(micMeterElRef.current, readLevel(micAnalyserRef.current));
      meterRafRef.current = requestAnimationFrame(loop);
    };
    meterRafRef.current = requestAnimationFrame(loop);
    return () => {
      if (meterRafRef.current) { cancelAnimationFrame(meterRafRef.current); meterRafRef.current = null; }
    };
  }, [playbackState, micEnabled]);

  // Cleanup on unmount
  useEffect(() => () => {
    stopAudioSource();
    if (micStreamRef.current) micStreamRef.current.getTracks().forEach(t => t.stop());
    if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch {} }
  }, [stopAudioSource]);

  // ───────────────────────────────────────────────────────────────────────
  // Editor: click-to-delete a note
  // ───────────────────────────────────────────────────────────────────────
  const deleteNote = useCallback((idx: number) => {
    setExtractedNotes(prev => prev.filter((_, i) => i !== idx));
  }, []);

  // RECONCILED score-target lane: engraving truth RE-TIMED to the recording (v3 sync)
  // with audio-missed notes recovered + extraction noise dropped. Falls back to the
  // stale omrTargets span-scaled times only when no reconciled file exists.
  const [reconciled, setReconciled] = useState<PracticeNote[] | null>(null);
  const [scoreHealth, setScoreHealth] = useState<ScoreHealthPayload | null>(null);
  const [scorePartHealth, setScorePartHealth] = useState<SourcePartHealthPayload | null>(null);
  const [phraseManifest, setPhraseManifest] = useState<PhraseManifestPayload | null>(null);
  const [leadNoteMap, setLeadNoteMap] = useState<LeadNoteMapPayload | null>(null);
  useEffect(() => {
    if (activeLidaRoseScorePart) {
      fetch(activeLidaRoseScorePart.reconciledUrl, { cache: 'no-store' })
        .then((r) => r.json()).then((j) => setReconciled(j.notes || null)).catch(() => setReconciled(null));
    } else setReconciled(null);
  }, [activeLidaRoseScorePart]);
  useEffect(() => {
    let cancelled = false;
    if (!activeLidaRoseScorePart) {
      setScoreHealth(null);
      return () => { cancelled = true; };
    }
    fetch(activeLidaRoseScorePart.healthUrl, { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((j) => { if (!cancelled) setScoreHealth(j || null); })
      .catch(() => { if (!cancelled) setScoreHealth(null); });
    return () => { cancelled = true; };
  }, [activeLidaRoseScorePart]);
  useEffect(() => {
    let cancelled = false;
    if (!lidaRoseScorePart) {
      setPhraseManifest(null);
      setLeadNoteMap(null);
    }
    Promise.all([
      fetch('/musicxml/lida-rose-score-health.json', { cache: 'no-store' }).then((r) => r.ok ? r.json() : null).catch(() => null),
      lidaRoseScorePart
        ? fetch(lidaRoseScorePart.phrasesUrl, { cache: 'no-store' }).then((r) => r.ok ? r.json() : null).catch(() => null)
        : Promise.resolve(null),
      lidaRoseScorePart
        ? fetch(lidaRoseScorePart.noteMapUrl, { cache: 'no-store' }).then((r) => r.ok ? r.json() : null).catch(() => null)
        : Promise.resolve(null),
    ]).then(([parts, phrases, noteMap]) => {
      if (cancelled) return;
      setScorePartHealth(parts);
      setPhraseManifest(phrases);
      setLeadNoteMap(noteMap);
    });
    return () => { cancelled = true; };
  }, [lidaRoseScorePart]);
  // OMR score-target lane: the REAL notated notes of the loaded part, off the sheet.
  const omrTarget = useMemo(() => {
    if (!currentMm) return null;
    if (reconciled && reconciled.length) return { part: currentMm.part, noteCount: reconciled.length, notes: reconciled, reconciled: true };
    return getOmrTarget(currentMm.song, currentMm.part);
  }, [currentMm, reconciled]);
  const omrSpan = useMemo(
    () => (omrTarget ? omrTarget.notes.reduce((mx, n) => Math.max(mx, n.startTimeSeconds + n.durationSeconds), 0) : 0),
    [omrTarget],
  );
  const practicePhrases = useMemo<PracticePhrase[]>(() => {
    if (!omrTarget?.notes.length) return [];
    const notes = [...omrTarget.notes]
      .filter((n): n is PracticeNote =>
        Number.isFinite(n.pitchMidi)
        && Number.isFinite(n.startTimeSeconds)
        && Number.isFinite(n.durationSeconds)
      )
      .sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
    if (phraseManifest?.phrases.length) {
      const fromManifest: PracticePhrase[] = [];
      for (const phrase of phraseManifest.phrases) {
        const first = notes[phrase.noteStart - 1];
        const last = notes[phrase.noteEnd - 1];
        if (!first || !last) continue;
        fromManifest.push({
          id: phrase.id,
          label: phrase.label,
          shortLabel: phrase.shortLabel,
          start: Math.max(0, first.startTimeSeconds - 0.12),
          end: last.startTimeSeconds + last.durationSeconds + 0.18,
          noteCount: phrase.noteEnd - phrase.noteStart + 1,
          page: phrase.page,
          noteStart: phrase.noteStart,
          noteEnd: phrase.noteEnd,
        });
      }
      return fromManifest;
    }
    const phrases: PracticePhrase[] = [];
    let startIdx = 0;
    const pushPhrase = (endIdx: number) => {
      if (endIdx < startIdx) return;
      const first = notes[startIdx];
      const last = notes[endIdx];
      if (!first || !last) return;
      const start = Math.max(0, first.startTimeSeconds - 0.12);
      const end = last.startTimeSeconds + last.durationSeconds + 0.18;
      phrases.push({
        id: `p${phrases.length + 1}`,
        label: `P${phrases.length + 1}`,
        start,
        end,
        noteCount: endIdx - startIdx + 1,
      });
    };
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      const next = notes[i + 1];
      const gap = next ? next.startTimeSeconds - (note.startTimeSeconds + note.durationSeconds) : 0;
      const longHold = note.durationSeconds >= 1.3;
      const phraseTooLong = i - startIdx >= 11;
      const hasRest = gap >= 0.7;
      if (i === notes.length - 1 || longHold || phraseTooLong || hasRest) {
        pushPhrase(i);
        startIdx = i + 1;
      }
    }
    return phrases.filter((p) => p.noteCount >= 2 || p.end - p.start >= 1.2);
  }, [omrTarget, phraseManifest]);
  const activePhrase = useMemo(() => {
    const active = practicePhrases.find((p) => practiceTime >= p.start && practiceTime <= p.end);
    return active ?? null;
  }, [practicePhrases, practiceTime]);
  const activePhraseId = activePhrase?.id ?? null;
  // V3.6: size the tracker to the AUDIO length (durationSec) too — else when the recording is
  // longer than the notes (studio full-song vs partial score), the playhead runs off the right
  // edge and scroll freezes partway. (Jon 2026-06-27)
  const editorWidth = useMemo(() => Math.max(800, Math.max(extractedDuration, omrSpan, durationSec) * zoom), [extractedDuration, omrSpan, durationSec, zoom]);
  // V3.6: default the Sheet-Music viewer to the selected song's pages (Jon 2026-06-27).
  const selectedSongPage = useMemo(() => {
    const t = currentTemplate?.title; if (!t) return null;
    const song = (parseMmTitle(t)?.song || t).toLowerCase();
    const MAP: Record<string, number> = { 'lida rose': 196, 'sincere': 89, 'goodnight ladies': 100, "it's you": 165 };
    for (const [k, p] of Object.entries(MAP)) if (song.includes(k)) return p;
    return null;
  }, [currentTemplate]);
  const editorRowHeight = 6; // px per semitone
  const editorHeight = (PITCH_MAX - PITCH_MIN + 1) * editorRowHeight;

  // Find the extracted note that contains the current playhead time.
  // Null for Quick Play (no extracted notes) or between notes.
  const currentTargetNote = useMemo(() => {
    if (extractedNotes.length === 0) return null;
    const t = practiceTime;
    return extractedNotes.find(
      n => n.startTimeSeconds <= t && t < n.startTimeSeconds + n.durationSeconds,
    ) ?? null;
  }, [extractedNotes, practiceTime]);
  const currentScoreTargetNote = useMemo<PracticeNote | null>(() => {
    if (!omrTarget?.notes.length) return null;
    const t = practiceTime;
    return omrTarget.notes.find(
      n => n.startTimeSeconds <= t && t < n.startTimeSeconds + n.durationSeconds,
    ) ?? null;
  }, [omrTarget, practiceTime]);
  const practiceTargetNote = currentScoreTargetNote ?? currentTargetNote;

  // ─── V3.2: live pitch tracking loop — reference (playback) + voice (mic) ──
  // Reads both 2048-fft analysers each frame, runs pitchy, noise-gates +
  // EMA-smooths + octave-snaps, and writes fractional MIDI to refs (for the
  // lock tick) and throttled state (for the render).
  useEffect(() => {
    const active = playbackState === 'playing' || micEnabled;
    if (!active) {
      refMidiRef.current = null; setRefMidi(null);
      trackMicMidiRef.current = null; setTrackMicMidi(null);
      refSmoothRef.current = 0; micSmoothRef.current = 0;
      refLastMsRef.current = 0; micLastMsRef.current = 0;
      micTrailRef.current = [];
      return;
    }
    const SIZE = 2048;
    if (!refDetectorRef.current) refDetectorRef.current = PitchDetector.forFloat32Array(SIZE);
    if (!micDetectorRef.current) micDetectorRef.current = PitchDetector.forFloat32Array(SIZE);
    if (!refBufRef.current) refBufRef.current = new Float32Array(SIZE);
    if (!micBufRef.current) micBufRef.current = new Float32Array(SIZE);

    const detectOne = (
      analyser: AnalyserNode | null,
      detector: PitchDetector<Float32Array<ArrayBuffer>>,
      buf: Float32Array<ArrayBuffer>,
      smoothRef: { current: number },
      lastMsRef: { current: number },
      nowMs: number,
    ): number | null => {
      if (!analyser) return null;
      analyser.getFloatTimeDomainData(buf);
      let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
      const db = 20 * Math.log10(Math.sqrt(s / buf.length) + 1e-10);
      if (db >= -55) {                                          // above noise floor
        const sr = audioCtxRef.current ? audioCtxRef.current.sampleRate : 48000;
        const [hz, clarity] = detector.findPitch(buf, sr);
        if (clarity >= 0.8 && hz >= 70 && hz <= 1100) {         // confident vocal pitch
          const midi = 69 + 12 * Math.log2(hz / 440);
          const prev = smoothRef.current;
          // EMA smooth, but SNAP on an octave-ish jump (don't lerp across a leap)
          smoothRef.current = (prev && Math.abs(midi - prev) <= 7) ? 0.5 * midi + 0.5 * prev : midi;
          lastMsRef.current = nowMs;
          return smoothRef.current;
        }
      }
      // V3.3: dropout (silence or low clarity) — HOLD the last good value for up
      // to 150ms instead of snapping to null. THIS is what kills the jumpiness.
      if (lastMsRef.current && (nowMs - lastMsRef.current) < 150 && smoothRef.current) {
        return smoothRef.current;
      }
      smoothRef.current = 0;
      return null;
    };

    let raf = 0; let frame = 0;
    const loop = () => {
      const nowMs = performance.now();
      const r = detectOne(refPitchAnalyserRef.current, refDetectorRef.current!, refBufRef.current!, refSmoothRef, refLastMsRef, nowMs);
      const m = detectOne(micPitchAnalyserRef.current, micDetectorRef.current!, micBufRef.current!, micSmoothRef, micLastMsRef, nowMs);
      refMidiRef.current = r;
      trackMicMidiRef.current = m;
      // V3.3: accumulate the voice trail (glowing tail, ~1.2s) for the render.
      const trail = micTrailRef.current;
      if (m != null) trail.push({ t: nowMs, midi: m, on: r != null && Math.abs(m - r) <= 0.7 });
      while (trail.length && nowMs - trail[0].t > 1200) trail.shift();
      if (frame++ % 3 === 0) { setRefMidi(r); setTrackMicMidi(m); } // ~20fps state
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playbackState, micEnabled]);

  // Live VOICE pitch as a MIDI number — drives the piano-roll marker + slider.
  // V3.2: sourced from the monitoring-stream detector (trackMicMidi), not the
  // old second-stream usePitchDetection, so it works wherever Jon hears himself.
  const liveMidi = trackMicMidi;

  // Keep a ref to the current target so the lock-tick loop reads the latest
  // value without re-subscribing on every target change.
  useEffect(() => { currentTargetRef.current = practiceTargetNote; }, [practiceTargetNote]);

  // ── Pitchforks v1 mic lock loop (THE canonical feedback meter) ──
  // Runs only while playing AND a target note exists. Resets matchStart on
  // note boundary; uses confident-wrong hard-reset + silence-preserves-lock
  // flicker fix from src/components/PitchDefender/Pitchforks.tsx:418-493.
  // Pitchforks v1 lock tick — works in TWO modes:
  // A) With target (extracted notes + playhead): standard lock-to-target,
  //    resets on target boundary, confident-wrong hard-reset, silence preserves.
  // B) Without target (Quick Play, no extraction): shows pitch stability —
  //    bar fills while ANY confident pitch is sustained, hard-resets on silence.
  //    Gives visual "mic is working" feedback even without extraction.
  useEffect(() => {
    if (playbackState !== 'playing') {
      matchStartRef.current = 0;
      setMatchProgress(0);
      return;
    }
    let raf = 0;
    let lastTargetKey = '';
    const HOLD_MS = 300;
    const TOLERANCE_CENTS = 70;

    const tick = () => {
      // V3.2: target = the extracted note if one exists, ELSE the live reference
      // pitch detected from the playing audio. So un-extracted tracks still get a
      // real, moving target to lock onto — your voice vs the actual recording.
      const tgtNote = currentTargetRef.current;
      const targetMidi = tgtNote ? tgtNote.pitchMidi : refMidiRef.current;
      const micMidi = trackMicMidiRef.current;
      const key = tgtNote ? `n${tgtNote.startTimeSeconds}` : 'ref';
      if (key !== lastTargetKey) {
        // Reset on a new EXTRACTED note boundary only (not on every ref wiggle).
        if (tgtNote) { matchStartRef.current = 0; setMatchProgress(0); }
        lastTargetKey = key;
      }
      if (targetMidi != null && micMidi != null) {
        const rawCents = (micMidi - targetMidi) * 100;
        const folded = ((rawCents + 600) % 1200 + 1200) % 1200 - 600;
        if (Math.abs(folded) <= TOLERANCE_CENTS) {
          if (matchStartRef.current === 0) matchStartRef.current = performance.now();
          const held = performance.now() - matchStartRef.current;
          setMatchProgress(Math.min(1, held / HOLD_MS));
        } else if (matchStartRef.current > 0) {
          matchStartRef.current = 0;
          setMatchProgress(0);
        }
      }
      // both-null (silence on either side) → preserve current lock
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playbackState]);

  useEffect(() => {
    if (playbackState !== 'playing') return;
    let raf = 0;
    const SAMPLE_MS = 140;
    const COACH_TOLERANCE_CENTS = 60;
    const tick = () => {
      const now = performance.now();
      if (now - lastCoachSampleMsRef.current >= SAMPLE_MS) {
        lastCoachSampleMsRef.current = now;
        const target = currentTargetRef.current;
        const micMidi = trackMicMidiRef.current;
        if (target && micMidi != null) {
          const cents = foldedPitchCents(micMidi, target.pitchMidi);
          const prev = coachStatsRef.current;
          const next: CoachStats = {
            samples: prev.samples + 1,
            onPitch: prev.onPitch + (Math.abs(cents) <= COACH_TOLERANCE_CENTS ? 1 : 0),
            sharp: prev.sharp + (cents > COACH_TOLERANCE_CENTS ? 1 : 0),
            flat: prev.flat + (cents < -COACH_TOLERANCE_CENTS ? 1 : 0),
            sumAbsCents: prev.sumAbsCents + Math.abs(cents),
            sumSignedCents: prev.sumSignedCents + cents,
            lastCents: cents,
          };
          coachStatsRef.current = next;
          setCoachStats(next);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playbackState]);

  // ── Auto-scroll the piano-roll so the playhead stays visible ──
  useEffect(() => {
    if (playbackState !== 'playing') return;
    const el = editorScrollRef.current;
    if (!el) return;
    const playheadX = practiceTime * zoom;
    const target = Math.max(0, playheadX - el.clientWidth / 3);
    el.scrollLeft = target;
  }, [practiceTime, zoom, playbackState]);

  const scoreHealthOk = !!scoreHealth?.checks.length && scoreHealth.checks.every((c) => c.status === 'pass');
  const scoreHealthFailCount = scoreHealth?.checks.filter((c) => c.status === 'fail').length ?? 0;
  const scorePartHealthOk = !!scorePartHealth?.checks.length && scorePartHealth.checks.every((c) => c.status === 'pass');
  const scorePartCount = scorePartHealth?.parts.length ?? 0;
  const coachAccuracyPct = coachStats.samples ? Math.round((coachStats.onPitch / coachStats.samples) * 100) : null;
  const coachAvgCents = coachStats.samples ? coachStats.sumSignedCents / coachStats.samples : null;
  const coachAbsCents = coachStats.samples ? coachStats.sumAbsCents / coachStats.samples : null;
  const coachBias = coachAvgCents == null
    ? 'silent'
    : Math.abs(coachAvgCents) <= 8 ? 'centered' : coachAvgCents > 0 ? 'sharp' : 'flat';
  const captureEngravingReport = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const active = (window as any).__VT3_SCORE_ACTIVE__ ?? null;
    const oneBasedIndex = Number.isFinite(active?.index) ? Number(active.index) + 1 : null;
    const noteMeta = oneBasedIndex != null
      ? leadNoteMap?.notes.find((n) => n.index === oneBasedIndex) ?? null
      : null;
    const sourcePhrase = oneBasedIndex != null
      ? practicePhrases.find((p) =>
        p.noteStart != null
        && p.noteEnd != null
        && oneBasedIndex >= p.noteStart
        && oneBasedIndex <= p.noteEnd
      ) ?? null
      : null;
    const reportPhrase = activePhrase ?? sourcePhrase;
    const page = noteMeta?.page ?? reportPhrase?.page ?? null;
    const scorePanel = document.querySelector('[data-vt3-score-panel="engraving"]');
    const svg = scorePanel?.querySelector('svg');
    const rawSvg = svg ? new XMLSerializer().serializeToString(svg) : null;
    const maxSvgChars = 180000;
    const report: EngravingReport = {
      id: `engraving-${Date.now()}`,
      createdAt: new Date().toISOString(),
      title: currentTemplateRef.current?.title || activeLidaRoseScorePart?.label || 'Lida Rose',
      timeSeconds: practiceTimeRef.current,
      noteIndex: oneBasedIndex,
      measure: noteMeta?.measure ?? null,
      page,
      pitch: noteMeta?.pitch ?? null,
      phraseId: reportPhrase?.id ?? noteMeta?.phraseId ?? null,
      phrase: reportPhrase?.label ?? noteMeta?.phraseLabel ?? null,
      scoreVersion: scoreHealth?.scoreVersion ?? null,
      sourcePageImage: page ? `/score/page-${page}.jpg` : null,
      activeScore: active,
      svgSnapshot: rawSvg ? rawSvg.slice(0, maxSvgChars) : null,
      svgTruncated: !!rawSvg && rawSvg.length > maxSvgChars,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    };
    setEngravingReports((prev) => {
      const next = [report, ...prev].slice(0, 12);
      try { localStorage.setItem(ENGRAVING_REPORTS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
    try {
      await navigator.clipboard?.writeText(JSON.stringify(report, null, 2));
      setReportStatus('report copied');
    } catch {
      setReportStatus('report saved');
    }
    window.setTimeout(() => setReportStatus(null), 3500);
  }, [activePhrase, activeLidaRoseScorePart?.label, leadNoteMap, practicePhrases, scoreHealth?.scoreVersion]);

  // ───────────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────────
  return (
    <div className="relative isolate min-h-screen bg-[#08080f] text-gray-100 p-4 sm:p-6">
      {/* Full-viewport dark backdrop — kills the white strip above the global-nav offset (V3.4 QA).
          Root is `relative isolate` so this -z-10 layer stays scoped to this stacking context. */}
      <div aria-hidden className="fixed inset-0 -z-10 bg-[#08080f] pointer-events-none" />
      <div className={`max-w-6xl mx-auto flex flex-col gap-3 ${scoreFocus ? 'vt3-focus' : ''} ${sourcesOpen ? 'vt3-sources' : ''}`}>
        {(scoreFocus || sourcesOpen) && (
          <style>{`.vt3-focus > :not(.vt3-keep){display:none!important} .vt3-sources > :not(.vt3-src-keep){display:none!important}`}</style>
        )}
        {scoreFocus && !sourcesOpen && !mixerOpen && (
          <button onClick={() => setScoreFocus(false)} aria-label="Exit Focus"
            className="vt3-keep fixed top-2 left-2 z-[10000] px-3 py-1.5 rounded-full bg-neutral-900/90 backdrop-blur border border-amber-500/50 text-amber-200 text-xs font-semibold shadow-lg">
            ✕ Exit Focus
          </button>
        )}
        {sourcesOpen && (
          <div className="vt3-src-keep flex items-center justify-between sticky top-0 z-[20] bg-[#08080f]/95 backdrop-blur py-1">
            <h2 className="text-lg font-bold text-amber-300">📂 Sources</h2>
            <button onClick={() => setSourcesOpen(false)} aria-label="Close Sources"
              className="px-3 py-1.5 rounded-full bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-gray-200 text-xs font-semibold">
              ✕ Done
            </button>
          </div>
        )}
        <header className="order-1 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-amber-300">Vocal Trainer III</h1>
            {/* Cockpit state — compact, no paragraph instructions (Codex cleanup #2) */}
            <p className="text-sm mt-1 flex flex-wrap items-center gap-1.5">
              {playbackLabel ? (
                <>
                  <span className="text-amber-200 font-semibold">{playbackLabel}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-900/50 text-emerald-300 border border-emerald-700/50">Audio loaded</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-900/40 text-purple-200 border border-purple-700/50">Tempo {tempoPct}%</span>
                </>
              ) : (
                <span className="text-gray-500">Pick a part to start — tap the 🔆 orb for controls.</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a href="/pitch-defender/baritone-ball" className="px-2 py-1 rounded-full text-xs font-bold border border-amber-500/50 bg-amber-600/20 text-amber-200 hover:bg-amber-600/40" title="Follow-the-bouncing-ball baritone practice">🎈 Ball</a>
            <button onClick={() => setHelpOpen((v) => !v)} aria-label="Help"
              className={`px-2 py-1 rounded-full text-xs font-bold border ${helpOpen ? 'bg-cyan-700 border-cyan-400 text-white' : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'}`}
              title="How to practice (7-step guide)">? Help</button>
            <a href="/pitch-defender" className="text-sm text-amber-400 hover:text-amber-300">← Back</a>
          </div>
        </header>

        {/* ─── How to use (step-by-step for practice sessions) ─────────── */}
        <details className={`order-7 bg-gray-900/60 border border-cyan-500/30 rounded-lg p-3 open:pb-4 ${helpOpen ? '' : 'hidden'}`} open={helpOpen}>
          <summary className="text-lg font-semibold text-cyan-300 cursor-pointer select-none">
            🎵 How to practice your part <span className="text-sm font-normal text-gray-400">— tap for the 7-step guide · WIRED headphones required</span>
          </summary>
          <ol className="mt-3 space-y-2 text-sm text-gray-300 list-decimal list-inside">
            <li>
              <span className="font-semibold text-gray-100">Put on WIRED headphones.</span> This whole trainer is built for two ears doing different jobs — it does not work on speakers. <span className="text-amber-300">Avoid Bluetooth</span>: it delays your own voice by a noticeable beat AND on phones it can hijack the phone&rsquo;s audio into call-mode. Plug in.
            </li>
            <li>
              <span className="font-semibold text-gray-100">Load your song.</span> Drag your practice track (like a Music Man plunk track .m4a) into the upload box below — or pick one already saved in the Library at the top.
            </li>
            <li>
              <span className="font-semibold text-gray-100">Click &ldquo;Start mic monitor.&rdquo;</span> Allow the microphone when the browser asks. Now sing — you should hear your own voice in your RIGHT ear instantly. If it feels delayed, refresh the page and start the mic before playing the track. On a phone, the <span className="text-cyan-300">Phone mic (auto-boost)</span> profile is selected automatically — if your voice is still soft, push the Mic volume slider up and watch its meter.
            </li>
            <li>
              <span className="font-semibold text-gray-100">Press Play.</span> The track plays mostly in your LEFT ear, your live voice stays in your RIGHT ear. The moving cursor follows the notes.
            </li>
            <li>
              <span className="font-semibold text-gray-100">Mix it your way.</span> Each channel has a <span className="text-amber-300">volume slider (0–400%)</span>, a <span className="text-cyan-300">balance slider (L ↔ R)</span>, and a <span className="text-green-400">green level meter</span> that dances when sound is flowing. Want to BLAST your own voice? Push Mic volume up and watch its meter respond. Want the track louder? Blast Vocals and pull Mic down. The meters are your proof — if a meter moves, that channel is live.
            </li>
            <li>
              <span className="font-semibold text-gray-100">Drill the hard spots.</span> Pause, drag the playhead back, repeat the phrase until it locks in. Small loops beat full run-throughs.
            </li>
            <li>
              <span className="font-semibold text-gray-100">Check yourself.</span> The piano roll shows the song&rsquo;s notes; the live dot shows the pitch you&rsquo;re singing. Dot on the note = you&rsquo;re on it.
            </li>
          </ol>
          <p className="mt-3 text-xs text-gray-500">
            Tip: if a slider seems to do nothing, look at its meter. Meter moving = audio flowing (your headphone/system volume may be the bottleneck). Meter flat = that channel has nothing loaded or the mic isn&rsquo;t on.
          </p>
        </details>

        <section className="vt3-keep order-2 space-y-2">
          {/* ─── Sheet Music (real score, follow along) ─────────────────── */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">Score view:</span>
            <div className="inline-flex rounded-md border border-gray-700 overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setScoreView('pages')}
                className={scoreView === 'pages' ? 'px-3 py-1 bg-amber-600 text-white' : 'px-3 py-1 bg-gray-800 text-gray-300 hover:bg-gray-700'}
              >
                📄 Pages
              </button>
              <button
                type="button"
                onClick={() => setScoreView('engraved')}
                className={scoreView === 'engraved' ? 'px-3 py-1 bg-cyan-600 text-white' : 'px-3 py-1 bg-gray-800 text-gray-300 hover:bg-gray-700'}
              >
                🎼 Engraved ✨
              </button>
            </div>
            {lidaRoseScorePart && (
              <div className="inline-flex rounded-md border border-gray-700 overflow-hidden text-xs" aria-label="Score timing">
                <button
                  type="button"
                  aria-pressed={scoreTimingMode === 'current'}
                  onClick={() => setScoreTimingMode('current')}
                  className={scoreTimingMode === 'current' ? 'px-3 py-1 bg-slate-600 text-white' : 'px-3 py-1 bg-gray-800 text-gray-300 hover:bg-gray-700'}
                  title="Use the current production timing map"
                >
                  Current
                </button>
                <button
                  type="button"
                  aria-pressed={scoreTimingMode === 'v2'}
                  onClick={() => setScoreTimingMode('v2')}
                  className={scoreTimingMode === 'v2' ? 'px-3 py-1 bg-emerald-600 text-white' : 'px-3 py-1 bg-gray-800 text-gray-300 hover:bg-gray-700'}
                  title="Use the shared conductor timing map"
                >
                  Conductor v2
                </button>
              </div>
            )}
            {scoreView === 'engraved' && (
              <span className="text-xs text-cyan-400/70">
                {activeLidaRoseScorePart ? `${activeLidaRoseScorePart.label} - ${activeLidaRoseScorePart.timingLabel}` : 'Lida Rose - select Lead or Baritone for engraving'}
              </span>
            )}
            {scoreHealth && (
              <div className="ml-auto flex flex-wrap items-center gap-1 text-[11px]">
                <span className={`px-2 py-0.5 rounded border ${scoreHealthOk ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' : 'border-rose-500/50 bg-rose-500/10 text-rose-300'}`}>
                  Score {scoreHealthOk ? 'PASS' : `${scoreHealthFailCount} fail`}
                </span>
                <span className="px-2 py-0.5 rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-200">key {scoreHealth.keyFifths}</span>
                <span className="px-2 py-0.5 rounded border border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200">{scoreHealth.noteCount} notes</span>
                <span className="px-2 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-200">{scoreHealth.wholeNotes.length} whole</span>
                {scorePartCount > 0 && (
                  <span className={`px-2 py-0.5 rounded border ${scorePartHealthOk ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-200' : 'border-rose-500/40 bg-rose-500/10 text-rose-200'}`}>
                    {scorePartCount} parts
                  </span>
                )}
                <button
                  type="button"
                  onClick={captureEngravingReport}
                  className="px-2 py-0.5 rounded border border-gray-700 bg-gray-800 text-gray-300 hover:border-amber-500/50 hover:text-amber-200"
                  title="Capture active note, measure, source page, and rendered SVG"
                >
                  Report engraving
                </button>
                {reportStatus && <span className="text-emerald-300">{reportStatus}</span>}
                {engravingReports.length > 0 && <span className="text-gray-500">{engravingReports.length} reports</span>}
              </div>
            )}
          </div>
          <div className="max-h-[46vh] min-h-[230px] overflow-auto rounded-lg" style={{ maskImage: 'linear-gradient(to bottom, transparent 0, #000 16px, #000 calc(100% - 24px), transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, #000 16px, #000 calc(100% - 24px), transparent 100%)' }}>
            {scoreView === 'pages' ? (
              <ScoreViewer jumpToPage={selectedSongPage} />
            ) : activeLidaRoseScorePart ? (
              <ScoreEngraving
                musicXMLUrl={activeLidaRoseScorePart.musicXMLUrl}
                syncUrl={activeLidaRoseScorePart.syncUrl}
                currentTime={practiceTime}
                title={activeLidaRoseScorePart.title}
                liveMidiRef={trackMicMidiRef}
                trailRef={micTrailRef}
              />
            ) : (
              <div className="rounded-lg border border-cyan-500/20 bg-[#0a0a14] p-6 text-sm text-gray-400">
                Pick a Lida Rose Lead or Baritone library item to load the engraved trainer score.
              </div>
            )}
          </div>
        </section>

        {/* ─── Library ───────────────────────────────────────────────── */}
        <details className={`vt3-src-keep order-5 bg-gray-900/60 border border-amber-500/20 rounded-lg p-3 ${sourcesOpen ? '' : 'hidden'}`} open={sourcesOpen}>
          <summary className="cursor-pointer select-none text-sm font-semibold text-amber-300 marker:text-amber-500">
            Library <span className="text-xs font-normal text-gray-500">— saved templates and extraction tools</span>
          </summary>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-amber-300">Library</h2>
            <button
              onClick={refreshLibrary}
              className="text-xs px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700"
              disabled={loadingLibrary}
            >
              {loadingLibrary ? 'Loading…' : 'Refresh'}
            </button>
          </div>
          {library.length === 0 && !loadingLibrary && (
            <p className="text-sm text-gray-500">No templates yet. Upload one below to get started.</p>
          )}
          {library.length > 0 && (
            <>
              {/* Toolbar: group-by dropdown + filter (V3.1) */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <label className="text-xs text-gray-400 flex items-center gap-1">
                  Group by
                  <select
                    value={groupBy}
                    onChange={(e) => setGroupBy(e.target.value as 'part' | 'song' | 'mode' | 'flat')}
                    className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100"
                  >
                    <option value="part">Voice part</option>
                    <option value="song">Song</option>
                    <option value="mode">Practice mode</option>
                    <option value="flat">Show all (flat)</option>
                  </select>
                </label>
                <input
                  type="text"
                  value={libFilter}
                  onChange={(e) => setLibFilter(e.target.value)}
                  placeholder="Search Library (song · part · role)…"
                  className="flex-1 min-w-[140px] bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100"
                />
                <span className="text-xs text-gray-500 whitespace-nowrap">{library.length} in library</span>
              </div>

              {/* filter chips (addendum #3) */}
              <div className="flex flex-wrap items-center gap-1 mb-2">
                {[
                  { k: 'favorites', label: '★ Favorites' },
                  { k: 'currentSong', label: 'Current song' },
                  { k: 'reference', label: 'Reference' },
                  { k: 'backing', label: 'Backing' },
                  { k: 'original', label: 'Original' },
                  { k: 'hasNotes', label: 'Has notes' },
                  { k: 'needs', label: 'Needs extraction' },
                ].map((c) => (
                  <button key={c.k} onClick={() => toggleChip(c.k)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${chips.has(c.k) ? 'bg-amber-600 border-amber-400 text-white' : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'}`}>{c.label}</button>
                ))}
                {chips.size > 0 && <button onClick={() => setChips(new Set())} className="px-2 py-0.5 rounded-full text-[10px] text-gray-400 hover:text-gray-200">clear</button>}
              </div>

              {/* pinned Favorites (addendum #1) — load directly, no scrolling */}
              {favoriteAssets.length > 0 && (
                <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-950/10 p-2">
                  <div className="text-xs font-bold text-amber-300 mb-1.5">★ Favorites</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {favoriteAssets.map((a) => (
                      <div key={a.id} className={`relative rounded-lg border flex items-center gap-2 px-2 py-1.5 ${selectedId === a.id ? 'border-amber-400 bg-amber-500/10' : 'border-gray-700/70 bg-gray-800/40 hover:border-gray-600'}`}>
                        <button onClick={() => toggleFavorite(a.id)} aria-label="Unfavorite" title="Unfavorite" className="text-amber-400 text-sm shrink-0">★</button>
                        <button onClick={() => setSelectedId(a.id)} className="flex-1 min-w-0 text-left">
                          <div className="text-sm font-medium text-gray-100 truncate">{a.displayTitle}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${ROLE_BADGE[a.role].cls}`}>{ROLE_BADGE[a.role].label}</span>
                            {a.hasNotes && <span className="text-[10px] text-emerald-400">{a.noteCount} notes</span>}
                          </div>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {libraryGroups.map((group) => {
                const missing = group.items.filter((i) => i.noteCount === 0 && i.audioUrl).length;
                const isOpen = !collapsed.has(group.key);
                return (
                  <details
                    key={group.key}
                    open={isOpen}
                    onToggle={(e) => {
                      const open = (e.currentTarget as HTMLDetailsElement).open;
                      setCollapsed((prev) => {
                        const n = new Set(prev);
                        if (open) n.delete(group.key); else n.add(group.key);
                        return n;
                      });
                    }}
                    className="mb-2 border border-gray-800 rounded-lg p-2"
                  >
                    <summary className="cursor-pointer select-none text-amber-300 font-semibold text-sm py-1 marker:text-amber-500">
                      {group.label}
                      {missing > 0 && <span className="ml-2 text-[10px] font-normal text-gray-500">{missing} un-extracted</span>}
                    </summary>
                    {missing > 0 && (
                      <button
                        onClick={() => extractAllMissing(group.items)}
                        disabled={extractingId !== null || extractAllRun}
                        className="mt-2 mb-1 text-[11px] px-2 py-1 bg-amber-700/70 hover:bg-amber-600 disabled:bg-gray-700 disabled:text-gray-500 rounded"
                      >
                        ⚡ Extract all {missing} vocal lines
                      </button>
                    )}
                    {(() => {
                      const { canonical, more } = dedupeItems(group.items);
                      const renderCard = (item: LibraryItem) => {
                        const mm = parseMmTitle(item.title);
                        const role = classifyRole(mm, item);
                        const primary = mm ? (groupBy === 'part' ? mm.song : mm.part) : item.title;
                        const busy = extractingId === item.id;
                        return (
                          <div
                            key={item.id}
                            className={`group relative rounded-lg border transition ${
                              selectedId === item.id
                                ? 'border-amber-400 bg-amber-500/10 ring-1 ring-amber-400/40'
                                : 'border-gray-700/70 bg-gray-800/40 hover:border-gray-600'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id); }}
                              aria-label={favorites.has(item.id) ? 'Unfavorite' : 'Favorite'}
                              title="Favorite"
                              className="absolute top-1 left-1 z-10 w-6 h-6 grid place-items-center text-sm leading-none"
                            >
                              <span className={favorites.has(item.id) ? 'text-amber-400' : 'text-gray-600 hover:text-amber-300'}>{favorites.has(item.id) ? '★' : '☆'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedId(item.id)}
                              aria-pressed={selectedId === item.id}
                              className="block w-full text-left pl-7 pr-14 pt-3 pb-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 hover:bg-white/[0.02]"
                            >
                              <div className="font-medium text-gray-100 truncate flex items-center gap-1.5">
                                <span className="truncate">{primary}</span>
                                <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold border ${ROLE_BADGE[role].cls}`}>{ROLE_BADGE[role].label}</span>
                              </div>
                              <div className="text-xs mt-1 flex items-center gap-2">
                                {item.noteCount > 0
                                  ? <span className="text-emerald-400">● {item.noteCount} notes</span>
                                  : <span className="text-gray-600">no melody yet</span>}
                                <span className="text-gray-600">{item.createdAt?.slice(0, 10) || ''}</span>
                              </div>
                            </button>
                            {selectedId === item.id && (
                              <span className="absolute top-2.5 right-2.5 text-[10px] font-semibold text-amber-300 pointer-events-none">✓ loaded</span>
                            )}
                            <div className="px-3 pb-3">
                              <button
                                type="button"
                                onClick={() => extractLibraryItem(item)}
                                disabled={extractingId !== null || extractAllRun || !item.audioUrl}
                                className="text-[10px] px-2 py-0.5 rounded border border-gray-700 text-gray-400 hover:text-amber-300 hover:border-amber-500/40 disabled:opacity-40 transition opacity-60 group-hover:opacity-100 outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
                              >
                                {busy
                                  ? (extractProgress ? `extracting… ${Math.round(extractProgress.pct * 100)}%` : 'extracting…')
                                  : item.noteCount === 0 ? '⚙ extract vocal line' : '⚙ re-extract'}
                              </button>
                            </div>
                          </div>
                        );
                      };
                      return (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-1">{canonical.map(renderCard)}</div>
                          {more.length > 0 && (
                            <details className="mt-2 border-t border-gray-800 pt-2">
                              <summary className="text-[11px] text-gray-500 cursor-pointer select-none marker:text-gray-600">▸ More versions ({more.length}) — duplicates / older extractions</summary>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-1 opacity-75">{more.map(renderCard)}</div>
                            </details>
                          )}
                        </>
                      );
                    })()}
                  </details>
                );
              })}
            </>
          )}
        </details>

        {/* ─── Upload + extraction ───────────────────────────────────── */}
        <details className={`vt3-src-keep order-6 bg-gray-900/60 border border-amber-500/20 rounded-lg p-3 ${sourcesOpen ? '' : 'hidden'}`} open={sourcesOpen}>
          <summary className="cursor-pointer select-none text-sm font-semibold text-amber-300 marker:text-amber-500">
            Add / Extract <span className="text-xs font-normal text-gray-500">— add stems or extract notes</span>
          </summary>
          <h2 className="text-lg font-semibold text-amber-300 mb-3">Add / Extract</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Vocals stem (primary) */}
            <div
              onDrop={onDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-gray-700 rounded-lg p-4 text-center hover:border-amber-500/40 transition"
            >
              <div className="text-[10px] uppercase tracking-wider text-amber-400 mb-1">Track 1 · Vocals (LEFT ear)</div>
              {uploadFile ? (
                <div>
                  <div className="text-amber-200 font-medium truncate">{uploadFile.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</div>
                </div>
              ) : (
                <div className="text-gray-500 text-sm">
                  Drag-drop the vocal stem<br/>
                  <span className="text-xs">(m4a, mp3, wav, ogg)</span>
                </div>
              )}
              <label className="mt-3 inline-block cursor-pointer text-xs font-medium px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white transition focus-within:ring-2 focus-within:ring-amber-400/60">
                {uploadFile ? 'Choose a different file' : 'Choose vocal file'}
                <input
                  type="file"
                  accept="audio/*,.m4a,.mp3,.wav,.ogg"
                  onChange={(e) => e.target.files?.[0] && handleFileChosen(e.target.files[0])}
                  className="sr-only"
                />
              </label>
              {/* V3.8: Track 1 picks from the SAME library as Track 2 — all tracks equal (Jon 2026-06-27) */}
              <div className="mt-2">
                <select
                  value=""
                  onChange={(e) => { const it = library.find((x) => x.id === e.target.value); if (it) { setUploadFile(null); setSelectedId(it.id); /* canonical load → wires audio + notes + score together */ } }}
                  className="w-full bg-gray-800 border border-amber-700/50 rounded px-2 py-1.5 text-xs text-gray-100"
                >
                  <option value="">📚 …or pick a Library track (any part)</option>
                  {library.filter((x) => x.audioUrl).map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
                </select>
              </div>
            </div>

            {/* Music stem (optional third channel) */}
            <div
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) { setMusicFile(f); loadMusicFile(f); }
              }}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-gray-700 rounded-lg p-4 text-center hover:border-purple-500/40 transition"
            >
              <div className="text-[10px] uppercase tracking-wider text-purple-400 mb-1">Track 2 · Music / Instrumental (CENTER)</div>
              {musicFile || musicFileName ? (
                <div>
                  <div className="text-purple-200 font-medium truncate">{musicFileName || musicFile?.name}</div>
                  <button
                    onClick={clearMusicFile}
                    className="mt-1 text-[10px] text-gray-500 hover:text-red-400 underline"
                  >
                    clear
                  </button>
                </div>
              ) : (
                <div className="text-gray-500 text-sm">
                  Drag-drop the instrumental stem<br/>
                  <span className="text-xs">Optional — plays alongside vocals</span>
                </div>
              )}
              <label className="mt-3 inline-block cursor-pointer text-xs font-medium px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white transition focus-within:ring-2 focus-within:ring-purple-400/60">
                {(musicFile || musicFileName) ? 'Choose a different file' : 'Choose music file'}
                <input
                  type="file"
                  accept="audio/*,.m4a,.mp3,.wav,.ogg"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) { setMusicFile(f); loadMusicFile(f); }
                  }}
                  className="sr-only"
                />
              </label>
              {/* V3.6: pick Track 2 from the SAME library (e.g. a "Minus"/backing track) */}
              <div className="mt-2">
                <select
                  value=""
                  onChange={(e) => { const it = library.find((x) => x.id === e.target.value); if (it?.audioUrl) { setMusicFile(null); loadMusicFromUrl(it.audioUrl, it.title); setSourcesOpen(false); } }}
                  className="w-full bg-gray-800 border border-purple-700/50 rounded px-2 py-1.5 text-xs text-gray-100"
                >
                  <option value="">📚 …or pick a Library track (e.g. a “Minus” backing)</option>
                  {library.filter((x) => x.audioUrl).map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
                </select>
              </div>
            </div>
          </div>

          {uploadFile && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="text-xs text-gray-400 sm:col-span-2">
                Title
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100"
                />
              </label>
              <label className="text-xs text-gray-400">
                Tempo (bpm)
                <input
                  type="number"
                  value={tempo}
                  onChange={(e) => setTempo(Number(e.target.value) || 100)}
                  className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100"
                />
              </label>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => uploadFile && loadQuickFile(uploadFile)}
              disabled={!uploadFile}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 rounded font-semibold text-sm"
              title="Skip extraction — load this file straight into the Dichotic Player below."
            >
              Quick Play (no extraction)
            </button>
            <button
              onClick={runExtraction}
              disabled={!uploadFile || extracting}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 rounded font-semibold text-sm"
            >
              {extracting ? 'Extracting…' : 'Extract Notes'}
            </button>
            <button
              onClick={saveTemplate}
              disabled={!uploadFile || extractedNotes.length === 0 || saving}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 rounded font-semibold text-sm"
            >
              {saving ? 'Saving…' : 'Save to Library'}
            </button>
            {currentTemplate && (
              <button
                onClick={saveEditedTemplate}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 rounded font-semibold text-sm"
              >
                {saving ? 'Updating…' : 'Update Edits'}
              </button>
            )}
          </div>

          {extractProgress && (
            <div className="mt-3 text-xs text-amber-300">
              {extractProgress.message} ({Math.round(extractProgress.pct * 100)}%)
              <div className="h-1 bg-gray-800 rounded mt-1 overflow-hidden">
                <div className="h-full bg-amber-400" style={{ width: `${extractProgress.pct * 100}%` }} />
              </div>
            </div>
          )}

          {statusMsg && (
            <div className="mt-3 text-xs text-gray-300 bg-gray-800/60 border border-gray-700 rounded p-2">
              {statusMsg}
            </div>
          )}
        </details>

        {/* ─── Editor (piano-roll) ───────────────────────────────────── */}
        {(extractedNotes.length > 0 || omrTarget) && (
          <section className="order-3 bg-gray-900/60 border border-amber-500/20 rounded-lg p-3">
            <div className="flex items-center justify-between mb-3 gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-amber-300">Pitch Tracker</h2>
                <button
                  onClick={() => setEditNotes((v) => !v)}
                  aria-label={editNotes ? 'Done editing notes' : 'Edit notes'}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${editNotes ? 'bg-amber-600 border-amber-400 text-white' : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'}`}
                  title="Toggle note-correcting (click notes to delete bad ones)"
                >
                  {editNotes ? '✓ Done' : '✎ Correct'}
                </button>
              </div>
              <div className="flex items-center flex-wrap gap-2 text-xs text-gray-400">
                <span>Zoom</span>
                <input
                  type="range" min={20} max={300} value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-32"
                />
                <span>{extractedNotes.length} notes</span>
                {omrTarget && (
                  <span className="flex items-center gap-1 text-fuchsia-300" title={`Real notated ${omrTarget.part} notes read off the sheet music (OMR)`}>
                    <span className="inline-block w-3 h-2 rounded-[1px] border border-dashed border-fuchsia-400" />
                    Score target · {omrTarget.part} ×{omrTarget.noteCount}
                  </span>
                )}
              </div>
            </div>
            {omrTarget && (
              <div className="mb-2 grid grid-cols-2 md:grid-cols-5 gap-1.5 text-[11px]">
                <div className="rounded border border-gray-800 bg-black/30 px-2 py-1">
                  <div className="text-gray-500">Target</div>
                  <div className="font-mono text-cyan-200">{currentScoreTargetNote ? midiToName(currentScoreTargetNote.pitchMidi) : '--'}</div>
                </div>
                <div className="rounded border border-gray-800 bg-black/30 px-2 py-1">
                  <div className="text-gray-500">Score</div>
                  <div className={scoreHealthOk ? 'text-emerald-300' : scoreHealth ? 'text-rose-300' : 'text-gray-400'}>
                    {scoreHealth ? (scoreHealthOk ? 'verified' : `${scoreHealthFailCount} fail`) : `${omrTarget.noteCount} notes`}
                  </div>
                </div>
                <div className="rounded border border-gray-800 bg-black/30 px-2 py-1">
                  <div className="text-gray-500">Take</div>
                  <div className="font-mono text-amber-200">{coachAccuracyPct == null ? '--' : `${coachAccuracyPct}%`}</div>
                </div>
                <div className="rounded border border-gray-800 bg-black/30 px-2 py-1">
                  <div className="text-gray-500">Avg drift</div>
                  <div className="font-mono text-fuchsia-200">{coachAvgCents == null ? '--' : `${centsLabel(coachAvgCents)} · ${coachBias}`}</div>
                </div>
                <div className="rounded border border-gray-800 bg-black/30 px-2 py-1">
                  <div className="text-gray-500">Now</div>
                  <div className="font-mono text-cyan-200">{centsLabel(coachStats.lastCents)}{coachAbsCents == null ? '' : ` · ${Math.round(coachAbsCents)}c mean`}</div>
                </div>
              </div>
            )}
            {takeHistory.length > 0 && (
              <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-gray-500 mr-1">Recent takes</span>
                {takeHistory.slice(0, 5).map((take) => (
                  <span
                    key={take.id}
                    className="rounded border border-gray-800 bg-black/30 px-2 py-1 text-gray-300"
                    title={`${take.title} · ${take.samples} samples · ${centsLabel(take.avgCents)} avg · ${take.meanAbsCents}c mean abs`}
                  >
                    <span className="font-mono text-amber-200">{take.accuracyPct}%</span>
                    <span className="ml-1 text-gray-500">{fmtTime(take.durationSec)}</span>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={clearTakeHistory}
                  className="rounded border border-gray-800 bg-gray-900 px-2 py-1 text-gray-500 hover:text-rose-300 hover:border-rose-500/40"
                >
                  clear
                </button>
              </div>
            )}
            <div
              ref={editorScrollRef}
              className="overflow-auto bg-black/50 rounded border border-gray-800"
              style={{ maxHeight: '280px' }}
            >
              <svg width={editorWidth} height={editorHeight} style={{ display: 'block' }}>
                {/* Horizontal grid lines (octaves highlighted) */}
                {Array.from({ length: PITCH_MAX - PITCH_MIN + 1 }).map((_, i) => {
                  const midi = PITCH_MAX - i;
                  const y = i * editorRowHeight;
                  const isOctave = midi % 12 === 0;
                  return (
                    <g key={midi}>
                      <line x1={0} y1={y} x2={editorWidth} y2={y}
                        stroke={isOctave ? '#3a2d10' : '#1a1a22'} strokeWidth={isOctave ? 1 : 0.5} />
                      {isOctave && (
                        <text x={4} y={y + 5} fill="#7a5b1a" fontSize={9}>{midiToName(midi)}</text>
                      )}
                    </g>
                  );
                })}
                {/* Vertical grid lines (every second) */}
                {Array.from({ length: Math.ceil(Math.max(extractedDuration, omrSpan)) + 1 }).map((_, i) => (
                  <line key={i} x1={i * zoom} y1={0} x2={i * zoom} y2={editorHeight}
                    stroke="#1a1a22" strokeWidth={0.5} />
                ))}
                {/* Notes */}
                {extractedNotes.map((n, idx) => {
                  if (n.pitchMidi < PITCH_MIN || n.pitchMidi > PITCH_MAX) return null;
                  const x = n.startTimeSeconds * zoom;
                  const w = Math.max(2, n.durationSeconds * zoom);
                  const y = (PITCH_MAX - n.pitchMidi) * editorRowHeight;
                  const isCurrent = currentTargetNote === n;
                  return (
                    <rect key={idx}
                      x={x} y={y} width={w} height={editorRowHeight - 1}
                      fill={`hsl(${(n.pitchMidi * 7) % 360}, 70%, 55%)`}
                      opacity={0.5 + Math.min(0.5, n.amplitude * 0.7)}
                      stroke={isCurrent ? '#fde047' : undefined}
                      strokeWidth={isCurrent ? 1.5 : 0}
                      onClick={editNotes ? () => deleteNote(idx) : undefined}
                      style={{ cursor: editNotes ? 'pointer' : 'default' }}
                    >
                      <title>{midiToName(n.pitchMidi)} · t={n.startTimeSeconds.toFixed(2)}s{editNotes ? ' · click to delete' : ''}</title>
                    </rect>
                  );
                })}
                {/* Recording's continuous pitch contour — orange polyline showing
                    exactly where the vocalist goes melodically over time. This is
                    the F0 curve Jon asked for: graph out where the vocals are going. */}
                {vocalContour.length > 0 && (
                  <polyline
                    pointerEvents="none"
                    fill="none"
                    stroke="#f97316"
                    strokeWidth={1.5}
                    opacity={0.8}
                    points={vocalContour.map(pt => {
                      const x = pt.time * zoom;
                      const y = (PITCH_MAX - pt.midi) * editorRowHeight + editorRowHeight / 2;
                      return `${x},${y}`;
                    }).join(' ')}
                  />
                )}
                {/* OMR score-target lane — the REAL notated notes recognized off
                    the sheet music (Audiveris), as dashed fuchsia outlines so the
                    singer sees the authoritative pitch target and can double-check
                    the audio extraction. Phase 1: discrete score sequence, NOT
                    sample-synced to playback. Additive — sits above the audio
                    notes/contour, below the live-pitch group. */}
                {omrTarget && omrTarget.notes.map((n: PracticeNote, i: number) => {
                  if (n.pitchMidi < PITCH_MIN || n.pitchMidi > PITCH_MAX) return null;
                  const x = n.startTimeSeconds * zoom;
                  const w = Math.max(3, n.durationSeconds * zoom);
                  const y = (PITCH_MAX - n.pitchMidi) * editorRowHeight;
                  const recovered = n.src === 'engraving-recovered';
                  const active = currentScoreTargetNote === n;
                  return (
                    <rect key={`omr-${i}`} x={x} y={y + 0.5}
                      width={w} height={editorRowHeight - 1}
                      fill={active ? 'rgba(34,211,238,0.24)' : recovered ? 'rgba(251,191,36,0.22)' : 'rgba(232,121,249,0.10)'}
                      stroke={active ? '#22d3ee' : recovered ? '#fbbf24' : '#e879f9'}
                      strokeWidth={active ? 2 : recovered ? 1.5 : 1} strokeDasharray={active || recovered ? undefined : '3 2'} rx={1}
                      pointerEvents="none"
                      style={{ filter: active ? 'drop-shadow(0 0 5px rgba(34,211,238,0.8))' : recovered ? 'drop-shadow(0 0 3px rgba(251,191,36,0.7))' : 'drop-shadow(0 0 2px rgba(232,121,249,0.45))' }} />
                  );
                })}
                {/* V3.2: live REFERENCE pitch (detected from the playing audio) +
                    YOUR voice. White bar = the real pitch right now; cyan dot =
                    you; the connector shows how far above/below you are. Above the
                    bar = singing too high, below = too low. */}
                {(() => {
                  const cx = playbackState !== 'idle' ? practiceTime * zoom : 0;
                  const yOf = (m: number) => (PITCH_MAX - m) * editorRowHeight + editorRowHeight / 2;
                  const refOk = refMidi !== null && refMidi >= PITCH_MIN && refMidi <= PITCH_MAX;
                  const micOk = liveMidi !== null && liveMidi >= PITCH_MIN && liveMidi <= PITCH_MAX;
                  const refY = refOk ? yOf(refMidi as number) : null;
                  const micY = micOk ? yOf(liveMidi as number) : null;
                  const onPitch = refOk && micOk && Math.abs((refMidi as number) - (liveMidi as number)) <= 0.7;
                  // V3.3: glowing voice trail — the last ~1.2s of your pitch as a
                  // smooth tail behind the head, timeline-aligned with the contour.
                  const nowMs = (typeof performance !== 'undefined') ? performance.now() : 0;
                  const trailPts = micTrailRef.current
                    .map((p) => {
                      const x = cx - zoom * ((nowMs - p.t) / 1000);
                      if (x < 0 || p.midi < PITCH_MIN || p.midi > PITCH_MAX) return null;
                      return `${x.toFixed(1)},${yOf(p.midi).toFixed(1)}`;
                    })
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <g pointerEvents="none">
                      {trailPts && (
                        <polyline points={trailPts} fill="none"
                          stroke={onPitch ? '#4ade80' : '#22d3ee'} strokeWidth={3}
                          strokeLinecap="round" strokeLinejoin="round" opacity={0.85}
                          style={{ filter: onPitch ? 'drop-shadow(0 0 6px #4ade80)' : 'drop-shadow(0 0 5px #22d3ee)' }} />
                      )}
                      {refY !== null && micY !== null && (
                        <line x1={cx} y1={refY} x2={cx} y2={micY}
                          stroke={onPitch ? '#4ade80' : '#fbbf24'} strokeWidth={2} opacity={0.85} />
                      )}
                      {refY !== null && (
                        <line x1={cx - 16} y1={refY} x2={cx + 16} y2={refY}
                          stroke="#f8fafc" strokeWidth={3} strokeLinecap="round"
                          style={{ filter: 'drop-shadow(0 0 4px #f8fafc)' }} />
                      )}
                      {micY !== null && (
                        <circle cx={cx} cy={micY} r={6}
                          fill={onPitch ? '#4ade80' : '#22d3ee'} stroke="#0f172a" strokeWidth={1.5}
                          style={{ filter: onPitch ? 'drop-shadow(0 0 6px #4ade80)' : 'drop-shadow(0 0 4px #22d3ee)' }} />
                      )}
                    </g>
                  );
                })()}
                {/* Playhead cursor in practice mode */}
                {playbackState !== 'idle' && (
                  <line x1={practiceTime * zoom} y1={0} x2={practiceTime * zoom} y2={editorHeight}
                    stroke="#ff5577" strokeWidth={2} />
                )}
              </svg>
            </div>
          </section>
        )}

        {/* ─── Mixing Desk — collapsible bottom-sheet, launched from the orb 🎛️ ── */}
        {mixerOpen && (
        <section className="fixed right-2 bottom-2 z-[9998] w-[min(360px,94vw)] max-h-[86vh] overflow-y-auto bg-gray-900/95 backdrop-blur border border-amber-500/50 rounded-xl p-2.5 shadow-2xl">
          <div className="flex items-center justify-between mb-0.5">
            <h2 className="text-base font-semibold text-amber-300">🎛️ Mixing Desk</h2>
            <button onClick={() => setMixerOpen(false)} className="w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm flex items-center justify-center" title="Collapse the desk back to the orb">✕</button>
          </div>
          <div className="mb-2 text-xs">
            {playbackLabel ? (
              <span className="text-amber-300">{playbackLabel}</span>
            ) : (
              <span className="text-gray-500">Nothing loaded. Drop a vocal or music stem above, or pick a library template.</span>
            )}
            {playbackState !== 'idle' && (
              <span className="ml-3 text-gray-500">
                {playbackState === 'paused' ? '⏸' : '▶'} {practiceTime.toFixed(2)}s
                {playbackDurationRef.current > 0 && ` / ${playbackDurationRef.current.toFixed(2)}s`}
              </span>
            )}
          </div>

          {/* V3: click-to-seek bar + A/B loop (YouTube-style scrubber) */}
          {durationSec > 0 && (
            <div className="mb-2">
              <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
                <span className="font-mono">{fmtTime(practiceTime)}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={markLoopA}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold border ${loopA != null ? 'bg-green-700/60 border-green-500 text-green-200' : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'}`}
                    title="Set loop START at the playhead"
                  >
                    A {loopA != null ? fmtTime(loopA) : ''}
                  </button>
                  <button
                    onClick={markLoopB}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold border ${loopB != null ? 'bg-green-700/60 border-green-500 text-green-200' : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'}`}
                    title="Set loop END at the playhead (must be after A)"
                  >
                    B {loopB != null ? fmtTime(loopB) : ''}
                  </button>
                  <button
                    onClick={() => setLoopWhole((v) => !v)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold border ${loopWhole ? 'bg-cyan-700/60 border-cyan-400 text-cyan-100' : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'}`}
                    title="Loop the WHOLE song — restarts from the top when it ends"
                  >
                    ↻ Song
                  </button>
                  {(loopA != null || loopB != null) && (
                    <button
                      onClick={clearLoop}
                      className="px-2 py-0.5 rounded text-[11px] border bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700"
                      title="Clear the A/B loop"
                    >
                      ✕ loop
                    </button>
                  )}
                  {loopA != null && loopB != null && (
                    <span className="text-green-400 font-semibold animate-pulse">↻ looping</span>
                  )}
                </div>
                <span className="font-mono">{fmtTime(durationSec)}</span>
              </div>
              {practicePhrases.length > 0 && (
                <div className="mb-1 flex gap-1 overflow-x-auto pb-1">
                  {practicePhrases.slice(0, 18).map((phrase) => (
                    <button
                      key={phrase.id}
                      type="button"
                      onClick={() => loopPhrase(phrase)}
                      className={`shrink-0 rounded border px-2 py-0.5 text-[11px] font-semibold ${
                        activePhraseId === phrase.id
                          ? 'border-cyan-400 bg-cyan-500/20 text-cyan-100'
                          : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-cyan-500/50 hover:text-cyan-200'
                      }`}
                      title={`${phrase.label} · ${fmtTime(phrase.start)}-${fmtTime(phrase.end)} · ${phrase.noteCount} notes`}
                    >
                      {phrase.shortLabel || phrase.label} <span className="font-mono text-gray-500">{fmtTime(phrase.start)}</span>
                    </button>
                  ))}
                </div>
              )}
              <div
                ref={seekBarElRef}
                onPointerDown={handleSeekBarPointer}
                className="relative h-3 bg-gray-800 rounded-full cursor-pointer group"
                title="Click anywhere to jump there"
              >
                {/* loop region highlight */}
                {loopA != null && loopB != null && (
                  <div
                    className="absolute top-0 h-full bg-green-500/25 rounded"
                    style={{
                      left: `${(loopA / durationSec) * 100}%`,
                      width: `${((loopB - loopA) / durationSec) * 100}%`,
                    }}
                  />
                )}
                {/* progress fill */}
                <div
                  className="absolute top-0 left-0 h-full bg-amber-500/70 rounded-full"
                  style={{ width: `${Math.min(100, (practiceTime / durationSec) * 100)}%` }}
                />
                {/* playhead knob */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-amber-300 rounded-full shadow group-hover:scale-125 transition-transform"
                  style={{ left: `calc(${Math.min(100, (practiceTime / durationSec) * 100)}% - 7px)` }}
                />
                {/* A / B pins */}
                {loopA != null && (
                  <div className="absolute -top-1.5 w-0.5 h-6 bg-green-400" style={{ left: `${(loopA / durationSec) * 100}%` }} />
                )}
                {loopB != null && (
                  <div className="absolute -top-1.5 w-0.5 h-6 bg-green-400" style={{ left: `${(loopB / durationSec) * 100}%` }} />
                )}
              </div>
              <p className="text-[10px] text-gray-600 mt-1 hidden sm:block">
                Click the bar to jump · press <span className="text-green-400 font-bold">A</span> at the start of the tricky part, play to the end of it, press <span className="text-green-400 font-bold">B</span> — it repeats forever until you clear it.
              </p>
            </div>
          )}

          {/* Pitchforks v1 slider — THE canonical mic feedback meter.
              V3.2: visible whenever the mic is LIVE (was: only while on-pitch),
              so Jon always sees the meter respond. Fill = lock hold; green ≥80%.
              The "too high / too low" read lives on the piano roll (your dot vs
              the white reference bar) — position only, no numbers/arrows. */}
          <div className="mb-2 h-6 flex items-center justify-center gap-2">
            {micEnabled ? (
              <>
                <span className="text-[11px]" title="Mic is live">🎤</span>
                <div
                  style={{
                    width: 200, height: 6,
                    background: 'rgba(10,10,20,0.6)',
                    border: '1px solid rgba(60,60,90,0.6)',
                    borderRadius: 3, overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${matchProgress * 100}%`,
                      height: '100%',
                      background: matchProgress >= 0.8 ? '#4ade80' : '#fbbf24',
                      boxShadow: matchProgress >= 0.8
                        ? '0 0 10px #4ade80, 0 0 20px #4ade8060'
                        : '0 0 8px #fbbf2460',
                      transition: 'width 0.05s linear',
                    }}
                  />
                </div>
              </>
            ) : (
              <span className="text-[10px] text-gray-600 uppercase tracking-wider">
                {playbackState === 'playing' ? 'Start mic monitor →' : 'Start mic monitor, then press play'}
              </span>
            )}
          </div>

          {/* Transport lives on the orb — the desk only carries the mic toggle. */}
          <div className="mb-2">
            <button
              onClick={toggleMicMonitor}
              className={`w-full px-3 py-2 rounded-lg text-sm font-semibold text-white transition-colors shadow-sm ${
                micEnabled ? 'bg-rose-600 hover:bg-rose-500 ring-2 ring-rose-400/50' : 'bg-cyan-600 hover:bg-cyan-500'
              }`}
            >
              {micEnabled ? '● Stop mic' : 'Start mic'}
            </button>
          </div>

          <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-2">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Mixing desk · plunk · output · mic profile</div>
            {/* V3.7: Tempo Trainer — pitch-preserving slow-down / speed-up (lives in the desk) */}
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-950/20 px-2 py-1.5">
              <span className="text-[11px] font-bold text-purple-200">🐢 Tempo</span>
              <span className={`font-mono text-xs ${tempoPct === 100 ? 'text-gray-400' : 'text-purple-300 font-bold'}`}>{tempoPct}%</span>
              <input
                type="range" min={50} max={200} step={5} value={tempoPct}
                onChange={(e) => changeTempo(Number(e.target.value))}
                className="flex-1 min-w-[120px] accent-purple-400"
                title="Slow down to learn, speed up to test — pitch never changes"
              />
              <div className="flex items-center gap-1 flex-wrap">
                {[60, 75, 90, 100, 125, 150, 200].map((p) => (
                  <button
                    key={p}
                    onClick={() => changeTempo(p)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${tempoPct === p ? 'bg-purple-600/70 border-purple-400 text-white' : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              {stretching
                ? <span className="text-[10px] text-purple-300 animate-pulse">stretching…</span>
                : <span className="text-[10px] text-gray-500">pitch locked 🔒</span>}
            </div>
            <div className="space-y-3">
          {/* V3.8 console: compact channel strips — small knobs, tap to spin bigger */}
          <div className="grid grid-cols-3 gap-1.5">
            {([
              { name: 'Vocals', hex: '#fbbf24', vol: vocalVol, pan: vocalPan, onVol: handleVocalVolChange, onPan: handleVocalPanChange, meterRef: vocalMeterElRef, text: 'text-amber-400' },
              { name: 'Music', hex: '#a78bfa', vol: musicVol, pan: musicPan, onVol: handleMusicVolChange, onPan: handleMusicPanChange, meterRef: musicMeterElRef, text: 'text-purple-400' },
              { name: 'Mic', hex: '#22d3ee', vol: micVol, pan: micPan, onVol: handleMicVolChange, onPan: handleMicPanChange, meterRef: micMeterElRef, text: 'text-cyan-400' },
            ] as const).map((ch) => (
              <div key={ch.name} className="flex flex-col items-center gap-2 bg-gray-950/50 border border-gray-800 rounded-lg px-1 py-2">
                <span className={`text-[10px] font-bold uppercase tracking-wide ${ch.text}`}>{ch.name}</span>
                <MixKnob label="Vol" value={ch.vol} min={0} max={VOL_MAX} step={5} onChange={ch.onVol} format={(v) => `${v}%`} color={ch.hex} />
                <MixKnob label="Pan" value={ch.pan} min={-1} max={1} step={0.05} onChange={ch.onPan} format={(v) => (Math.abs(v) < 0.025 ? 'C' : v < 0 ? `L${Math.round(-v * 100)}` : `R${Math.round(v * 100)}`)} color={ch.hex} />
                {/* live level meter — proof the channel is flowing */}
                <div className="h-1 w-full bg-gray-800 rounded overflow-hidden">
                  <div ref={ch.meterRef} className="h-full rounded transition-none" style={{ width: '0%' }} />
                </div>
              </div>
            ))}
          </div>

          <div className="text-xs text-gray-400 bg-gray-900/60 border border-gray-800 rounded-lg p-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="inline-flex items-center gap-2 text-emerald-300 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={plunkEnabled}
                  onChange={(e) => setPlunkEnabled(e.target.checked)}
                  className="accent-emerald-500"
                />
                <span>Plunk (score tones)</span>
              </label>
              <div className="flex flex-1 items-center gap-2">
                <span className="text-gray-500">0</span>
                <input
                  type="range"
                  min={0}
                  max={VOL_MAX}
                  step={1}
                  value={plunkVol}
                  onChange={(e) => setPlunkVol(Math.max(0, Math.min(VOL_MAX, Number(e.target.value))))}
                  className="w-full accent-emerald-500"
                />
                <span className="w-12 text-right font-mono text-emerald-300">{plunkVol}%</span>
              </div>
            </div>
          </div>

          {/* V3.2: Output mode — Headphones keeps dichotic L/R + lowest latency;
              Speakers turns on echo-cancellation so the track can't fake a match. */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
            <span>Output</span>
            <div className="inline-flex rounded border border-gray-700 overflow-hidden">
              {(['headphones', 'speakers'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setOutputMode(mode)}
                  className={`px-3 py-1 ${outputMode === mode ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                >
                  {mode === 'headphones' ? '🎧 Headphones' : '🔊 Speakers'}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-gray-600">
              {outputMode === 'headphones'
                ? 'dichotic L/R · lowest latency (best for practice)'
                : 'echo-cancel ON so the track can’t fake a match'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <label className="text-xs text-gray-400">
              Mic profile
              <select
                value={micProfile}
                onChange={(e) => setMicProfile(e.target.value as MicProfile)}
                className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100"
              >
                {Object.entries(MIC_PROFILES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </label>
          </div>
            </div>
          </div>
        </section>
        )}
      </div>

      {/* ── TransportOrb — ALWAYS visible so every icon toggles its surface shut on re-tap.
            Parks top-left while the Mixing Desk is open (desk ✕ is top-right, so no collision). ── */}
      {true && (
      <div
        onPointerDown={onOrbDown}
        onPointerMove={onOrbMove}
        onPointerUp={onOrbUp}
        onClickCapture={onOrbClickCapture}
        style={{ touchAction: 'none', ...(mixerOpen ? { top: 12, left: 12 } : (orbPos ? { left: orbPos.x, top: orbPos.y } : { right: 14, bottom: 84 })) }}
        className="fixed z-[10000] select-none"
      >
        <div className="flex items-center gap-1.5 flex-row-reverse">
          {/* WODEN-style tiny solar orb — tap to expand/collapse, drag to move */}
          <button
            onPointerDown={onBallDown}
            onPointerUp={onBallUp}
            onPointerCancel={onBallCancel}
            onPointerLeave={onBallCancel}
            onDoubleClick={onBallDouble}
            title="Tap → controls · long-press → jump menu · double-tap → mixing desk · drag → move"
            className="relative shrink-0 grid place-items-center rounded-full border backdrop-blur-md shadow-lg cursor-grab active:cursor-grabbing"
            style={{
              width: 56, height: 56, background: 'rgba(5,5,16,0.5)',
              borderColor: playbackState === 'playing' ? '#fbbf24' : 'rgba(245,158,11,0.55)',
              boxShadow: playbackState === 'playing' ? '0 0 24px #fbbf24aa' : '0 0 14px rgba(245,158,11,0.5)',
            }}
          >
            <span className="relative block" style={{ width: 50, height: 50 }}>
              <span className="absolute rounded-full" style={{ inset: '-6px', background: 'radial-gradient(circle, rgba(255,77,13,0.35) 0%, rgba(255,40,0,0.15) 50%, transparent 72%)', animation: 'vtorb-outer 4.2s ease-in-out infinite' }} />
              <span className="absolute rounded-full" style={{ inset: '-3px', background: 'radial-gradient(circle, rgba(255,153,38,0.6) 0%, rgba(255,64,0,0.3) 55%, transparent 75%)', animation: 'vtorb-mid 3.5s ease-in-out infinite' }} />
              <span className="absolute rounded-full" style={{ inset: '0px', background: 'radial-gradient(circle at 45% 42%, rgba(255,245,220,0.95) 0%, rgba(255,220,130,0.9) 25%, rgba(255,170,50,0.8) 50%, rgba(255,90,15,0.6) 75%, rgba(200,40,0,0.3) 100%)', boxShadow: '0 0 12px 2px rgba(255,170,50,0.4), 0 0 24px 4px rgba(255,100,20,0.2), inset 0 0 8px 2px rgba(255,240,200,0.3)', animation: 'vtorb-core 3s ease-in-out infinite' }} />
              {playbackState === 'playing' && (
                <span className="absolute inset-0 grid place-items-center text-[#3a1500] text-base pointer-events-none">❚❚</span>
              )}
            </span>
          </button>

          {/* expanding control menu — only when the orb is open */}
          {orbExpanded && (
            <div className="flex flex-col gap-1.5 rounded-2xl bg-neutral-900/92 backdrop-blur border border-amber-500/40 shadow-2xl px-1.5 py-1.5">
              <div className="flex items-center gap-1">
              {playbackState === 'playing' ? (
                <button onPointerDown={onPlayDown} onPointerUp={onPlayUp} onPointerCancel={onPlayCancel} onPointerLeave={onPlayCancel} aria-label="Pause" className="w-11 h-11 rounded-full bg-amber-600 hover:bg-amber-500 text-white text-lg grid place-items-center" title="Pause · long-press → A/B loop">⏸</button>
              ) : (
                <button onPointerDown={onPlayDown} onPointerUp={onPlayUp} onPointerCancel={onPlayCancel} onPointerLeave={onPlayCancel} disabled={!vocalBufRef.current && !musicBufRef.current} aria-label="Play" className="w-11 h-11 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white text-lg grid place-items-center" title="Play · long-press → A/B loop">▶</button>
              )}
              <button onClick={stopPlayback} className="w-9 h-9 rounded-full bg-neutral-700 hover:bg-neutral-600 text-white text-sm grid place-items-center" title="Stop">⏹</button>
              <button onClick={() => setLoopWhole((v) => !v)} className={`w-9 h-9 rounded-full text-sm grid place-items-center ${loopWhole ? 'bg-cyan-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`} title="Loop whole song">↻</button>
              <button onClick={() => setMixerOpen((v) => !v)} aria-label="Mixer" className={`w-9 h-9 rounded-full text-sm grid place-items-center ${mixerOpen ? 'bg-amber-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`} title="Mixing desk (volumes · pan · tempo · loops)">🎛️</button>
              <button onClick={() => setScoreFocus((v) => !v)} aria-label={scoreFocus ? 'Exit Focus' : 'Score Focus'} className={`w-9 h-9 rounded-full text-sm grid place-items-center ${scoreFocus ? 'bg-amber-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`} title="Score Focus — hide everything but the score">⛶</button>
              <button onClick={() => { setSourcesOpen((v) => { if (!v) setScoreFocus(false); return !v; }); }} aria-label="Sources" className={`w-9 h-9 rounded-full text-sm grid place-items-center ${sourcesOpen ? 'bg-amber-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`} title="Sources — Library + Add/Extract (tap again to close)">📂</button>
              <div className="px-1.5 text-[10px] font-mono text-neutral-400 tabular-nums">{practiceTime.toFixed(1)}s</div>
              </div>
              {/* progress bar — tap to seek there · hold for A/B + speed · drag to scrub */}
              {durationSec > 0 && (
                <div ref={orbSeekElRef} onPointerDown={onOrbSeekDown} onPointerMove={onOrbSeekMove} onPointerUp={onOrbSeekUp} style={{ touchAction: 'none' }} className="relative h-2.5 mx-1 mb-0.5 rounded-full bg-neutral-700 cursor-pointer" title="Tap to seek · hold for A/B + speed">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-amber-400" style={{ width: `${Math.min(100, (practiceTime / durationSec) * 100)}%` }} />
                  {loopA != null && <div className="absolute inset-y-0 w-[2px] bg-green-400" style={{ left: `${Math.min(100, (loopA / durationSec) * 100)}%` }} />}
                  {loopB != null && <div className="absolute inset-y-0 w-[2px] bg-green-400" style={{ left: `${Math.min(100, (loopB / durationSec) * 100)}%` }} />}
                </div>
              )}
            </div>
          )}

          {/* long-press → jump / nav menu */}
          {orbNavOpen && (
            <div className="flex flex-col gap-0.5 rounded-2xl bg-neutral-900/95 backdrop-blur border border-cyan-500/40 shadow-2xl p-1.5">
              <div className="text-[9px] uppercase tracking-wider text-neutral-500 px-2 pb-0.5">Jump to</div>
              <button onClick={() => orbJumpTo(['library'])} className="text-left text-xs text-neutral-200 hover:bg-neutral-800 rounded px-2 py-1.5 whitespace-nowrap">📚 Library</button>
              <button onClick={() => orbJumpTo(['upload'])} className="text-left text-xs text-neutral-200 hover:bg-neutral-800 rounded px-2 py-1.5 whitespace-nowrap">⬆ Upload / Extract</button>
              <button onClick={() => orbJumpTo(['score view', 'sheet music', 'score'])} className="text-left text-xs text-neutral-200 hover:bg-neutral-800 rounded px-2 py-1.5 whitespace-nowrap">🎼 Score</button>
              <button onClick={() => orbJumpTo(['tracker', 'note editor', 'zoom'])} className="text-left text-xs text-neutral-200 hover:bg-neutral-800 rounded px-2 py-1.5 whitespace-nowrap">📊 Tracker</button>
              <button onClick={() => { setMixerOpen(true); setOrbNavOpen(false); }} className="text-left text-xs text-amber-200 hover:bg-neutral-800 rounded px-2 py-1.5 whitespace-nowrap">🎛️ Mixing Desk</button>
              <button onClick={() => { reloadSong(); setOrbNavOpen(false); }} disabled={!selectedId} className="text-left text-xs text-cyan-200 hover:bg-neutral-800 rounded px-2 py-1.5 whitespace-nowrap disabled:opacity-40">↻ Reload song</button>
              <a href="/pitch-defender/baritone-ball" className="block text-left text-xs text-amber-200 hover:bg-neutral-800 rounded px-2 py-1.5 whitespace-nowrap">🎈 Ball trainer</a>
              <button onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setOrbNavOpen(false); }} className="text-left text-xs text-neutral-200 hover:bg-neutral-800 rounded px-2 py-1.5 whitespace-nowrap">⬆️ Top</button>
            </div>
          )}

          {/* hold the progress bar → A/B loop + SPEED knob (focus practice — NOT the whole mixer) */}
          {abOpen && (
            <div className="flex items-center gap-2 rounded-2xl bg-neutral-900/95 backdrop-blur border border-green-500/40 shadow-2xl px-2 py-2">
              <button onClick={markLoopA} aria-label="Loop A" title="Set loop start (A) at the playhead" className={`px-2.5 h-9 rounded-full text-xs font-bold ${loopA != null ? 'bg-green-700 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}>A{loopA != null ? '•' : ''}</button>
              <button onClick={markLoopB} aria-label="Loop B" title="Set loop end (B) at the playhead" className={`px-2.5 h-9 rounded-full text-xs font-bold ${loopB != null ? 'bg-green-700 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}>B{loopB != null ? '•' : ''}</button>
              <button onClick={() => setLoopWhole((v) => !v)} aria-label="Repeat" title="Repeat whole song" className={`w-9 h-9 rounded-full text-sm grid place-items-center ${loopWhole ? 'bg-cyan-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}>↻</button>
              {(loopA != null || loopB != null) && (
                <button onClick={clearLoop} aria-label="Clear loop" title="Clear A/B loop" className="w-9 h-9 rounded-full text-sm grid place-items-center bg-neutral-800 text-neutral-400 hover:bg-neutral-700">✕</button>
              )}
              <div className="w-px h-10 bg-neutral-700 mx-0.5" />
              <MixKnob label="Speed" value={tempoPct} min={50} max={200} step={5} onChange={changeTempo} format={(v) => `${v}%`} color="#a78bfa" size={34} />
            </div>
          )}
        </div>
        <style>{`
          @keyframes vtorb-core { 0%,100%{transform:scale(0.92);opacity:0.85} 50%{transform:scale(1.08);opacity:1} }
          @keyframes vtorb-mid { 0%,100%{transform:scale(0.95);opacity:0.5} 50%{transform:scale(1.15);opacity:0.75} }
          @keyframes vtorb-outer { 0%,100%{transform:scale(0.9);opacity:0.3} 50%{transform:scale(1.2);opacity:0.55} }
        `}</style>
      </div>
      )}
    </div>
  );
}
