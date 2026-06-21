// ════════════════════════════════════════════════════════════════════════════
// build-lead-sync.mjs — primitive `score-audio-align` (Code Blue, VT3 Phase 2).
//
// Maps the 113 engraved Lead score notes onto the REAL recording timeline by
// DTW-aligning the score pitch sequence to the 217-note audio extraction's onsets
// ("Lead - Lida Rose - Lead Dominant"). The recordings are real rubato
// performances, so the highlight must follow the recording clock — not score beats
// or a metronome (FLW hard rule). DTW is rubato-robust because it aligns by
// SEQUENCE, not absolute time.
//
// Output: public/musicxml/lida-rose-lead-sync.json — per-score-note recording
// { pitchMidi, startTimeSeconds, durationSeconds }. Consumed by `sing-out-highlight`.
//
// Verifies ARTIFACTS not claims (FLW): 113 notes, monotonic, spans the recording,
// pitch agreement (mean |delta| semitones) — exits non-zero if the align is suspect.
//
// Run:  node scripts/omr/build-lead-sync.mjs
// ════════════════════════════════════════════════════════════════════════════
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RBW = path.join(__dirname, '..', '..');
const OUT = path.join(RBW, 'public', 'musicxml', 'lida-rose-lead-sync.json');
const AUDIO_URL = 'https://vv03sd8jufykivax.public.blob.vercel-storage.com/vocal-trainer/1781240825294-lead-lida-rose-lead-dominant/template.json';
const STAGED = 'C:/Users/jonch/Projects/jarvis/data/vocal-trainer/runtime-logs/lead-audio-template.json';

// ── score pitch sequence (113 Lead notes) from omrTargets.ts ──
const ts = fs.readFileSync(path.join(RBW, 'src', 'components', 'PitchDefender', 'omrTargets.ts'), 'utf8');
const score = [...ts.matchAll(/pitchMidi:\s*(\d+),\s*startTimeSeconds:\s*([\d.]+),\s*durationSeconds:\s*([\d.]+)/g)]
  .map((m) => ({ midi: +m[1], approx: +m[2], dur: +m[3] }));

// ── audio onsets (217 notes, real recording timestamps) ──
let audioJson;
try {
  audioJson = await (await fetch(AUDIO_URL)).json();
} catch (e) {
  console.log('fetch failed, using staged copy:', e.message);
  audioJson = JSON.parse(fs.readFileSync(STAGED, 'utf8'));
}
const audio = audioJson.notes
  .map((a) => ({ midi: a.pitchMidi, t: a.startTimeSeconds, dur: a.durationSeconds }))
  .sort((a, b) => a.t - b.t);
const durationSec = audioJson.durationSec || 83.242;

const S = score.map((n) => n.midi);
const A = audio.map((n) => n.midi);
const n = S.length, m = A.length, INF = 1e9;

// ── DTW: each score note -> a strictly-increasing audio index. Audio over-segments
//    (217 vs 113), so the path skips extra/counter-melody onsets between matches.
//    D[i][j] = |S[i]-A[j]| + min(D[i-1][0..j-1]); prefix-min keeps it O(n*m). ──
const D = Array.from({ length: n }, () => new Float64Array(m).fill(INF));
const par = Array.from({ length: n }, () => new Int32Array(m).fill(-1));
for (let j = 0; j < m; j++) D[0][j] = Math.abs(S[0] - A[j]); // score[0] may start at any audio onset
for (let i = 1; i < n; i++) {
  let pm = INF, pmIdx = -1; // running min of D[i-1][0..j-1]
  for (let j = 0; j < m; j++) {
    D[i][j] = Math.abs(S[i] - A[j]) + pm;
    par[i][j] = pmIdx;
    if (D[i - 1][j] < pm) { pm = D[i - 1][j]; pmIdx = j; }
  }
}
let jEnd = 0;
for (let j = 1; j < m; j++) if (D[n - 1][j] < D[n - 1][jEnd]) jEnd = j;
const map = new Array(n);
{ let j = jEnd; for (let i = n - 1; i >= 0; i--) { map[i] = j; j = par[i][j]; } }

// ── build sync notes (recording timestamps) ──
const sync = score.map((s, i) => {
  const a = audio[map[i]];
  return { pitchMidi: s.midi, startTimeSeconds: +a.t.toFixed(3), _audioMidi: a.midi, _delta: Math.abs(a.midi - s.midi) };
});
for (let i = 1; i < n; i++) { // monotonic guard
  if (sync[i].startTimeSeconds <= sync[i - 1].startTimeSeconds) sync[i].startTimeSeconds = +(sync[i - 1].startTimeSeconds + 0.02).toFixed(3);
}
for (let i = 0; i < n; i++) { // duration = gap to next note (last = its own score duration)
  const next = i < n - 1 ? sync[i + 1].startTimeSeconds : Math.min(durationSec, sync[i].startTimeSeconds + score[i].dur);
  sync[i].durationSeconds = +Math.max(0.08, next - sync[i].startTimeSeconds).toFixed(3);
}

// ── verify ──
const monotonic = sync.every((s, i) => i === 0 || s.startTimeSeconds >= sync[i - 1].startTimeSeconds);
const meanDelta = sync.reduce((c, s) => c + s._delta, 0) / n;
const exact = sync.filter((s) => s._delta === 0).length;
const within1 = sync.filter((s) => s._delta <= 1).length;
const usedAudio = new Set(map).size;
const errors = [];
if (sync.length !== 113) errors.push(`expected 113 notes, got ${sync.length}`);
if (!monotonic) errors.push('NOT monotonic');
if (sync[n - 1].startTimeSeconds > durationSec + 0.5) errors.push(`last start ${sync[n - 1].startTimeSeconds} exceeds recording ${durationSec}`);
if (meanDelta > 1.5) errors.push(`mean |delta| ${meanDelta.toFixed(2)} too high — alignment suspect`);

const payload = {
  song: 'Lida Rose', part: 'Lead',
  source: 'DTW recording-clock align (score 113 vs audio 217 onsets)',
  durationSec, noteCount: sync.length,
  notes: sync.map(({ _audioMidi, _delta, ...keep }) => keep),
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(payload, null, 1));

console.log(`score ${n} notes | audio ${m} onsets | used ${usedAudio} distinct onsets`);
console.log(`span ${sync[0].startTimeSeconds}s -> ${sync[n - 1].startTimeSeconds}s (recording ${durationSec.toFixed(1)}s)`);
console.log(`pitch agreement: exact ${exact}/${n} | within 1 semitone ${within1}/${n} | mean |delta| ${meanDelta.toFixed(2)}`);
console.log(`monotonic ${monotonic}`);
if (errors.length) { console.error('VERIFY FAILED:\n  ' + errors.join('\n  ')); process.exit(1); }
console.log('OK VERIFY PASS -> wrote public/musicxml/lida-rose-lead-sync.json');
