// ════════════════════════════════════════════════════════════════════════════
// build-lead-dataset.mjs — regenerate src/components/PitchDefender/omrTargets.ts
//
// Reads the Audiveris OMR MusicXML of "The Music Man" full score (Lida Rose
// pp.196-198, in ./source/) and emits the LEAD-voice (Ewart) note sequence as a
// discrete score-target lane for VocalTrainer III.
//
// Lead part per page (verified): the LOWER of the two treble-8 (G2_8) staves,
// melodic range Db3-E4.  196 -> P3,  197 -> P2,  198 -> P2.
//
// Octave: confirmed correct (no transpose) against the 217-note audio extraction
// "Lead - Lida Rose - Lead Dominant" — audio median B3 (MIDI 59) vs OMR Bb3 (58).
//
// Run:  node scripts/omr/build-lead-dataset.mjs
// ════════════════════════════════════════════════════════════════════════════
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeLeadMeasure } from './lida-lead-key-normalize.mjs';
import { applyLeadMeasureCorrections } from './lida-lead-source-corrections.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = (f) => path.join(__dirname, 'source', f);
const OUT = path.join(__dirname, '..', '..', 'src', 'components', 'PitchDefender', 'omrTargets.ts');

// The recording's length, used only to scale the score sequence to a comparable
// horizontal span. Phase 1 is NOT sample-synced, so an approximate span is fine.
const AUDIO_DURATION_SEC = 83.242;
const AUDIO_TEMPLATE_URL = 'https://vv03sd8jufykivax.public.blob.vercel-storage.com/vocal-trainer/1781240825294-lead-lida-rose-lead-dominant/template.json';

const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NM = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const nameOf = (m) => NM[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);

const PAGES = [
  { pg: '196', path: SRC('lida-196.xml'), lead: 'P3', div: 12 },
  { pg: '197', path: SRC('lida-197.xml'), lead: 'P2', div: 6 },
  { pg: '198', path: SRC('lida-198.xml'), lead: 'P2', div: 4 },
];

function getPart(xml, id) {
  for (const pb of xml.split(/<part id="/).slice(1)) if (pb.match(/^([^"]+)"/)[1] === id) return pb;
  return null;
}
function parseNotes(body) {
  const div = parseInt((body.match(/<divisions>(\d+)/) || [])[1] || '1');
  const out = [];
  for (const ch of body.split(/<note[ >]/).slice(1)) {
    const dur = parseInt((ch.match(/<duration>(\d+)/) || [])[1] || '0');
    const beats = dur / div;
    if (/<rest\b/.test(ch)) { out.push({ rest: true, beats }); continue; }
    if (/<chord\s*\/?>/.test(ch)) continue; // skip stacked harmony, keep the melodic line
    const pm = ch.match(/<step>([A-G])<\/step>\s*(?:<alter>(-?\d+)<\/alter>\s*)?<octave>(\d+)<\/octave>/);
    if (!pm) continue;
    const midi = (parseInt(pm[3]) + 1) * 12 + SEMI[pm[1]] + (pm[2] ? parseInt(pm[2]) : 0);
    out.push({ midi, beats });
  }
  return out;
}

let cumBeats = 0;
const omr = [];
for (const { path: p, lead, div } of PAGES) {
  const xml = fs.readFileSync(p, 'utf8');
  const page = path.basename(p).match(/lida-(\d+)\.xml$/)?.[1] || '';
  const measures = (getPart(xml, lead).match(/<measure\b[\s\S]*?<\/measure>/g) || []).map(normalizeLeadMeasure);
  const part = applyLeadMeasureCorrections(page, measures, { part: 'Lead', divisions: div }).join('\n');
  for (const n of parseNotes(part)) {
    if (!n.rest) omr.push({ midi: n.midi, startBeat: cumBeats, beats: n.beats });
    cumBeats += n.beats;
  }
}
const totalBeats = cumBeats;
const omrM = omr.map((n) => n.midi);
console.log('OMR Lead notes:', omr.length, '| totalBeats:', totalBeats.toFixed(1),
  '| range', nameOf(Math.min(...omrM)), '-', nameOf(Math.max(...omrM)));

// ── optional double-verify against the audio extraction (skipped if offline) ──
let audDur = AUDIO_DURATION_SEC;
try {
  const audio = await (await fetch(AUDIO_TEMPLATE_URL)).json();
  const aud = audio.notes.map((n) => n.pitchMidi);
  audDur = audio.durationSec || AUDIO_DURATION_SEC;
  const pc = (a) => { const h = new Array(12).fill(0); a.forEach((m) => h[((m % 12) + 12) % 12]++); return h.map((x) => x / a.length); };
  const cos = (a, b) => { let d = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; } return d / Math.sqrt(na * nb); };
  const collapse = (a) => a.filter((m, i) => i === 0 || m !== a[i - 1]);
  const dtw = (a, b) => { const n = a.length, m = b.length, D = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(Infinity)); D[0][0] = 0; for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) { const c = Math.abs(a[i - 1] - b[j - 1]); D[i][j] = c + Math.min(D[i - 1][j], D[i][j - 1], D[i - 1][j - 1]); } return D[n][m] / (n + m); };
  console.log('VERIFY vs audio: pitch-class cosine', cos(pc(omrM), pc(aud)).toFixed(3),
    '| collapsed-melody DTW mean |Δsemi|', dtw(collapse(omrM), collapse(aud)).toFixed(2));
} catch (e) {
  console.log('VERIFY skipped (offline?):', e.message);
}

// ── scale the score's rhythm to the recording span, emit RawNote-shaped data ──
const sec = (b) => (b / totalBeats) * audDur;
const dataset = omr.map((n) => ({
  pitchMidi: n.midi,
  startTimeSeconds: +sec(n.startBeat).toFixed(3),
  durationSeconds: Math.max(0.12, +((n.beats / totalBeats) * audDur).toFixed(3)),
}));

const notesStr = dataset.map((n) => `    { pitchMidi: ${n.pitchMidi}, startTimeSeconds: ${n.startTimeSeconds}, durationSeconds: ${n.durationSeconds} }`).join(',\n');
const ts = `// AUTO-GENERATED — do not hand-edit. Regenerate via scripts/omr/build-lead-dataset.mjs
// Optical Music Recognition (Audiveris 5.10.2) of "The Music Man" full score —
// Lida Rose pp.196-198, LEAD voice (Ewart). Octave-confirmed against the 217-note
// audio extraction "Lead - Lida Rose - Lead Dominant" (audio median B3 vs OMR Bb3 → no transpose).
// Phase 1: discrete sequence on the score's own rhythm, scaled to the recording's
// span for visual comparison. NOT sample-synced to playback (that is Phase 2).
export interface OmrTargetNote { pitchMidi: number; startTimeSeconds: number; durationSeconds: number }
export interface OmrTarget { song: string; part: string; sourcePages: string; noteCount: number; notes: OmrTargetNote[] }

export const OMR_TARGETS: OmrTarget[] = [
  {
    song: 'Lida Rose',
    part: 'Lead',
    sourcePages: 'pp.196-198 (Audiveris)',
    noteCount: ${dataset.length},
    notes: [
${notesStr},
    ],
  },
];

export function getOmrTarget(song: string, part: string): OmrTarget | null {
  return OMR_TARGETS.find((t) => t.song === song && t.part === part) || null;
}
`;
fs.writeFileSync(OUT, ts);
console.log('WROTE', path.relative(path.join(__dirname, '..', '..'), OUT), '—', dataset.length, 'notes, span 0–' + audDur.toFixed(1) + 's');
