// build-baritone-musicxml.mjs
// Stitches the Lida Rose BARITONE part (Oliver, pp.196-198) into one clean
// single-part MusicXML file for OSMD in Vocal Trainer III.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PRINTED_FIFTHS, normalizeLeadMeasure } from './lida-lead-key-normalize.mjs';
import { applyLeadMeasureCorrections } from './lida-lead-source-corrections.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = (f) => path.join(__dirname, 'source', f);
const OUT = path.join(__dirname, '..', '..', 'public', 'musicxml', 'lida-rose-baritone.musicxml');
const OMR_TS = path.join(__dirname, '..', '..', 'src', 'components', 'PitchDefender', 'omrTargets.ts');

const PART = 'Baritone';
const LCM = 12;
const PAGES = [
  { pg: '196', file: 'lida-196.xml', staff: 'P4' },
  { pg: '197', file: 'lida-197.xml', staff: 'P3' },
  { pg: '198', file: 'lida-198.xml', staff: 'P3' },
];

const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NM = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const nameOf = (m) => NM[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);

function getPartInner(xml, id) {
  for (const pb of xml.split('<part id="').slice(1)) {
    const m = pb.match(/^([^"]+)"/);
    if (m?.[1] !== id) continue;
    const end = pb.indexOf('</part>');
    if (end < 0) throw new Error(`part ${id}: no </part>`);
    return pb.slice(pb.indexOf('>') + 1, end);
  }
  throw new Error(`part ${id} not found`);
}

function melodicPitches(partInner) {
  const out = [];
  for (const ch of partInner.split(/<note[ >]/).slice(1)) {
    if (/<rest\b/.test(ch)) continue;
    if (/<chord\s*\/?>/.test(ch)) continue;
    const pm = ch.match(/<step>([A-G])<\/step>\s*(?:<alter>(-?\d+)<\/alter>\s*)?<octave>(\d+)<\/octave>/);
    if (!pm) continue;
    out.push((Number(pm[3]) + 1) * 12 + SEMI[pm[1]] + (pm[2] ? Number(pm[2]) : 0));
  }
  return out;
}

const FULL_MEASURE_REST = LCM * 4;
const measures = [];
const perPage = [];
for (let pageIndex = 0; pageIndex < PAGES.length; pageIndex++) {
  const { pg, file, staff } = PAGES[pageIndex];
  const xml = fs.readFileSync(SRC(file), 'utf8');
  let inner = getPartInner(xml, staff);
  const a = inner.indexOf('<measure ');
  const b = inner.lastIndexOf('</measure>');
  inner = inner.slice(a, b + '</measure>'.length);
  const div = Number((inner.match(/<divisions>(\d+)<\/divisions>/) || [])[1] || 1);
  const factor = LCM / div;
  inner = inner.replace(/<duration>(\d+)<\/duration>/g, (_, n) => `<duration>${Number(n) * factor}</duration>`);
  inner = inner.replace(/<divisions>\d+<\/divisions>/g, `<divisions>${LCM}</divisions>`);
  inner = preservePrintBreaks(inner);
  let units = (inner.match(/<measure\b[\s\S]*?<\/measure>/g) || []).map(normalizeLeadMeasure);
  units = applyLeadMeasureCorrections(pg, units, { part: PART, divisions: LCM });
  if (pageIndex > 0 && units[0]) units[0] = forceSystemBreak(units[0]);
  perPage.push(units.reduce((c, u) => c + melodicPitches(u).length, 0));
  measures.push(...units);
}

let trimmed = 0;
while (measures.length && !/<note\b/.test(measures[measures.length - 1])) {
  measures.pop();
  trimmed++;
}

let filled = 0;
for (let i = 0; i < measures.length; i++) {
  if (!/<note\b/.test(measures[i])) {
    measures[i] = measures[i].replace(/<\/measure>$/, `  <note><rest measure="yes"/><duration>${FULL_MEASURE_REST}</duration><voice>1</voice></note>\n    </measure>`);
    filled++;
  }
}

for (let i = 1; i < measures.length; i++) {
  measures[i] = stripRepeatedClef(measures[i]);
}

let measureNo = 0;
const body = measures
  .map((u) => u.replace(/<measure number="[^"]*"/, () => `<measure number="${++measureNo}"`))
  .join('\n    <!--=======================================================-->\n    ');

const src196 = fs.readFileSync(SRC('lida-196.xml'), 'utf8');
const defaults = (src196.match(/<defaults>[\s\S]*?<\/defaults>/) || ['<defaults></defaults>'])[0];
const encDate = (src196.match(/<encoding-date>([^<]+)/) || [])[1] || '2026-06-20';
const doc = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0.3 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0.3">
  <work>
    <work-title>Lida Rose - Baritone</work-title>
  </work>
  <identification>
    <encoding>
      <software>jarvis build-baritone-musicxml.mjs (stitched from Audiveris 5.10.2)</software>
      <encoding-date>${encDate}</encoding-date>
    </encoding>
    <miscellaneous>
      <miscellaneous-field name="source">The Music Man - Lida Rose, Baritone (Oliver), pp.196-198</miscellaneous-field>
    </miscellaneous>
  </identification>
  ${defaults}
  <part-list>
    <score-part id="P1">
      <part-name>Baritone</part-name>
      <part-abbreviation>Bar</part-abbreviation>
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
fs.writeFileSync(OUT, doc.replace(/[ \t]+$/gm, ''));

const out = fs.readFileSync(OUT, 'utf8');
const errors = [];

const partOpen = (out.match(/<part id="/g) || []).length;
const partClose = (out.match(/<\/part>/g) || []).length;
if (partOpen !== 1) errors.push(`expected 1 <part id=>, got ${partOpen}`);
if (partClose !== 1) errors.push(`expected 1 </part>, got ${partClose}`);

const nums = [...out.matchAll(/<measure number="(\d+)"/g)].map((m) => Number(m[1]));
if (!nums.every((n, i) => n === i + 1)) errors.push(`measures not consecutive 1..N (n=${nums.length}, head ${nums.slice(0, 6)})`);

const divs = [...new Set([...out.matchAll(/<divisions>(\d+)<\/divisions>/g)].map((m) => Number(m[1])))];
if (divs.length !== 1 || divs[0] !== LCM) errors.push(`divisions not uniformly ${LCM}: ${divs}`);

const fifths = [...new Set([...out.matchAll(/<fifths>(-?\d+)<\/fifths>/g)].map((m) => Number(m[1])))];
if (!fifths.length || fifths.some((f) => f !== PRINTED_FIFTHS)) {
  errors.push(`unexpected key fifths: ${fifths}; expected ${PRINTED_FIFTHS}`);
}

for (const measureMatch of out.matchAll(/<measure number="(\d+)"[\s\S]*?<\/measure>/g)) {
  const no = Number(measureMatch[1]);
  if (no <= 2) continue;
  const measureBody = measureMatch[0];
  if (/<clef>/.test(measureBody)) errors.push(`m${no}: repeated clef would render as a courtesy clef in OSMD`);
  if (/(<clef>|<key>)/.test(measureBody) && !/<print\b[^>]*new-(?:system|page)="yes"/.test(measureBody)) {
    errors.push(`m${no}: clef/key attributes without an explicit system break`);
  }
}

const outInner = out.slice(out.indexOf('<part id="P1">'), out.indexOf('</part>'));
const outPitches = melodicPitches(outInner);
const refPitches = targetPitchesFromOmr(PART);
const samePitch = outPitches.length === refPitches.length && outPitches.every((p, i) => p === refPitches[i]);
if (!samePitch) {
  const k = outPitches.findIndex((p, i) => p !== refPitches[i]);
  errors.push(`pitch mismatch: stitched ${outPitches.length} vs omrTargets ${refPitches.length}` +
    (k >= 0 ? `; first divergence @${k}: ${nameOf(outPitches[k])} vs ref ${nameOf(refPitches[k])}` : ''));
}

console.log(`stitched ${nums.length} measures (trimmed ${trimmed} trailing, filled ${filled} empty) - ${outPitches.length} melodic notes - divisions ${LCM}`);
console.log(`per-page Baritone notes: 196=${perPage[0]} 197=${perPage[1]} 198=${perPage[2]} (sum ${perPage.reduce((a, c) => a + c, 0)})`);
console.log(`range ${nameOf(Math.min(...outPitches))}-${nameOf(Math.max(...outPitches))}`);
if (errors.length) {
  console.error('VERIFY FAILED:\n  ' + errors.join('\n  '));
  process.exit(1);
}
console.log(`VERIFY PASS - stitched melody == omrTargets.ts ground truth (${outPitches.length}/${refPitches.length})`);
console.log('WROTE', path.relative(path.join(__dirname, '..', '..'), OUT));

function preservePrintBreaks(xml) {
  return xml.replace(/<print\b([^>]*)>[\s\S]*?<\/print>\s*/g, (_, attrs) => {
    if (/\bnew-page="yes"/.test(attrs)) return '<print new-page="yes"/>\n      ';
    if (/\bnew-system="yes"/.test(attrs)) return '<print new-system="yes"/>\n      ';
    return '';
  });
}

function forceSystemBreak(measureXml) {
  if (/<print\b/.test(measureXml)) {
    return measureXml.replace(/<print\b[^>]*(?:\/>|>[\s\S]*?<\/print>)/, '<print new-system="yes"/>');
  }
  return measureXml.replace(/(<measure\b[^>]*>\s*)/, '$1\n      <print new-system="yes"/>');
}

function stripRepeatedClef(measureXml) {
  return measureXml.replace(/\s*<clef>[\s\S]*?<\/clef>/g, '');
}

function targetPitchesFromOmr(part) {
  const ts = fs.readFileSync(OMR_TS, 'utf8');
  const block = ts.match(new RegExp(`part: '${part}',[\\s\\S]*?notes: \\[([\\s\\S]*?)\\n    \\]`));
  if (!block) throw new Error(`missing ${part} target in omrTargets.ts`);
  return [...block[1].matchAll(/pitchMidi:\s*(\d+)/g)].map((m) => Number(m[1]));
}
