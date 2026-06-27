// mono-track-notes.mjs — turn BasicPitch's polyphonic over-detection into a single clean
// monophonic vocal line via continuity tracking (prefer the pitch that CONTINUES the line +
// is loud; penalize octave jumps), median-smooth, octave-correct, segment to notes.
// Usage: node scripts/mono-track-notes.mjs <in-with-rawPoly.json> <out.json>
import fs from 'fs';
const [inP, outP] = process.argv.slice(2);
const doc = JSON.parse(fs.readFileSync(inP, 'utf8'));
const poly = (doc.rawPoly || doc.notes).slice().sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
const dur = doc.durationSec;
const HOP = 0.02; // 20ms frames
const nFrames = Math.ceil(dur / HOP);

// per-frame candidate pitches (midi, amp) from overlapping poly notes
const cands = Array.from({ length: nFrames }, () => []);
for (const n of poly) {
  const f0 = Math.floor(n.startTimeSeconds / HOP);
  const f1 = Math.min(nFrames - 1, Math.floor((n.startTimeSeconds + n.durationSeconds) / HOP));
  for (let f = Math.max(0, f0); f <= f1; f++) cands[f].push({ midi: n.pitchMidi, amp: n.amplitude ?? 0.5 });
}

// continuity track: per frame pick the candidate maximizing amp - λ*|Δ| with a big octave-jump penalty
const path = new Array(nFrames).fill(null);
let prev = null;
// seed prev with the loudest candidate in the first voiced frame
for (let f = 0; f < nFrames; f++) { if (cands[f].length) { prev = cands[f].reduce((a, b) => b.amp > a.amp ? b : a).midi; break; } }
for (let f = 0; f < nFrames; f++) {
  if (!cands[f].length) { path[f] = null; continue; }
  let best = null, bestScore = -1e9;
  for (const c of cands[f]) {
    const d = prev == null ? 0 : Math.abs(c.midi - prev);
    let score = c.amp - 0.06 * d;
    if (d >= 11 && d <= 13) score -= 1.5;   // octave jump = strong penalty
    if (d > 13) score -= 0.8;
    if (prev != null && c.midi === prev) score += 0.35; // HYSTERESIS: stick to the held pitch
    if (score > bestScore) { bestScore = score; best = c.midi; }
  }
  path[f] = best; prev = best;
}

// median filter (window 11 = 220ms) to kill the semitone oscillation on held notes
const med = path.slice();
const W = 5;
for (let f = 0; f < nFrames; f++) {
  if (path[f] == null) { med[f] = null; continue; }
  const win = [];
  for (let k = -W; k <= W; k++) { const v = path[f + k]; if (v != null) win.push(v); }
  win.sort((a, b) => a - b); med[f] = win[Math.floor(win.length / 2)];
}

// octave-correct toward a moving median center (baritone sits low)
const voiced = med.filter((v) => v != null).sort((a, b) => a - b);
const center = voiced.length ? voiced[Math.floor(voiced.length / 2)] : 50;
for (let f = 0; f < nFrames; f++) {
  if (med[f] == null) continue;
  while (med[f] - center > 8) med[f] -= 12;
  while (center - med[f] > 8) med[f] += 12;
}

// segment consecutive same-midi frames into notes
const notes = [];
let cur = null;
for (let f = 0; f < nFrames; f++) {
  const m = med[f];
  if (m == null) { if (cur) { notes.push(cur); cur = null; } continue; }
  if (cur && cur.pitchMidi === m && (f * HOP) - (cur.startTimeSeconds + cur.durationSeconds) <= 0.06) {
    cur.durationSeconds = (f + 1) * HOP - cur.startTimeSeconds;
  } else {
    if (cur) notes.push(cur);
    cur = { pitchMidi: m, startTimeSeconds: f * HOP, durationSeconds: HOP };
  }
}
if (cur) notes.push(cur);
// drop slivers <110ms, round
const clean = notes.filter((n) => n.durationSeconds >= 0.11)
  .map((n) => ({ pitchMidi: n.pitchMidi, startTimeSeconds: Number(n.startTimeSeconds.toFixed(4)), durationSeconds: Number(n.durationSeconds.toFixed(4)), amplitude: 0.6 }));

const NM = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const nm = (m) => NM[m % 12] + (Math.floor(m / 12) - 1);
fs.writeFileSync(outP, JSON.stringify({ ...doc, monoTracked: true, cleanCount: clean.length, rawPoly: undefined, notes: clean }, null, 2));
console.log(`poly ${poly.length} -> mono ${clean.length} notes (${(clean.length / dur).toFixed(2)}/s)`);
console.log('range:', nm(Math.min(...clean.map((n) => n.pitchMidi))), '..', nm(Math.max(...clean.map((n) => n.pitchMidi))), '| center', nm(center));
console.log('first 28:', clean.slice(0, 28).map((n) => nm(n.pitchMidi)).join(' '));
