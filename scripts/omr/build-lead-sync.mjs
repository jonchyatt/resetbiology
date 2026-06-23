// ════════════════════════════════════════════════════════════════════════════
// build-lead-sync.mjs — primitive `score-audio-align` v3 (VT3 Phase 2).
//
// v1 DTW'd the clean score onto the RAW 217-note extraction (noisy) → wrong times.
// v2 re-anchored the score rhythm onto the audio's [first,last] RAW onset span →
//    but the audio's first onset (0.57s) is the INTRO (Harold "…he loves pitch
//    pipe" + pitch-pipe), NOT the quartet's "Li-da Rose" entry (~5s). So v2 pulled
//    the whole bar ~5.5s early — the "way off" Jon caught (2026-06-21).
//
// v3 — the unlock is Jon's "No Lead" stem:
//   clean Lead = LeadDominant − NoLead   (the other 3 voices are in BOTH and cancel)
//   The NoLead's first onset (~4.9s) marks where the quartet enters → the intro
//   is automatically excluded from the anchors.
//   1) isolate the Lead onsets (LD − NL, range-gated, de-segmented).
//   2) subsequence pitch-DTW: align the engraved pitches to the isolated onsets
//      (free start/end skips the intro/outro; octave-folded cost tolerates extraction
//      octave errors; audio onsets may be skipped for over-segmentation).
//   3) ANCHOR each confident 1:1 match to its recording time; between anchors,
//      interpolate by the engraving's own rel-rhythm (follows rubato at anchors,
//      preserves musical spacing in gaps). No global constant-tempo assumption.
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
const BLOB = 'https://vv03sd8jufykivax.public.blob.vercel-storage.com/vocal-trainer';
const LD_URL = `${BLOB}/1781240825294-lead-lida-rose-lead-dominant/template.json`;
const NL_URL = `${BLOB}/1781240827136-lead-lida-rose-no-lead/template.json`;
const STAGE = 'C:/Users/jonch/Projects/jarvis/data/vocal-trainer/runtime-logs';

const NM = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const nm = (m) => NM[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
const pcDist = (a, b) => { const f = ((a - b) % 12 + 12) % 12; return Math.min(f, 12 - f); }; // octave-folded semitone dist

async function load(url, stageName) {
  const p = `${STAGE}/${stageName}`;
  try { const j = await (await fetch(url)).json(); fs.writeFileSync(p, JSON.stringify(j)); return j; }
  catch (e) { console.log(`  (fetch fail ${stageName}: ${e.message} — staged copy)`); return JSON.parse(fs.readFileSync(p, 'utf8')); }
}

// ── score: clean Lead notes with their relative score rhythm ──
const ts = fs.readFileSync(path.join(RBW, 'src', 'components', 'PitchDefender', 'omrTargets.ts'), 'utf8');
const leadTargetBlock = ts.match(/part: 'Lead',[\s\S]*?notes: \[([\s\S]*?)\n    \]/);
if (!leadTargetBlock) throw new Error('missing Lead target in omrTargets.ts');
const score = [...leadTargetBlock[1].matchAll(/pitchMidi:\s*(\d+),\s*startTimeSeconds:\s*([\d.]+),\s*durationSeconds:\s*([\d.]+)/g)]
  .map((m) => ({ midi: +m[1], rel: +m[2], dur: +m[3] }));
const EXPECTED_SCORE_NOTES = score.length;
const sMin = Math.min(...score.map((n) => n.midi)), sMax = Math.max(...score.map((n) => n.midi));

// ── isolate the Lead: LeadDominant − NoLead ──
const ldJ = await load(LD_URL, 'ld-lida-lead-dominant.json');
const nlJ = await load(NL_URL, 'nl-lida-no-lead.json');
const durationSec = ldJ.durationSec || 83.242;
const LD = ldJ.notes.map((n) => ({ m: n.pitchMidi, t: n.startTimeSeconds, d: n.durationSeconds })).sort((a, b) => a.t - b.t);
const NL = nlJ.notes.map((n) => ({ m: n.pitchMidi, t: n.startTimeSeconds, d: n.durationSeconds })).sort((a, b) => a.t - b.t);
const TWIN = 0.35;
const inNL = (n) => NL.some((x) => Math.abs(x.t - n.t) <= TWIN && pcDist(x.m, n.m) <= 1);
let A = LD.filter((n) => !inNL(n)).filter((n) => n.m >= sMin - 1 && n.m <= sMax + 1).sort((a, b) => a.t - b.t);
// de-segment: drop a same-pitch onset that re-fires within 0.12s
A = A.filter((n, i) => !(i && A[i - 1].m === n.m && n.t - A[i - 1].t < 0.12));

// ── subsequence pitch-DTW: align score[i] → audio A[j] ──
const N = score.length, M = A.length, INF = 1e9;
const SKIP = 0.7;   // cost to skip an audio onset (over-segmentation / intro junk)
const DUP = 1.1;    // penalty for two score notes sharing one onset (under-segmentation)
const D = Array.from({ length: N + 1 }, () => new Float64Array(M + 1).fill(INF));
const P = Array.from({ length: N + 1 }, () => new Int8Array(M + 1)); // 1=diag 2=skipAudio 3=dup
for (let j = 0; j <= M; j++) D[0][j] = 0; // free start anywhere in the audio
for (let i = 1; i <= N; i++) {
  for (let j = 1; j <= M; j++) {
    const c = pcDist(score[i - 1].midi, A[j - 1].m);
    const diag = D[i - 1][j - 1] + c;       // match
    const skip = D[i][j - 1] + SKIP;        // skip audio j
    const dup = D[i - 1][j] + c + DUP;      // score i shares audio j
    let best = diag, mv = 1;
    if (skip < best) { best = skip; mv = 2; }
    if (dup < best) { best = dup; mv = 3; }
    D[i][j] = best; P[i][j] = mv;
  }
}
// free end: pick j* minimizing D[N][j]
let jStar = 1; for (let j = 1; j <= M; j++) if (D[N][j] < D[N][jStar]) jStar = j;
// backtrack → match[i] = audio index (0-based) or -1
const match = new Array(N).fill(-1);
let i = N, j = jStar;
while (i > 0 && j > 0) {
  const mv = P[i][j];
  if (mv === 2) { j--; continue; }          // audio skipped
  match[i - 1] = j - 1;                       // diag or dup → score i-1 ↔ audio j-1
  if (mv === 1) { i--; j--; } else { i--; }   // dup keeps j
}

// ── anchors: confident 1:1 matches (pitch agrees, not a shared-onset run) ──
const matchCount = {};
for (const mi of match) if (mi >= 0) matchCount[mi] = (matchCount[mi] || 0) + 1;
const anchors = [];
for (let k = 0; k < N; k++) {
  const mi = match[k];
  if (mi < 0) continue;
  if (matchCount[mi] > 1) continue;                 // shared onset → not a clean anchor
  if (pcDist(score[k].midi, A[mi].m) > 1) continue; // pitch must agree
  const t = A[mi].t;
  if (anchors.length && t <= anchors[anchors.length - 1].t) continue; // keep monotonic
  anchors.push({ k, t });
}

// ── place every score note: anchor time, else interpolate by rel-rhythm ──
function placeByRel(k, a, b) {
  const span = (b.t - a.t), rspan = (score[b.k].rel - score[a.k].rel) || 1;
  return a.t + ((score[k].rel - score[a.k].rel) / rspan) * span;
}
const times = new Array(N);
for (let k = 0; k < N; k++) {
  // find surrounding anchors
  let lo = -1, hi = -1;
  for (let a = 0; a < anchors.length; a++) { if (anchors[a].k <= k) lo = a; if (anchors[a].k >= k && hi < 0) hi = a; }
  if (lo >= 0 && anchors[lo].k === k) { times[k] = anchors[lo].t; continue; }
  if (lo >= 0 && hi >= 0 && lo !== hi) { times[k] = placeByRel(k, anchors[lo], anchors[hi]); continue; }
  if (lo >= 0 && hi < 0) { // after last anchor — extrapolate at local rate
    const a = anchors[lo], a0 = anchors[Math.max(0, lo - 1)];
    const rate = (a.t - a0.t) / ((score[a.k].rel - score[a0.k].rel) || 1);
    times[k] = a.t + (score[k].rel - score[a.k].rel) * (rate || 1); continue;
  }
  if (lo < 0 && hi >= 0) { // before first anchor — back-extrapolate
    const a = anchors[hi], a1 = anchors[Math.min(anchors.length - 1, hi + 1)];
    const rate = (a1.t - a.t) / ((score[a1.k].rel - score[a.k].rel) || 1);
    times[k] = a.t - (score[a.k].rel - score[k].rel) * (rate || 1); continue;
  }
  times[k] = score[k].rel; // no anchors at all (shouldn't happen)
}
// monotonic safety + clamp
let last = -1;
for (let k = 0; k < N; k++) { let t = Math.max(0, times[k]); if (t <= last) t = last + 0.02; times[k] = t; last = t; }

// ── durations: up to next onset, clamped ──
const sync = score.map((s, k) => ({ pitchMidi: s.midi, startTimeSeconds: +times[k].toFixed(3) }));
for (let k = 0; k < N; k++) {
  const next = k < N - 1 ? sync[k + 1].startTimeSeconds : Math.min(durationSec, sync[k].startTimeSeconds + score[k].dur);
  sync[k].durationSeconds = +Math.max(0.08, next - sync[k].startTimeSeconds).toFixed(3);
}

// ── verify ──
const monotonic = sync.every((s, k) => k === 0 || s.startTimeSeconds >= sync[k - 1].startTimeSeconds);
const errors = [];
if (sync.length !== EXPECTED_SCORE_NOTES) errors.push(`expected ${EXPECTED_SCORE_NOTES}, got ${sync.length}`);
if (!monotonic) errors.push('not monotonic');
if (sync[N - 1].startTimeSeconds > durationSec + 0.5) errors.push('last exceeds recording');

const payload = {
  song: 'Lida Rose', part: 'Lead',
  source: 'v3 isolated-Lead (LeadDominant − NoLead) subsequence-DTW anchors + rel-rhythm interpolation',
  durationSec, noteCount: sync.length, notes: sync,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(payload, null, 1));

console.log(`score ${N} (${nm(sMin)}-${nm(sMax)}) | isolated-Lead onsets ${M} (intro excluded via NoLead) | anchors ${anchors.length}`);
console.log(`★ note0 → ${sync[0].startTimeSeconds}s  (was 0.708s in v2; quartet entry ≈ NoLead start ${NL[0].t.toFixed(2)}s)`);
console.log(`span ${sync[0].startTimeSeconds}s → ${sync[N - 1].startTimeSeconds}s | monotonic ${monotonic}`);
console.log('first 16 notes:', sync.slice(0, 16).map((s) => `${s.startTimeSeconds}${nm(s.pitchMidi)}`).join(' '));
if (errors.length) { console.error('VERIFY FAILED:\n  ' + errors.join('\n  ')); process.exit(1); }
console.log('OK -> wrote public/musicxml/lida-rose-lead-sync.json');
