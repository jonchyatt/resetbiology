// ════════════════════════════════════════════════════════════════════════════
// reconcile.mjs — BALANCE THE BOOKS (Jon directive 2026-06-22): the extracted
// audio (BasicPitch) is messy and misses obvious sung notes; the ENGRAVING is the
// clean truth. Reconcile the two:
//   · ENGRAVING note with audio support   -> "audio-confirmed"
//   · ENGRAVING note the audio MISSED      -> "engraving-recovered" (it IS sung; fill it)
//   · AUDIO note with no engraving match    -> "noise" (artifact / other-voice bleed; drop)
// Output: a CLEAN reconciled note-set (every engraving note present, timed to the
// recording) with provenance, + a report quantifying the mess and the recovery.
// Run from reset-biology-website:  node scripts/omr/reconcile.mjs
// ════════════════════════════════════════════════════════════════════════════
import fs from 'fs';
const RBW = 'C:/Users/jonch/reset-biology-website';
const STAGE = 'C:/Users/jonch/Projects/jarvis/data/vocal-trainer/runtime-logs';
const NM = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const nm = (m) => NM[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
const pc = (a, b) => { const f = ((a - b) % 12 + 12) % 12; return Math.min(f, 12 - f); };

// engraving notes already aligned to the recording (v3 sync = the reconciled timing spine)
const sync = JSON.parse(fs.readFileSync(`${RBW}/public/musicxml/lida-rose-lead-sync.json`, 'utf8')).notes;
// the raw extracted audio = what the piano-roll shows + Jon hears (Lead-Dominant)
const ld = JSON.parse(fs.readFileSync(`${STAGE}/ld-lida-lead-dominant.json`, 'utf8')).notes
  .map((n) => ({ m: n.pitchMidi, t: n.startTimeSeconds, d: n.durationSeconds })).sort((a, b) => a.t - b.t);
const sMin = Math.min(...sync.map((s) => s.pitchMidi)), sMax = Math.max(...sync.map((s) => s.pitchMidi));

const W = 0.30; // s tolerance
// 1) each ENGRAVING note: confirmed by audio, or recovered (audio missed it)?
const recovered = [];
let confirmed = 0;
const reconciled = sync.map((s) => {
  const sup = ld.some((a) => a.t <= s.startTimeSeconds + W && a.t + a.d >= s.startTimeSeconds - W && pc(a.m, s.pitchMidi) <= 1);
  if (sup) confirmed++; else recovered.push(s);
  return { pitchMidi: s.pitchMidi, startTimeSeconds: s.startTimeSeconds, durationSeconds: s.durationSeconds, src: sup ? 'audio-confirmed' : 'engraving-recovered' };
});
// 2) each AUDIO note: matched to engraving, or noise?
let noise = 0, inRangeNoise = 0;
for (const a of ld) {
  const eng = sync.some((s) => Math.abs(s.startTimeSeconds - a.t) < W && pc(s.pitchMidi, a.m) <= 1);
  if (!eng) { noise++; if (a.m >= sMin - 1 && a.m <= sMax + 1) inRangeNoise++; }
}

console.log('═══ RECONCILIATION — engraving (truth) vs extracted audio ═══');
console.log(`ENGRAVING: ${sync.length} notes (${nm(sMin)}-${nm(sMax)})`);
console.log(`  audio-confirmed:        ${confirmed}/${sync.length} (${(100*confirmed/sync.length).toFixed(0)}%)`);
console.log(`  ENGRAVING-RECOVERED:    ${recovered.length}  ← audio MISSED these, engraving recovers them:`);
for (const r of recovered) console.log(`     ${String(r.startTimeSeconds).padStart(6)}s  ${nm(r.pitchMidi)}`);
console.log(`RAW AUDIO: ${ld.length} notes`);
console.log(`  matched the engraving:  ${ld.length - noise}`);
console.log(`  NOISE (no engraving):   ${noise} (${(100*noise/ld.length).toFixed(0)}% of the extraction is junk) — ${inRangeNoise} even inside the Lead range`);
console.log(`\n→ reconciled clean line = ${reconciled.length} notes, ALL present (${recovered.length} recovered from engraving, 0 noise).`);

fs.writeFileSync(`${RBW}/public/musicxml/lida-rose-lead-reconciled.json`, JSON.stringify({
  song: 'Lida Rose', part: 'Lead',
  method: 'engraving truth reconciled vs Lead-Dominant audio; engraving-recovered = audio missed it, noise dropped',
  confirmed, recovered: recovered.length, audioNoiseDropped: noise,
  notes: reconciled,
}, null, 1));
console.log('wrote public/musicxml/lida-rose-lead-reconciled.json (clean line + per-note provenance)');
