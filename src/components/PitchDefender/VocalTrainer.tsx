'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VocalTrainer — Vocal practice coach for Pitch Defender
// ═══════════════════════════════════════════════════════════════════════════════
//
// Workflow:
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
} from './extractNotesFromAudio';

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

type MicProfile = 'laptop' | 'usb';

const MIC_PROFILES: Record<MicProfile, { label: string; latencyHint: AudioContextLatencyCategory; gain: number }> = {
  laptop: { label: 'Laptop built-in mic', latencyHint: 'interactive', gain: 1.5 },
  usb:    { label: 'USB / Audio interface', latencyHint: 'playback', gain: 0.9 },
};

// Vocal range used for both extraction filter and editor display
const PITCH_MIN = 48; // C3
const PITCH_MAX = 84; // C6

const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function midiToName(m: number): string {
  return `${PITCH_NAMES[m % 12]}${Math.floor(m / 12) - 1}`;
}

export default function VocalTrainer() {
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
  const [tempo, setTempo] = useState(100);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // ─── Editor state ───────────────────────────────────────────────────────
  const [zoom, setZoom] = useState(80); // px per second

  // ─── Practice mode state ────────────────────────────────────────────────
  const [practicePlaying, setPracticePlaying] = useState(false);
  const [practiceTime, setPracticeTime] = useState(0);
  const [micProfile, setMicProfile] = useState<MicProfile>('usb');
  const [micEnabled, setMicEnabled] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioBufRef = useRef<AudioBuffer | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startedAtRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micNodesRef = useRef<{ src: MediaStreamAudioSourceNode; gain: GainNode; pan: StereoPannerNode } | null>(null);

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

  // Load a template (audio + notes) when selected
  useEffect(() => {
    if (!selectedId) { setCurrentTemplate(null); return; }
    const lib = library.find(l => l.id === selectedId);
    if (!lib) return;
    (async () => {
      try {
        const r = await fetch(lib.templateUrl, { cache: 'no-store' });
        const tpl = await r.json();
        // Invalidate any decoded buffer from the previous template and stop
        // playback — otherwise clicking Play after switching templates would
        // play the OLD audio.
        if (sourceRef.current) {
          try { sourceRef.current.stop(); } catch {}
          try { sourceRef.current.disconnect(); } catch {}
          sourceRef.current = null;
        }
        audioBufRef.current = null;
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        setPracticePlaying(false);
        setPracticeTime(0);
        setCurrentTemplate(tpl);
        setExtractedNotes(tpl.notes || []);
        setExtractedDuration(tpl.durationSec || 0);
        setTempo(tpl.tempo || 100);
        setStatusMsg(`Loaded "${tpl.title}" — ${tpl.notes?.length || 0} notes`);
      } catch (e) {
        console.error('[VocalTrainer] template load failed:', e);
      }
    })();
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
      const { rawNotes, durationSec } = await extractNotesFromAudio(uploadFile, {
        onProgress: setExtractProgress,
        midiMin: PITCH_MIN,
        midiMax: PITCH_MAX,
      });
      // Greedy melody-line filter
      const melody = extractMelodyLine(rawNotes, 0.05);
      setExtractedNotes(melody);
      setExtractedDuration(durationSec);
      setStatusMsg(`Extracted ${rawNotes.length} notes → ${melody.length} after melody filter. Edit obvious garbage, then Save.`);
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
  // Practice mode — dichotic L/R + visual cursor
  // ───────────────────────────────────────────────────────────────────────
  const ensureAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        latencyHint: MIC_PROFILES[micProfile].latencyHint,
      });
    }
    return audioCtxRef.current!;
  }, [micProfile]);

  const stopPractice = useCallback(() => {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch {}
      try { sourceRef.current.disconnect(); } catch {}
      sourceRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setPracticePlaying(false);
  }, []);

  const startPractice = useCallback(async () => {
    const audioUrl = currentTemplate?.audioUrl;
    if (!audioUrl) {
      setStatusMsg('Practice needs a saved template with audio. Save first or pick from library.');
      return;
    }
    const ctx = ensureAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();

    // Lazy decode
    if (!audioBufRef.current) {
      try {
        const r = await fetch(audioUrl);
        const ab = await r.arrayBuffer();
        audioBufRef.current = await ctx.decodeAudioData(ab);
      } catch (e) {
        setStatusMsg(`Could not load practice audio: ${e instanceof Error ? e.message : e}`);
        return;
      }
    }

    const src = ctx.createBufferSource();
    src.buffer = audioBufRef.current;
    const pan = ctx.createStereoPanner();
    pan.pan.value = -1; // hard-left
    src.connect(pan).connect(ctx.destination);
    src.start();
    sourceRef.current = src;
    startedAtRef.current = ctx.currentTime;
    setPracticePlaying(true);

    const tick = () => {
      const elapsed = ctx.currentTime - startedAtRef.current;
      setPracticeTime(elapsed);
      if (elapsed >= (audioBufRef.current?.duration || 0)) {
        stopPractice();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    src.onended = () => stopPractice();
  }, [currentTemplate, ensureAudioContext, stopPractice]);

  // Mic monitor (right channel)
  const toggleMicMonitor = useCallback(async () => {
    if (micEnabled) {
      // Stop
      if (micNodesRef.current) {
        try { micNodesRef.current.src.disconnect(); } catch {}
        try { micNodesRef.current.gain.disconnect(); } catch {}
        try { micNodesRef.current.pan.disconnect(); } catch {}
        micNodesRef.current = null;
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
        micStreamRef.current = null;
      }
      setMicEnabled(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      micStreamRef.current = stream;
      const ctx = ensureAudioContext();
      if (ctx.state === 'suspended') await ctx.resume();
      const src = ctx.createMediaStreamSource(stream);
      const gain = ctx.createGain();
      gain.gain.value = MIC_PROFILES[micProfile].gain;
      const pan = ctx.createStereoPanner();
      pan.pan.value = 1; // hard-right
      src.connect(gain).connect(pan).connect(ctx.destination);
      micNodesRef.current = { src, gain, pan };
      setMicEnabled(true);
    } catch (e) {
      setStatusMsg(`Mic access failed: ${e instanceof Error ? e.message : e}`);
    }
  }, [micEnabled, micProfile, ensureAudioContext]);

  // Update mic gain when profile changes
  useEffect(() => {
    if (micNodesRef.current) {
      micNodesRef.current.gain.gain.value = MIC_PROFILES[micProfile].gain;
    }
  }, [micProfile]);

  // Cleanup on unmount
  useEffect(() => () => {
    stopPractice();
    if (micStreamRef.current) micStreamRef.current.getTracks().forEach(t => t.stop());
    if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch {} }
  }, [stopPractice]);

  // ───────────────────────────────────────────────────────────────────────
  // Editor: click-to-delete a note
  // ───────────────────────────────────────────────────────────────────────
  const deleteNote = useCallback((idx: number) => {
    setExtractedNotes(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const editorWidth = useMemo(() => Math.max(800, extractedDuration * zoom), [extractedDuration, zoom]);
  const editorRowHeight = 6; // px per semitone
  const editorHeight = (PITCH_MAX - PITCH_MIN + 1) * editorRowHeight;

  // ───────────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#08080f] text-gray-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-amber-300">Vocal Trainer</h1>
            <p className="text-sm text-gray-400 mt-1">
              Upload a reference recording → extract melody → practice with dichotic L/R audio → auto-publish to Synthesia.
            </p>
          </div>
          <a href="/pitch-defender" className="text-sm text-amber-400 hover:text-amber-300">← Back to Pitch Defender</a>
        </header>

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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {library.map(item => (
                <button
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`text-left p-3 rounded border transition ${
                    selectedId === item.id
                      ? 'border-amber-400 bg-amber-500/10'
                      : 'border-gray-700 bg-gray-800/40 hover:bg-gray-800'
                  }`}
                >
                  <div className="font-medium text-amber-200 truncate">★ {item.title}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {item.noteCount} notes · {item.createdAt?.slice(0, 10) || ''}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ─── Upload + extraction ───────────────────────────────────── */}
        <section className="bg-gray-900/60 border border-amber-500/20 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-amber-300 mb-3">Upload + Extract</h2>
          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-gray-700 rounded-lg p-6 text-center hover:border-amber-500/40 transition"
          >
            {uploadFile ? (
              <div>
                <div className="text-amber-200 font-medium">{uploadFile.name}</div>
                <div className="text-xs text-gray-500 mt-1">{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</div>
              </div>
            ) : (
              <div className="text-gray-500 text-sm">
                Drag-drop an audio file here<br/>
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
            <div className="overflow-auto bg-black/50 rounded border border-gray-800" style={{ maxHeight: '400px' }}>
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
                  return (
                    <rect key={idx}
                      x={x} y={y} width={w} height={editorRowHeight - 1}
                      fill={`hsl(${(n.pitchMidi * 7) % 360}, 70%, 55%)`}
                      opacity={0.5 + Math.min(0.5, n.amplitude * 0.7)}
                      onClick={() => deleteNote(idx)}
                      style={{ cursor: 'pointer' }}
                    >
                      <title>{midiToName(n.pitchMidi)} · t={n.startTimeSeconds.toFixed(2)}s · click to delete</title>
                    </rect>
                  );
                })}
                {/* Playhead cursor in practice mode */}
                {practicePlaying && (
                  <line x1={practiceTime * zoom} y1={0} x2={practiceTime * zoom} y2={editorHeight}
                    stroke="#ff5577" strokeWidth={2} />
                )}
              </svg>
            </div>
          </section>
        )}

        {/* ─── Practice mode ─────────────────────────────────────────── */}
        <section className="bg-gray-900/60 border border-amber-500/20 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-amber-300 mb-3">Practice (Dichotic L/R)</h2>
          <p className="text-xs text-gray-500 mb-3">
            Reference audio plays on the LEFT channel (hard-pan). Your mic monitors on the RIGHT channel.
            Headphones strongly recommended. The dichotic split lets your brain compare the two streams without interference.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
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
            <div className="flex items-end">
              <button
                onClick={practicePlaying ? stopPractice : startPractice}
                disabled={!currentTemplate?.audioUrl}
                className="w-full px-3 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 rounded text-sm font-semibold"
              >
                {practicePlaying ? 'Stop practice' : 'Play reference (left ear)'}
              </button>
            </div>
          </div>
          {currentTemplate && (
            <div className="text-xs text-gray-500">
              Current: <span className="text-amber-300">{currentTemplate.title}</span>
              {practicePlaying && (
                <span className="ml-3">t = {practiceTime.toFixed(2)}s</span>
              )}
            </div>
          )}
          {!currentTemplate && (
            <div className="text-xs text-gray-500">Pick a template from the library to enable practice playback.</div>
          )}
        </section>
      </div>
    </div>
  );
}
