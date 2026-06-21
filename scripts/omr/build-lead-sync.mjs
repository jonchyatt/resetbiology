// ════════════════════════════════════════════════════════════════════════════
// build-lead-sync.mjs — primitive `score-audio-align` v2 (VT3 Phase 2).
//
// v1 DTW-aligned the clean score to the RAW 217-note audio extraction — but that
// extraction is noisy (over-segmented + counter-melody/overtone bleed, e.g. notes
// an octave+ above the Lead range), so the per-note times were wrong and the
// sung-out bar landed off the note (caught by Jon, 2026-06-21).
//
// v2: the OMR/score is the clean authority. We (1) re-anchor the score's own
// rhythm onto the recording's sung span, then (2) CONSERVATIVELY snap each note to
// a nearby cleaned audio onset ONLY when the pitch clearly agrees (rubato
// correction where the audio is trustworthy) — otherwise we keep the score-rhythm
// time. Audio is cleaned first: gated to the Lead pitch range + min-duration.
//
// Output: public/musicxml/lida-rose-lead-sync.json (per-note recording timestamps).
// Run: node scripts/omr/build-lead-sync.mjs
// ════════════════════════════════════════════════════════════════════════════
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RBW = path.join(__dirname, '..', '..');
const OUT = path.join(RBW, 'public', 'musicxml', 'lida-rose-lead-sync.json');
const AUDIO_URL = 'https://vv03sd8jufykivax.public.blob.vercel-storage.com/vocal-trainer/1781240825294-lead-lida-rose-lead-dominant/template.json';
const STAGED = 'C:/Users/jonch/Projects/jarvis/data/vocal-trainer/runtime-logs/lead-audio-template.json';

const NM = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const nm = (m) => NM[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);

// ── score: 113 Lead notes (clean), with their relative score rhythm ──
const ts = fs.readFileSync(path.join(RBW, 'src', 'components', 'PitchDefender', 'omrTargets.ts'), 'utf8');
const score = [...ts.matchAll(/pitchMidi:\s*(\d+),\s*startTimeSeconds:\s*([\d.]+),\s*durationSeconds:\s*([\d.]+)/g)]
  .map((m) => ({ midi: +m[1], rel: +m[2], dur: +m[3] }));
const sMin = Math.min(...score.map((n) => n.midi));
const sMax = Math.max(...score.map((n) => n.midi));

// ── audio onsets, CLEANED (gate to the Lead range + drop blips) ──
let audioJson;
try { audioJson = await (await fetch(AUDIO_URL)).json(); }
catch (e) { console.log('fetch failed, staged copy:', e.message); audioJson = JSON.parse(fs.readFileSync(STAGED, 'utf8')); }
const durationSec = audioJson.durationSec || 83.242;
const audio = audioJson.notes
  .map((a) => ({ midi: a.pitchMidi, t: a.startTimeSeconds, d: a.durationSeconds }))
  .filter((a) => a.midi >= sMin - 2 && a.midi <= sMax + 2 && a.d >= 0.05) // gate range + min-dur
  .sort((a, b) => a.t - b.t);

// ── 1) re-anchor the score rhythm onto the recording's sung span ──
const r0 = score[0].rel, r1 = score[score.length - 1].rel;
const a0 = audio[0].t, a1 = audio[audio.length - 1].t;
const anchor = (rel) => a0 + ((rel - r0) / (r1 - r0)) * (a1 - a0);

// ── 2) conservative pitch-matched snap (only when the audio clearly agrees) ──
const SNAP_WINDOW = 0.55; // s — only snap to an onset this close to the anchored time
let snapped = 0;
let lastT = -1;
const sync = score.map((s) => {
  const approx = anchor(s.rel);
  // nearest cleaned onset with matching pitch (octave-folded tolerance) within the window
  let best = null, bestCost = Infinity;
  for (const a of audio) {
    const dt = Math.abs(a.t - approx);
    if (dt > SNAP_WINDOW) continue;
    const dp = Math.min(Math.abs(a.midi - s.midi), Math.abs((a.midi % 12) - (s.midi % 12)));
    if (dp > 1) continue; // require a real pitch match
    const cost = dp * 0.6 + dt; // prefer same-pitch + closest
    if (cost < bestCost) { bestCost = cost; best = a; }
  }
  let t = best ? best.t : approx;
  if (best) snapped++;
  if (t <= lastT) t = lastT + 0.02; // enforce monotonic
  lastT = t;
  return { pitchMidi: s.midi, startTimeSeconds: +t.toFixed(3) };
});
for (let i = 0; i < sync.length; i++) {
  const next = i < sync.length - 1 ? sync[i + 1].startTimeSeconds : Math.min(durationSec, sync[i].startTimeSeconds + score[i].dur);
  sync[i].durationSeconds = +Math.max(0.08, next - sync[i].startTimeSeconds).toFixed(3);
}

// ── verify ──
const monotonic = sync.every((s, i) => i === 0 || s.startTimeSeconds >= sync[i - 1].startTimeSeconds);
const errors = [];
if (sync.length !== 113) errors.push(`expected 113, got ${sync.length}`);
if (!monotonic) errors.push('not monotonic');
if (sync[sync.length - 1].startTimeSeconds > durationSec + 0.5) errors.push('last exceeds recording');

const payload = {
  song: 'Lida Rose', part: 'Lead',
  source: 'v2 score-rhythm anchored to recording sung-span + conservative pitch-matched audio snap',
  durationSec, noteCount: sync.length, notes: sync,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(payload, null, 1));

console.log(`score ${score.length} notes (${nm(sMin)}-${nm(sMax)}) | cleaned audio onsets ${audio.length}`);
console.log(`recording sung span ${a0.toFixed(2)}s -> ${a1.toFixed(2)}s`);
console.log(`snapped to a real onset: ${snapped}/${sync.length} (rest use anchored score rhythm)`);
console.log(`sync span ${sync[0].startTimeSeconds}s -> ${sync[sync.length - 1].startTimeSeconds}s | monotonic ${monotonic}`);
if (errors.length) { console.error('VERIFY FAILED:\n  ' + errors.join('\n  ')); process.exit(1); }
console.log('OK -> wrote public/musicxml/lida-rose-lead-sync.json');
