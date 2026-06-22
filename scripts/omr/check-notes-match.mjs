// check-notes-match.mjs — does each sung-out BAR note actually exist in the AUDIO
// (raw Lead-Dominant extraction = what Jon hears) at that moment? Direct measure of
// Jon's "notes look wrong vs the audio." No ears needed.
import fs from 'fs';
const RBW = 'C:/Users/jonch/reset-biology-website';
const STAGE = 'C:/Users/jonch/Projects/jarvis/data/vocal-trainer/runtime-logs';
const NM = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const nm = (m) => NM[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
const pc = (a, b) => { const f = ((a - b) % 12 + 12) % 12; return Math.min(f, 12 - f); };

const sync = JSON.parse(fs.readFileSync(`${RBW}/public/musicxml/lida-rose-lead-sync.json`, 'utf8')).notes;
const ld = JSON.parse(fs.readFileSync(`${STAGE}/ld-lida-lead-dominant.json`, 'utf8')).notes.map((n) => ({ m: n.pitchMidi, t: n.startTimeSeconds, d: n.durationSeconds }));

const W = 0.30; // seconds tolerance window
let exact = 0, octave = 0, miss = 0; const misses = [];
for (const s of sync) {
  const T = s.startTimeSeconds;
  const cands = ld.filter((n) => n.t <= T + W && n.t + n.d >= T - W);
  const exactHit = cands.some((n) => Math.abs(n.m - s.pitchMidi) <= 1);
  const octHit = cands.some((n) => pc(n.m, s.pitchMidi) <= 1);
  if (exactHit) exact++;
  else if (octHit) octave++;
  else { miss++; misses.push({ t: +T.toFixed(1), eng: nm(s.pitchMidi), near: cands.map((n) => nm(n.m)).slice(0, 4) }); }
}
console.log(`BAR notes vs RAW Lead-Dominant audio (±${W}s):`);
console.log(`  exact pitch present:      ${exact}/${sync.length} (${(100*exact/sync.length).toFixed(0)}%)`);
console.log(`  +octave-folded present:   ${exact + octave}/${sync.length} (${(100*(exact+octave)/sync.length).toFixed(0)}%)`);
console.log(`  NO matching audio note:   ${miss}/${sync.length} (${(100*miss/sync.length).toFixed(0)}%)`);
console.log('\nmismatches (bar note has NO matching audio pitch nearby):');
for (const m of misses.slice(0, 20)) console.log(`  ${String(m.t).padStart(5)}s  bar=${m.eng.padEnd(4)}  nearby audio: [${m.near.join(' ')}]`);
if (misses.length > 20) console.log(`  …and ${misses.length - 20} more`);
