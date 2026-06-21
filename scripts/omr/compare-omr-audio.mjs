// ════════════════════════════════════════════════════════════════════════════
// compare-omr-audio.mjs — THE VERIFY HARNESS (Jon directive 2026-06-21):
//   "figure out a way to verify your engraving extraction against an audio extraction."
//
// Renders a piano-roll PNG overlaying three layers on one time×pitch grid so the
// engraving↔recording alignment is VISIBLE without audio playback (autoplay blocks
// automated playback — this is how Opus/Argus verify with their own eyes):
//   · gray  = raw LeadDominant onsets (context — shows the intro before ~5s)
//   · blue  = isolated Lead onsets  (LeadDominant − NoLead = the clean truth)
//   · amber = the SYNC notes that drive the yellow sung-out bar (what we're checking)
//   · green vertical = NoLead entry (quartet comes in) — the bar should start here-ish
// Plus a numeric drift report: mean |Δt| from each sync note to the nearest
// same-pitch isolated onset. No browser, no deps — a built-in PNG encoder.
//
// Run: node scripts/omr/compare-omr-audio.mjs
// ════════════════════════════════════════════════════════════════════════════
import fs from 'fs';
import zlib from 'zlib';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RBW = path.join(__dirname, '..', '..');
const STAGE = 'C:/Users/jonch/Projects/jarvis/data/vocal-trainer/runtime-logs';
const OUT_PNG = `${STAGE}/compare-lida-lead.png`;

const NM = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const nm = (m) => NM[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
const pcDist = (a, b) => { const f = ((a - b) % 12 + 12) % 12; return Math.min(f, 12 - f); };

// ── load layers ──
const sync = JSON.parse(fs.readFileSync(path.join(RBW, 'public', 'musicxml', 'lida-rose-lead-sync.json'), 'utf8'));
const SYNC = sync.notes;
const durationSec = sync.durationSec || 83.242;
const ldJ = JSON.parse(fs.readFileSync(`${STAGE}/ld-lida-lead-dominant.json`, 'utf8'));
const nlJ = JSON.parse(fs.readFileSync(`${STAGE}/nl-lida-no-lead.json`, 'utf8'));
const LD = ldJ.notes.map((n) => ({ m: n.pitchMidi, t: n.startTimeSeconds })).sort((a, b) => a.t - b.t);
const NL = nlJ.notes.map((n) => ({ m: n.pitchMidi, t: n.startTimeSeconds })).sort((a, b) => a.t - b.t);
const sMin = Math.min(...SYNC.map((s) => s.pitchMidi)), sMax = Math.max(...SYNC.map((s) => s.pitchMidi));
const inNL = (n) => NL.some((x) => Math.abs(x.t - n.t) <= 0.35 && pcDist(x.m, n.m) <= 1);
const ISO = LD.filter((n) => !inNL(n)).filter((n) => n.m >= sMin - 1 && n.m <= sMax + 1);
const NLfirst = NL[0].t;

// ── drift report: each sync note → nearest same-pitch isolated onset ──
let sumAbs = 0, matched = 0;
const drifts = SYNC.map((s) => {
  let best = Infinity;
  for (const a of ISO) { if (pcDist(a.m, s.pitchMidi) <= 1) { const dt = Math.abs(a.t - s.startTimeSeconds); if (dt < best) best = dt; } }
  if (best < Infinity) { sumAbs += best; matched++; }
  return best;
});
const within = (thr) => drifts.filter((d) => d < thr).length;
console.log('═══ VERIFY: sync vs isolated-Lead ═══');
console.log(`sync ${SYNC.length} | isolated onsets ${ISO.length} | raw LD ${LD.length}`);
console.log(`note0 ${SYNC[0].startTimeSeconds}s | NoLead entry ${NLfirst.toFixed(2)}s | span →${SYNC[SYNC.length - 1].startTimeSeconds}s`);
console.log(`mean |Δt| to nearest same-pitch onset: ${(sumAbs / matched).toFixed(3)}s  (matched ${matched}/${SYNC.length})`);
console.log(`within 0.15s: ${within(0.15)}  | 0.30s: ${within(0.30)}  | 0.50s: ${within(0.50)}`);

// ── render piano-roll PNG ──
const W = 1280, H = 440, PAD = 44;
const fb = Buffer.alloc(W * H * 3, 18);
const px = (x, y, r, g, b) => { x |= 0; y |= 0; if (x < 0 || x >= W || y < 0 || y >= H) return; const o = (y * W + x) * 3; fb[o] = r; fb[o + 1] = g; fb[o + 2] = b; };
const rect = (x, y, w, h, r, g, b) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) px(xx, yy, r, g, b); };
const T1 = durationSec, P0 = sMin - 3, P1 = sMax + 3;
const X = (t) => PAD + (t / T1) * (W - 2 * PAD);
const Y = (m) => (H - PAD) - ((m - P0) / (P1 - P0)) * (H - 2 * PAD);
// gridlines every 5s
for (let t = 0; t <= T1; t += 5) { const x = X(t); for (let y = PAD; y < H - PAD; y++) px(x, y, 34, 34, 40); }
// octave gridlines (C)
for (let m = P0; m <= P1; m++) if (m % 12 === 0) { const y = Y(m); for (let x = PAD; x < W - PAD; x++) px(x, y, 34, 34, 40); }
// layers
for (const n of LD) rect(X(n.t) - 1, Y(n.m) - 1, 3, 3, 75, 75, 80);                 // raw = gray
for (const n of ISO) rect(X(n.t) - 1, Y(n.m) - 2, 3, 5, 70, 140, 255);             // isolated = blue
for (const s of SYNC) { const x0 = X(s.startTimeSeconds), x1 = X(s.startTimeSeconds + s.durationSeconds); rect(x0, Y(s.pitchMidi) - 3, Math.max(2, x1 - x0), 5, 248, 190, 72); } // sync = amber
for (let y = PAD; y < H - PAD; y++) px(X(NLfirst), y, 70, 210, 100);               // NoLead entry = green

// PNG encode (built-in, no deps)
const CRCT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRCT[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const t = Buffer.from(type, 'ascii'); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, crc]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
const raw = Buffer.alloc(H * (1 + W * 3));
for (let y = 0; y < H; y++) { raw[y * (1 + W * 3)] = 0; fb.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3); }
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
fs.writeFileSync(OUT_PNG, png);
console.log(`\nlegend: gray=raw LeadDominant · blue=isolated Lead (truth) · amber=sync bar · green=NoLead entry`);
console.log(`wrote ${OUT_PNG} (${W}x${H})`);
