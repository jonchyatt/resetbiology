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

// Vocal range used for both extraction filter and editor display
const PITCH_MIN = 48; // C3
const PITCH_MAX = 84; // C6

const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function midiToName(m: number): string {
  return `${PITCH_NAMES[m % 12]}${Math.floor(m / 12) - 1}`;
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

export default function VocalTrainerIII() {
  // ─── Library + selected template ────────────────────────────────────────
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentTemplate, setCurrentTemplate] = useState<FullTemplate | null>(null);

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
  const [groupBy, setGroupBy] = useState<'part' | 'song' | 'mode' | 'flat'>('part');
  const [libFilter, setLibFilter] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [extractAllRun, setExtractAllRun] = useState(false);

  const libraryGroups = useMemo(() => {
    const q = libFilter.trim().toLowerCase();
    const items = q ? library.filter((i) => i.title.toLowerCase().includes(q)) : library;
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
      items: map.get(key)!.slice().sort((a, b) => a.title.localeCompare(b.title)),
    }));
  }, [library, groupBy, libFilter]);

  // ─── Editor state ───────────────────────────────────────────────────────
  const [zoom, setZoom] = useState(80); // px per second

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
  useEffect(() => { loopARef.current = loopA; }, [loopA]);
  useEffect(() => { loopBRef.current = loopB; }, [loopB]);
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

  // Music chain (center, optional)
  const musicGainNodeRef = useRef<GainNode | null>(null);
  const musicPanNodeRef = useRef<StereoPannerNode | null>(null);
  const musicSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const musicBufRef = useRef<AudioBuffer | null>(null);

  const playbackDurationRef = useRef(0);
  const startedAtRef = useRef(0);
  const pauseOffsetRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const micStreamRef = useRef<MediaStream | null>(null);
  const micSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micProfileGainNodeRef = useRef<GainNode | null>(null);
  const micUserGainNodeRef = useRef<GainNode | null>(null);
  const micPanNodeRef = useRef<StereoPannerNode | null>(null);

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
  const currentTargetRef = useRef<RawNote | null>(null);
  const livePitchFrameRef = useRef<number | null>(null);

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
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

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

    const offset = Math.max(0, Math.min(
      pauseOffsetRef.current,
      playbackDurationRef.current - 0.01,
    ));

    // Fire both sources at the SAME ctx.currentTime so they stay aligned.
    const startAt = ctx.currentTime + 0.02; // tiny lookahead to align both

    if (vocBuf) {
      const src = ctx.createBufferSource();
      src.buffer = vocBuf;
      src.connect(vocalGainNodeRef.current!);
      const vocOffset = Math.min(offset, vocBuf.duration - 0.01);
      src.start(startAt, Math.max(0, vocOffset));
      vocalSourceRef.current = src;
      src.onended = () => {
        if (vocalSourceRef.current === src) {
          // Natural end of vocal — let the music/tick continue; the tick will
          // stop at playbackDurationRef.current.
          vocalSourceRef.current = null;
        }
      };
    }
    if (musBuf) {
      const src = ctx.createBufferSource();
      src.buffer = musBuf;
      src.connect(musicGainNodeRef.current!);
      const musOffset = Math.min(offset, musBuf.duration - 0.01);
      src.start(startAt, Math.max(0, musOffset));
      musicSourceRef.current = src;
      src.onended = () => {
        if (musicSourceRef.current === src) {
          musicSourceRef.current = null;
        }
      };
    }

    // startedAt encodes (ctx.currentTime - offset) as-of the start moment.
    startedAtRef.current = startAt - offset;
    setPlaybackState('playing');

    const tick = () => {
      const c = audioCtxRef.current;
      if (!c) return;
      const elapsed = c.currentTime - startedAtRef.current;
      setPracticeTime(Math.max(0, elapsed));
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
        stopAudioSource();
        pauseOffsetRef.current = 0;
        setPracticeTime(0);
        setPlaybackState('idle');
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [ensureAudioGraph, stopAudioSource]);

  // V3: keep a ref to the latest startAudioSource so the tick closure (and
  // seek) can restart playback without stale-closure issues.
  useEffect(() => { startAudioSourceRef.current = startAudioSource; });

  const pausePlayback = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || playbackState !== 'playing') return;
    const elapsed = ctx.currentTime - startedAtRef.current;
    pauseOffsetRef.current = Math.max(0, Math.min(elapsed, playbackDurationRef.current));
    stopAudioSource();
    setPracticeTime(pauseOffsetRef.current);
    setPlaybackState('paused');
  }, [playbackState, stopAudioSource]);

  const stopPlayback = useCallback(() => {
    stopAudioSource();
    pauseOffsetRef.current = 0;
    setPracticeTime(0);
    setPlaybackState('idle');
  }, [stopAudioSource]);

  const playOrResume = useCallback(async () => {
    if (playbackState === 'playing') return;
    await startAudioSource();
  }, [playbackState, startAudioSource]);

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
    const release = () => { if (micEnabledRef.current) stopMicMonitor(); };
    const onVis = () => { if (document.visibilityState === 'hidden') release(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', release);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', release);
    };
  }, [stopMicMonitor]);

  // Decode template audio when the current template changes. Split out from the
  // template-metadata effect so loadTemplateAudio is defined by this point.
  useEffect(() => {
    if (!currentTemplate?.audioUrl) return;
    loadTemplateAudio(currentTemplate.audioUrl, currentTemplate.title);
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

  const editorWidth = useMemo(() => Math.max(800, extractedDuration * zoom), [extractedDuration, zoom]);
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
    ): number | null => {
      if (!analyser) return null;
      analyser.getFloatTimeDomainData(buf);
      let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
      const db = 20 * Math.log10(Math.sqrt(s / buf.length) + 1e-10);
      if (db < -55) { smoothRef.current = 0; return null; }   // noise gate
      const sr = audioCtxRef.current ? audioCtxRef.current.sampleRate : 48000;
      const [hz, clarity] = detector.findPitch(buf, sr);
      if (clarity < 0.8 || hz < 70 || hz > 1100) return null; // vocal range guard
      const midi = 69 + 12 * Math.log2(hz / 440);
      const prev = smoothRef.current;
      // EMA smooth, but SNAP on an octave-ish jump (don't lerp across a big leap)
      smoothRef.current = (prev && Math.abs(midi - prev) <= 7) ? 0.5 * midi + 0.5 * prev : midi;
      return smoothRef.current;
    };

    let raf = 0; let frame = 0;
    const loop = () => {
      const r = detectOne(refPitchAnalyserRef.current, refDetectorRef.current!, refBufRef.current!, refSmoothRef);
      const m = detectOne(micPitchAnalyserRef.current, micDetectorRef.current!, micBufRef.current!, micSmoothRef);
      refMidiRef.current = r;
      trackMicMidiRef.current = m;
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
  useEffect(() => { currentTargetRef.current = currentTargetNote; }, [currentTargetNote]);

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

  // ── Auto-scroll the piano-roll so the playhead stays visible ──
  useEffect(() => {
    if (playbackState !== 'playing') return;
    const el = editorScrollRef.current;
    if (!el) return;
    const playheadX = practiceTime * zoom;
    const target = Math.max(0, playheadX - el.clientWidth / 3);
    el.scrollLeft = target;
  }, [practiceTime, zoom, playbackState]);

  // ───────────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#08080f] text-gray-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-amber-300">Vocal Trainer III <span className="text-base font-semibold text-cyan-400 align-middle">· Blast Mix</span></h1>
            <p className="text-sm text-gray-400 mt-1">
              Upload a reference recording → extract melody → practice with dichotic L/R audio → full mixing desk (volume · balance · meters).
            </p>
          </div>
          <a href="/pitch-defender" className="text-sm text-amber-400 hover:text-amber-300">← Back to Pitch Defender</a>
        </header>

        {/* ─── How to use (step-by-step for practice sessions) ─────────── */}
        <details className="bg-gray-900/60 border border-cyan-500/30 rounded-lg p-4 open:pb-5" open>
          <summary className="text-lg font-semibold text-cyan-300 cursor-pointer select-none">
            🎵 How to practice your part (step by step)
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

        {/* ─── Library ───────────────────────────────────────────────── */}
        <section className="bg-gray-900/60 border border-amber-500/20 rounded-lg p-4">
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
                  placeholder="Filter songs…"
                  className="flex-1 min-w-[140px] bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100"
                />
                <span className="text-xs text-gray-500 whitespace-nowrap">{library.length} in library</span>
              </div>

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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-1">
                      {group.items.map((item) => {
                        const mm = parseMmTitle(item.title);
                        const leaf = mm && groupBy === 'part' ? `${mm.song} · ${mm.mix}`
                          : mm && groupBy === 'song' ? `${mm.part} · ${mm.mix}`
                          : item.title;
                        const busy = extractingId === item.id;
                        return (
                          <div
                            key={item.id}
                            className={`p-3 rounded border transition ${
                              selectedId === item.id
                                ? 'border-amber-400 bg-amber-500/10'
                                : 'border-gray-700 bg-gray-800/40 hover:bg-gray-800'
                            }`}
                          >
                            <button onClick={() => setSelectedId(item.id)} className="block w-full text-left">
                              <div className="font-medium text-amber-200 truncate">★ {leaf}</div>
                              <div className="text-xs text-gray-400 mt-1">
                                {item.noteCount} notes · {item.createdAt?.slice(0, 10) || ''}
                              </div>
                            </button>
                            <button
                              onClick={() => extractLibraryItem(item)}
                              disabled={extractingId !== null || extractAllRun || !item.audioUrl}
                              className={`mt-2 w-full text-[11px] px-2 py-1 rounded disabled:bg-gray-700 disabled:text-gray-500 ${
                                item.noteCount === 0
                                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                                  : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                              }`}
                            >
                              {busy
                                ? (extractProgress ? `Extracting… ${Math.round(extractProgress.pct * 100)}%` : 'Extracting…')
                                : item.noteCount === 0 ? 'Extract vocal line' : 'Re-extract'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                );
              })}
            </>
          )}
        </section>

        {/* ─── Upload + extraction ───────────────────────────────────── */}
        <section className="bg-gray-900/60 border border-amber-500/20 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-amber-300 mb-3">Upload + Extract</h2>
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
              <input
                type="file"
                accept="audio/*,.m4a,.mp3,.wav,.ogg"
                onChange={(e) => e.target.files?.[0] && handleFileChosen(e.target.files[0])}
                className="mt-3 text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:bg-amber-600 file:text-white hover:file:bg-amber-500"
              />
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
              <input
                type="file"
                accept="audio/*,.m4a,.mp3,.wav,.ogg"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) { setMusicFile(f); loadMusicFile(f); }
                }}
                className="mt-3 text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:bg-purple-600 file:text-white hover:file:bg-purple-500"
              />
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
        </section>

        {/* ─── Editor (piano-roll) ───────────────────────────────────── */}
        {extractedNotes.length > 0 && (
          <section className="bg-gray-900/60 border border-amber-500/20 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-amber-300">Note Editor — click any note to delete</h2>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>Zoom</span>
                <input
                  type="range" min={20} max={300} value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-32"
                />
                <span>{extractedNotes.length} notes</span>
              </div>
            </div>
            <div
              ref={editorScrollRef}
              className="overflow-auto bg-black/50 rounded border border-gray-800"
              style={{ maxHeight: '400px' }}
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
                {Array.from({ length: Math.ceil(extractedDuration) + 1 }).map((_, i) => (
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
                      onClick={() => deleteNote(idx)}
                      style={{ cursor: 'pointer' }}
                    >
                      <title>{midiToName(n.pitchMidi)} · t={n.startTimeSeconds.toFixed(2)}s · click to delete</title>
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
                  return (
                    <g pointerEvents="none">
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

        {/* ─── Dichotic Player (three independent channels) ───────────── */}
        <section className="bg-gray-900/60 border border-amber-500/20 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-amber-300 mb-1">Dichotic Player</h2>
          <p className="text-xs text-gray-500 mb-3">
            Three independent channels — Vocals hard-LEFT, Music center, Mic hard-RIGHT. Upload
            separate stems above; adjust each volume independently. Headphones required.
          </p>

          <div className="mb-3 text-xs">
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
            <div className="mb-4">
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
              <p className="text-[10px] text-gray-600 mt-1">
                Click the bar to jump · press <span className="text-green-400 font-bold">A</span> at the start of the tricky part, play to the end of it, press <span className="text-green-400 font-bold">B</span> — it repeats forever until you clear it.
              </p>
            </div>
          )}

          {/* Pitchforks v1 slider — THE canonical mic feedback meter.
              V3.2: visible whenever the mic is LIVE (was: only while on-pitch),
              so Jon always sees the meter respond. Fill = lock hold; green ≥80%.
              The "too high / too low" read lives on the piano roll (your dot vs
              the white reference bar) — position only, no numbers/arrows. */}
          <div className="mb-3 h-6 flex items-center justify-center gap-2">
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
            <button
              onClick={playOrResume}
              disabled={playbackState === 'playing' || (!vocalBufRef.current && !musicBufRef.current)}
              className="px-3 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 rounded text-sm font-semibold"
            >
              {playbackState === 'paused' ? 'Resume ▶' : 'Play ▶'}
            </button>
            <button
              onClick={pausePlayback}
              disabled={playbackState !== 'playing'}
              className="px-3 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-700 disabled:text-gray-500 rounded text-sm font-semibold"
            >
              Pause ⏸
            </button>
            <button
              onClick={stopPlayback}
              disabled={playbackState === 'idle'}
              className="px-3 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 rounded text-sm font-semibold"
            >
              Stop ■
            </button>
          </div>

          {/* V3 mixing desk: per-stream volume (0-400%) + L/R balance + live level meter */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            {([
              {
                name: 'Vocals', color: 'amber', vol: vocalVol, pan: vocalPan,
                onVol: handleVocalVolChange, onPan: handleVocalPanChange,
                meterRef: vocalMeterElRef, accent: 'accent-amber-500',
                text: 'text-amber-400', mono: 'text-amber-300',
              },
              {
                name: 'Music', color: 'purple', vol: musicVol, pan: musicPan,
                onVol: handleMusicVolChange, onPan: handleMusicPanChange,
                meterRef: musicMeterElRef, accent: 'accent-purple-500',
                text: 'text-purple-400', mono: 'text-purple-300',
              },
              {
                name: 'Mic / voice', color: 'cyan', vol: micVol, pan: micPan,
                onVol: handleMicVolChange, onPan: handleMicPanChange,
                meterRef: micMeterElRef, accent: 'accent-cyan-500',
                text: 'text-cyan-400', mono: 'text-cyan-300',
              },
            ] as const).map((ch) => (
              <div key={ch.name} className="text-xs text-gray-400 bg-gray-900/60 border border-gray-800 rounded-lg p-2">
                <div className="flex justify-between items-baseline mb-1">
                  <span className={ch.text}>{ch.name}</span>
                  <span className={`${ch.mono} font-mono`}>{ch.vol}%</span>
                </div>
                <input
                  type="range" min={0} max={VOL_MAX} step={1}
                  value={ch.vol}
                  onChange={(e) => ch.onVol(Number(e.target.value))}
                  className={`w-full ${ch.accent}`}
                />
                {/* Live level meter (post-gain) — proof the slider is doing something */}
                <div className="h-1.5 w-full bg-gray-800 rounded overflow-hidden my-1">
                  <div ref={ch.meterRef} className="h-full rounded transition-none" style={{ width: '0%' }} />
                </div>
                <div className="flex justify-between items-baseline mb-1 mt-1">
                  <span className="text-gray-500">L</span>
                  <span className="text-gray-400 font-mono">
                    {ch.pan === 0 ? 'CENTER' : ch.pan < 0 ? `${Math.round(-ch.pan * 100)}% LEFT` : `${Math.round(ch.pan * 100)}% RIGHT`}
                  </span>
                  <span className="text-gray-500">R</span>
                </div>
                <input
                  type="range" min={-1} max={1} step={0.05}
                  value={ch.pan}
                  onChange={(e) => ch.onPan(Number(e.target.value))}
                  className={`w-full ${ch.accent}`}
                />
              </div>
            ))}
          </div>

          {/* V3.2: Output mode — Headphones keeps dichotic L/R + lowest latency;
              Speakers turns on echo-cancellation so the track can't fake a match. */}
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-400">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
            <div className="flex items-end">
              <button
                onClick={toggleMicMonitor}
                className={`w-full px-3 py-2 rounded text-sm font-semibold ${
                  micEnabled ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'
                }`}
              >
                {micEnabled ? 'Stop mic monitor' : 'Start mic monitor'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
