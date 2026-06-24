// verify-plunk-from-score.mjs <songId>
// G4 GATE (core of Plumb's "B"): the plunk a singer matches MUST play FROM the
// verified MusicXML — its pitches equal the score note-for-note. This asserts the
// pitch dimension; timing (dead-on, score-derived) is the next layer once the sync
// is rebuilt off the score instead of audio anchors.
//
//   node scripts/omr/verify-plunk-from-score.mjs lida-rose
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const songId = process.argv[2] || 'lida-rose';
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NM = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const nameOf = (m) => (Number.isFinite(m) ? NM[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1) : '∅');

const contract = (await import(`./songs/${songId}.song.mjs`)).default;

// melodic pitch sequence off the verified score (same rules as the builds)
function scorePitches(musicxmlRel) {
  const xml = fs.readFileSync(path.join(ROOT, musicxmlRel), 'utf8');
  const inner = xml.slice(xml.indexOf('<part'), xml.lastIndexOf('</part>'));
  const out = [];
  for (const ch of inner.split(/<note[ >]/).slice(1)) {
    if (/<rest\b/.test(ch)) continue;
    if (/<chord\s*\/?>/.test(ch)) continue;
    const pm = ch.match(/<step>([A-G])<\/step>\s*(?:<alter>(-?\d+)<\/alter>\s*)?<octave>(\d+)<\/octave>/);
    if (!pm) continue;
    out.push((Number(pm[3]) + 1) * 12 + SEMI[pm[1]] + (pm[2] ? Number(pm[2]) : 0));
  }
  return out;
}

// pitch sequence the plunk actually schedules (the sync JSON VT III fetches)
function syncPitches(syncRel) {
  const full = path.join(ROOT, syncRel);
  if (!fs.existsSync(full)) return null;
  const j = JSON.parse(fs.readFileSync(full, 'utf8'));
  return (j.notes || []).filter((n) => n && Number.isFinite(n.pitchMidi)).map((n) => n.pitchMidi);
}

console.log(`\n=== PLUNK-FROM-SCORE GATE — ${contract.title} ===`);
let anyFail = false;
for (const part of contract.parts) {
  const score = scorePitches(part.musicxml);
  const base = part.musicxml.replace(/\.musicxml$/, '');
  for (const variant of ['-sync-v2.json', '-sync.json']) {
    const syncRel = base + variant;
    const sync = syncPitches(syncRel);
    if (sync === null) { console.log(`  [SKIP] ${part.name} ${variant}: not on disk`); continue; }
    const match = score.length === sync.length && score.every((p, i) => p === sync[i]);
    if (match) {
      console.log(`  [PASS] ${part.name} ${variant}: plunk == score note-for-note (${score.length} notes)`);
    } else {
      anyFail = true;
      const k = score.findIndex((p, i) => p !== sync[i]);
      console.log(`  [FAIL] ${part.name} ${variant}: score ${score.length} notes vs plunk ${sync.length}` +
        (k >= 0 ? `; first divergence @${k}: score ${nameOf(score[k])} vs plunk ${nameOf(sync[k])}` : ' (length differs only)'));
    }
  }
}
console.log(anyFail
  ? `\nPLUNK-FROM-SCORE: FAIL — the plunk does not yet equal the verified score.\n  → rebuild the sync FROM the corrected MusicXML (pure-notation timing), not from audio anchors.`
  : `\nPLUNK-FROM-SCORE: PASS — the plunk plays the verified score note-for-note.`);
process.exit(anyFail ? 1 : 0);
