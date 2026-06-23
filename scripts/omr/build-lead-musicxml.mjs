// ════════════════════════════════════════════════════════════════════════════
// build-lead-musicxml.mjs — stitch the Lida Rose LEAD part (pp.196-198) into ONE
// clean single-part MusicXML for OSMD engraving in VocalTrainer III "Score" mode.
//
// Reads the same Audiveris sources as build-lead-dataset.mjs, isolates the Lead
// voice on each page (196->P3, 197->P2, 198->P2), normalizes divisions to the LCM
// (12), renumbers measures consecutively, drops per-page <print> layout so OSMD
// reflows naturally, and wraps a single <part id="P1"> "Lead".
//
// Output: public/musicxml/lida-rose-lead.musicxml  (served to OSMD by URL)
//
// SELF-VERIFYING: re-reads its own output, extracts the melodic pitch sequence,
// and asserts it equals the 113-note ground truth in omrTargets.ts. Exits non-zero
// on any structural or pitch mismatch — OSMD renders bad MusicXML SILENTLY, so this
// gate is mandatory before the file is trusted.
//
// Octave/part-identity already triple-verified (see scripts/omr/README.md).
// Key-signature accuracy (196 reads fifths -2 then -6) is for the Argus correction
// pass (primitive 6) — this script preserves Audiveris output verbatim, no invention.
//
// Run:  node scripts/omr/build-lead-musicxml.mjs
// ════════════════════════════════════════════════════════════════════════════
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PRINTED_FIFTHS, normalizeLeadMeasure } from './lida-lead-key-normalize.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = (f) => path.join(__dirname, 'source', f);
const OUT = path.join(__dirname, '..', '..', 'public', 'musicxml', 'lida-rose-lead.musicxml');
const OMR_TS = path.join(__dirname, '..', '..', 'src', 'components', 'PitchDefender', 'omrTargets.ts');

const LCM = 12; // lcm(12,6,4); scale factor per page = LCM/div, always integer
const PAGES = [
  { pg: '196', file: 'lida-196.xml', lead: 'P3', div: 12 },
  { pg: '197', file: 'lida-197.xml', lead: 'P2', div: 6 },
  { pg: '198', file: 'lida-198.xml', lead: 'P2', div: 4 },
];

const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NM = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const nameOf = (m) => NM[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);

// Extract a part's INNER content (between <part id="X"> ... </part>).
function getPartInner(xml, id) {
  for (const pb of xml.split('<part id="').slice(1)) {
    const m = pb.match(/^([^"]+)"/);
    if (m && m[1] === id) {
      const end = pb.indexOf('</part>');
      if (end < 0) throw new Error(`part ${id}: no </part>`);
      return pb.slice(pb.indexOf('>') + 1, end);
    }
  }
  throw new Error(`part ${id} not found`);
}

// Melodic pitch extraction — identical rules to build-lead-dataset.mjs:
// skip rests + chord-stacked notes, keep the single melodic line.
function leadPitches(partInner) {
  const out = [];
  for (const ch of partInner.split(/<note[ >]/).slice(1)) {
    if (/<rest\b/.test(ch)) continue;
    if (/<chord\s*\/?>/.test(ch)) continue;
    const pm = ch.match(/<step>([A-G])<\/step>\s*(?:<alter>(-?\d+)<\/alter>\s*)?<octave>(\d+)<\/octave>/);
    if (!pm) continue;
    out.push((parseInt(pm[3]) + 1) * 12 + SEMI[pm[1]] + (pm[2] ? parseInt(pm[2]) : 0));
  }
  return out;
}

// ── stitch ──
// ── collect per-page Lead measures, scaled to LCM divisions ──
const FULL_MEASURE_REST = LCM * 4; // 4/4 at divisions 12 = 48 (Lida Rose is 4/4 throughout)
const measures = [];
const perPage = [];
for (const { file, lead, div } of PAGES) {
  const xml = fs.readFileSync(SRC(file), 'utf8');
  let inner = getPartInner(xml, lead);
  const a = inner.indexOf('<measure ');
  const b = inner.lastIndexOf('</measure>');
  inner = inner.slice(a, b + '</measure>'.length);
  const factor = LCM / div;
  inner = inner.replace(/<duration>(\d+)<\/duration>/g, (_, n) => `<duration>${parseInt(n) * factor}</duration>`);
  inner = inner.replace(/<divisions>\d+<\/divisions>/g, `<divisions>${LCM}</divisions>`);
  inner = inner.replace(/<print\b[\s\S]*?<\/print>\s*/g, ''); // drop ALL layout incl. <print new-system="yes"> so OSMD reflows
  const units = (inner.match(/<measure\b[\s\S]*?<\/measure>/g) || []).map(normalizeLeadMeasure);
  perPage.push(units.reduce((c, u) => c + leadPitches(u).length, 0));
  measures.push(...units);
}

// trim trailing note-less measures (next-section key/time residue, e.g. "Will I Ever Tell You")
let trimmed = 0;
while (measures.length && !/<note\b/.test(measures[measures.length - 1])) { measures.pop(); trimmed++; }

// fill interior empty/note-less measures with a full-measure rest (preserves bar count + valid MusicXML)
let filled = 0;
for (let i = 0; i < measures.length; i++) {
  if (!/<note\b/.test(measures[i])) {
    measures[i] = measures[i].replace(/<\/measure>$/, `  <note><rest measure="yes"/><duration>${FULL_MEASURE_REST}</duration><voice>1</voice></note>\n    </measure>`);
    filled++;
  }
}

// renumber measures consecutively 1..N
let measureNo = 0;
const body = measures
  .map((u) => u.replace(/<measure number="[^"]*"/, () => `<measure number="${++measureNo}"`))
  .join('\n    <!--=======================================================-->\n    ');

// defaults (layout) copied from p196 for sane OSMD scaling
const src196 = fs.readFileSync(SRC('lida-196.xml'), 'utf8');
const defaults = (src196.match(/<defaults>[\s\S]*?<\/defaults>/) || ['<defaults></defaults>'])[0];
const encDate = (src196.match(/<encoding-date>([^<]+)/) || [])[1] || '2026-06-20';
const doc = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0.3 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0.3">
  <work>
    <work-title>Lida Rose — Lead</work-title>
  </work>
  <identification>
    <encoding>
      <software>jarvis build-lead-musicxml.mjs (stitched from Audiveris 5.10.2)</software>
      <encoding-date>${encDate}</encoding-date>
    </encoding>
    <miscellaneous>
      <miscellaneous-field name="source">The Music Man — Lida Rose, Lead (Ewart), pp.196-198</miscellaneous-field>
    </miscellaneous>
  </identification>
  ${defaults}
  <part-list>
    <score-part id="P1">
      <part-name>Lead</part-name>
      <part-abbreviation>Ld</part-abbreviation>
      <score-instrument id="P1-I1">
        <instrument-name>Voice</instrument-name>
      </score-instrument>
      <midi-instrument id="P1-I1">
        <midi-channel>1</midi-channel>
        <midi-program>54</midi-program>
        <volume>78</volume>
      </midi-instrument>
    </score-part>
  </part-list>
  <part id="P1">
    ${body}
  </part>
</score-partwise>
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, doc);

// ── VERIFY (the gate) ──
const out = fs.readFileSync(OUT, 'utf8');
const errors = [];

const partOpen = (out.match(/<part id="/g) || []).length;
const partClose = (out.match(/<\/part>/g) || []).length;
if (partOpen !== 1) errors.push(`expected 1 <part id=>, got ${partOpen}`);
if (partClose !== 1) errors.push(`expected 1 </part>, got ${partClose}`);

const nums = [...out.matchAll(/<measure number="(\d+)"/g)].map((m) => parseInt(m[1]));
if (!nums.every((n, i) => n === i + 1)) errors.push(`measures not consecutive 1..N (n=${nums.length}, head ${nums.slice(0, 6)})`);

const divs = [...new Set([...out.matchAll(/<divisions>(\d+)<\/divisions>/g)].map((m) => parseInt(m[1])))];
if (divs.length !== 1 || divs[0] !== LCM) errors.push(`divisions not uniformly ${LCM}: ${divs}`);

const fifths = [...new Set([...out.matchAll(/<fifths>(-?\d+)<\/fifths>/g)].map((m) => parseInt(m[1])))];
if (fifths.length !== 1 || fifths[0] !== PRINTED_FIFTHS) errors.push(`key not uniformly ${PRINTED_FIFTHS}: ${fifths}`);

const outInner = out.slice(out.indexOf('<part id="P1">'), out.indexOf('</part>'));
const outPitches = leadPitches(outInner);
const refPitches = [...fs.readFileSync(OMR_TS, 'utf8').matchAll(/pitchMidi:\s*(\d+)/g)].map((m) => parseInt(m[1]));
const samePitch = outPitches.length === refPitches.length && outPitches.every((p, i) => p === refPitches[i]);
if (!samePitch) {
  const k = outPitches.findIndex((p, i) => p !== refPitches[i]);
  errors.push(`pitch mismatch: stitched ${outPitches.length} vs omrTargets ${refPitches.length}` +
    (k >= 0 ? `; first divergence @${k}: ${nameOf(outPitches[k])} vs ref ${nameOf(refPitches[k])}` : ''));
}

console.log(`stitched ${nums.length} measures (trimmed ${trimmed} trailing, filled ${filled} empty) · ${outPitches.length} melodic notes · divisions ${LCM}`);
console.log(`per-page Lead notes: 196=${perPage[0]} 197=${perPage[1]} 198=${perPage[2]} (sum ${perPage.reduce((a, c) => a + c, 0)})`);
console.log(`range ${nameOf(Math.min(...outPitches))}–${nameOf(Math.max(...outPitches))}`);
if (errors.length) {
  console.error('✗ VERIFY FAILED:\n  ' + errors.join('\n  '));
  process.exit(1);
}
console.log(`✓ VERIFY PASS — stitched melody == omrTargets.ts ground truth (${outPitches.length}/${refPitches.length})`);
console.log('WROTE', path.relative(path.join(__dirname, '..', '..'), OUT));
