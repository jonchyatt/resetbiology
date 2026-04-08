// ═══════════════════════════════════════════════════════════════════════════════
// extractNotesFromAudio — In-browser BasicPitch wrapper
// ═══════════════════════════════════════════════════════════════════════════════
//
// Decodes an audio file (m4a/mp3/wav/ogg) via Web Audio, runs Spotify's
// BasicPitch model, and returns notes in two shapes:
//   - raw notes (BasicPitch output: pitchMidi, startTimeSeconds, durationSeconds, amplitude)
//   - SongNote[] tuples ([semitoneFromC4, beats]) for the Synthesia keyboard
//
// Used by VocalTrainer.tsx. The model (~13MB) is fetched from CDN and cached.
// ═══════════════════════════════════════════════════════════════════════════════

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@spotify/basic-pitch@1.0.1/model/model.json';
const TARGET_SR = 22050;

export interface RawNote {
  pitchMidi: number;
  startTimeSeconds: number;
  durationSeconds: number;
  amplitude: number;
  pitchBends?: number[];
}

export interface ExtractionProgress {
  stage: 'decoding' | 'loading-model' | 'analyzing' | 'post-processing' | 'done';
  pct: number; // 0..1
  message: string;
}

export interface ExtractAudioOptions {
  onProgress?: (p: ExtractionProgress) => void;
  onsetThreshold?: number;     // default 0.5 (higher = fewer false onsets)
  frameThreshold?: number;     // default 0.3
  minNoteLengthFrames?: number; // default 11 (~125ms)
  midiMin?: number;            // default 48 (C3) — clamps to vocal range
  midiMax?: number;            // default 84 (C6)
}

let cachedModelPromise: Promise<any> | null = null;

async function loadModel(onProgress?: ExtractAudioOptions['onProgress']): Promise<any> {
  if (cachedModelPromise) return cachedModelPromise;
  cachedModelPromise = (async () => {
    onProgress?.({ stage: 'loading-model', pct: 0, message: 'Loading pitch model (~13MB, first time only)…' });
    const { BasicPitch } = await import('@spotify/basic-pitch');
    const bp = new BasicPitch(MODEL_URL);
    onProgress?.({ stage: 'loading-model', pct: 1, message: 'Pitch model ready' });
    return bp;
  })();
  return cachedModelPromise;
}

/**
 * Decode an audio File/Blob to mono Float32Array @ TARGET_SR (22050 Hz).
 */
async function decodeToMono22050(file: File | Blob): Promise<{ samples: Float32Array; durationSec: number }> {
  // Use OfflineAudioContext for sample-rate conversion
  const arrayBuf = await file.arrayBuffer();
  // First decode at native rate via a temp AudioContext
  const tmpCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  let decoded: AudioBuffer;
  try {
    decoded = await tmpCtx.decodeAudioData(arrayBuf.slice(0));
  } finally {
    try { tmpCtx.close(); } catch {}
  }

  // Resample to 22050 mono via OfflineAudioContext
  const targetLength = Math.ceil(decoded.duration * TARGET_SR);
  const offline = new OfflineAudioContext(1, targetLength, TARGET_SR);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start(0);
  const rendered = await offline.startRendering();
  const samples = rendered.getChannelData(0).slice(); // copy
  return { samples, durationSec: decoded.duration };
}

/**
 * Run BasicPitch over decoded samples and return raw notes.
 */
export async function extractNotesFromAudio(
  file: File | Blob,
  opts: ExtractAudioOptions = {}
): Promise<{ rawNotes: RawNote[]; durationSec: number }> {
  const onProgress = opts.onProgress;

  onProgress?.({ stage: 'decoding', pct: 0, message: 'Decoding audio…' });
  const { samples, durationSec } = await decodeToMono22050(file);
  onProgress?.({ stage: 'decoding', pct: 1, message: `Decoded ${durationSec.toFixed(1)}s` });

  const bp = await loadModel(onProgress);
  const { noteFramesToTime, outputToNotesPoly, addPitchBendsToNoteEvents } = await import('@spotify/basic-pitch');

  const frames: number[][] = [];
  const onsets: number[][] = [];
  const contours: number[][] = [];

  await bp.evaluateModel(
    samples,
    (f: number[][], o: number[][], c: number[][]) => {
      frames.push(...f);
      onsets.push(...o);
      contours.push(...c);
    },
    (p: number) => {
      onProgress?.({ stage: 'analyzing', pct: p, message: `Analyzing pitch… ${Math.round(p * 100)}%` });
    }
  );

  onProgress?.({ stage: 'post-processing', pct: 0, message: 'Extracting notes…' });
  const onsetTh = opts.onsetThreshold ?? 0.5;
  const frameTh = opts.frameThreshold ?? 0.3;
  const minLen = opts.minNoteLengthFrames ?? 11;

  let notes = outputToNotesPoly(frames, onsets, onsetTh, frameTh, minLen);
  notes = addPitchBendsToNoteEvents(contours, notes);
  let timed: RawNote[] = noteFramesToTime(notes);

  // Clamp to vocal range — drops piano LH/RH garbage and high overtones
  const midiMin = opts.midiMin ?? 48;
  const midiMax = opts.midiMax ?? 84;
  timed = timed.filter(n => n.pitchMidi >= midiMin && n.pitchMidi <= midiMax);

  // Sort by time so the editor + practice cursor work correctly
  timed.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);

  onProgress?.({ stage: 'done', pct: 1, message: `Extracted ${timed.length} notes` });
  return { rawNotes: timed, durationSec };
}

// ─── Conversion to SongNote format used by SynthesiaRunner ──────────────────

export type SongNote = [number, number]; // [semitoneFromC4, beats]
export const KEYBOARD_LOW = -12; // C3 from C4 = -12 semitones (24 in midi from C4=60? careful)
export const KEYBOARD_HIGH = 24; // C6

/**
 * Convert raw BasicPitch notes → SongNote tuples for Synthesia.
 *
 * The Synthesia keyboard uses semitones-from-C4 where C4 = 0.
 * BasicPitch reports MIDI numbers where C4 = 60.
 *
 * `tempo` (bpm) is used to convert seconds → beats. Default 100 bpm = 60s/100 = 0.6s/beat.
 */
export function rawNotesToSongNotes(
  rawNotes: RawNote[],
  tempo: number = 100,
  options: { clampToKeyboard?: boolean } = {}
): SongNote[] {
  const secPerBeat = 60 / tempo;
  const clamp = options.clampToKeyboard ?? true;

  return rawNotes.map(n => {
    let semi = n.pitchMidi - 60; // C4 = 60 → 0
    if (clamp) {
      while (semi < KEYBOARD_LOW) semi += 12;
      while (semi > KEYBOARD_HIGH) semi -= 12;
    }
    const beats = Math.max(0.25, n.durationSeconds / secPerBeat);
    return [semi, beats] as SongNote;
  });
}

/**
 * Greedy melody extraction: when multiple notes overlap (polyphony from piano accompaniment),
 * keep only the highest-pitched note in each time window. Vocal melodies are typically the
 * top voice. Adjust `windowSec` to taste.
 */
export function extractMelodyLine(rawNotes: RawNote[], windowSec: number = 0.05): RawNote[] {
  if (rawNotes.length === 0) return [];
  const sorted = [...rawNotes].sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
  const out: RawNote[] = [];
  let i = 0;
  while (i < sorted.length) {
    const t0 = sorted[i].startTimeSeconds;
    let best = sorted[i];
    let j = i + 1;
    while (j < sorted.length && sorted[j].startTimeSeconds - t0 < windowSec) {
      if (sorted[j].pitchMidi > best.pitchMidi || (sorted[j].pitchMidi === best.pitchMidi && sorted[j].amplitude > best.amplitude)) {
        best = sorted[j];
      }
      j++;
    }
    out.push(best);
    i = j;
  }
  return out;
}

/**
 * Write a vocal-trainer template into Synthesia's localStorage convention so it
 * automatically appears in the song picker prefixed with ★.
 */
export function publishToSynthesia(template: { id: string; title: string; songNotes: SongNote[] }): void {
  if (typeof window === 'undefined') return;
  const key = `pd_composed_vt_${template.id}`;
  const payload = {
    title: `♪ ${template.title}`,
    notes: template.songNotes.map(([semi, beats]) => ({ semitones: semi, beats })),
    source: 'vocal-trainer',
    publishedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(key, JSON.stringify(payload));
  } catch (e) {
    console.warn('[vocal-trainer] failed to publish to Synthesia:', e);
  }
}
