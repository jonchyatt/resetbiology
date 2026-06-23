// verify-lida-lead-engraving.mjs
// Checks the generated VT3 Lead engraving against the normalized source parts.
// This is intentionally structural: key signature, source pitch spelling,
// whole-note survival, and page/system-break safety all have to pass before the
// MusicXML is trusted by OSMD.
import fs from 'fs';
import { normalizeLeadMeasure, PRINTED_FIFTHS } from './lida-lead-key-normalize.mjs';
import { applyLeadMeasureCorrections } from './lida-lead-source-corrections.mjs';

const XML = 'public/musicxml/lida-rose-lead.musicxml';
const PAGES = [
  { page: '196', file: 'scripts/omr/source/lida-196.xml', lead: 'P3' },
  { page: '197', file: 'scripts/omr/source/lida-197.xml', lead: 'P2' },
  { page: '198', file: 'scripts/omr/source/lida-198.xml', lead: 'P2' },
];

const xml = fs.readFileSync(XML, 'utf8');
const expected = expectedFromSource();
const actual = extractMeasurePitches(xml);
const actualWhole = extractWholeNotes(xml);
const fifths = [...new Set([...xml.matchAll(/<fifths>(-?\d+)<\/fifths>/g)].map((m) => Number(m[1])))];

const errors = [];
if (PRINTED_FIFTHS !== -6) errors.push(`normalizer must target six flats (-6), got ${PRINTED_FIFTHS}`);
if (fifths.length !== 1 || fifths[0] !== -6) errors.push(`expected only fifths=-6, got ${fifths.join(',') || 'none'}`);

for (const measureMatch of xml.matchAll(/<measure number="(\d+)"[\s\S]*?<\/measure>/g)) {
  const no = Number(measureMatch[1]);
  if (no <= 2) continue;
  const body = measureMatch[0];
  if (/<clef>/.test(body)) errors.push(`m${no}: repeated clef would render as a courtesy clef in OSMD`);
  if (/(<clef>|<key>)/.test(body) && !/<print\b[^>]*new-(?:system|page)="yes"/.test(body)) {
    errors.push(`m${no}: clef/key appears without a system/page break`);
  }
}

for (const [measure, expectedNotes] of Object.entries(expected.pitchesByMeasure)) {
  const got = actual[measure] || [];
  if (got.join(' ') !== expectedNotes.join(' ')) {
    errors.push(`m${measure}: expected [${expectedNotes.join(' ')}], got [${got.join(' ')}]`);
  }
}

for (const [measure, got] of Object.entries(actual)) {
  if (!expected.pitchesByMeasure[measure] && got.length) {
    errors.push(`m${measure}: unexpected pitched notes [${got.join(' ')}]`);
  }
}

const expectedWhole = expected.wholeNotes.map((n) => `${n.measure}:${n.pitch}`);
const gotWhole = actualWhole.map((n) => `${n.measure}:${n.pitch}`);
if (gotWhole.join(' ') !== expectedWhole.join(' ')) {
  errors.push(`whole notes mismatch: expected [${expectedWhole.join(' ')}], got [${gotWhole.join(' ')}]`);
}

const noteCount = Object.values(actual).reduce((sum, notes) => sum + notes.length, 0);
if (noteCount !== expected.noteCount) errors.push(`expected ${expected.noteCount} pitched notes, got ${noteCount}`);

if (errors.length) {
  console.error('ENGRAVING VERIFY FAILED');
  for (const err of errors) console.error(`  ${err}`);
  process.exit(1);
}

console.log('ENGRAVING VERIFY PASS');
console.log('key: fifths=-6 only');
console.log(`pitched notes: ${noteCount}`);
console.log(`whole notes: ${gotWhole.join(' ') || '(none)'}`);
console.log(`source pages: ${PAGES.map((p) => `${p.page}:${p.lead}`).join(' ')}`);

function expectedFromSource() {
  const pitchesByMeasure = {};
  const wholeNotes = [];
  let outMeasure = 0;

  for (const page of PAGES) {
    const sourceXml = fs.readFileSync(page.file, 'utf8');
    const part = getPartInner(sourceXml, page.lead);
    const measures = applyLeadMeasureCorrections(page.page, part.match(/<measure\b[\s\S]*?<\/measure>/g) || []);
    for (const measure of measures) {
      outMeasure++;
      const normalized = normalizeLeadMeasure(measure);
      const pitches = extractPitchesFromMeasure(normalized);
      if (pitches.length) pitchesByMeasure[String(outMeasure)] = pitches;
      for (const pitch of extractWholeNotesFromMeasure(normalized)) {
        wholeNotes.push({ measure: outMeasure, pitch });
      }
    }
  }

  while (outMeasure > 0 && !pitchesByMeasure[String(outMeasure)]) outMeasure--;
  for (const key of Object.keys(pitchesByMeasure)) {
    if (Number(key) > outMeasure) delete pitchesByMeasure[key];
  }

  return {
    pitchesByMeasure,
    wholeNotes: wholeNotes.filter((n) => n.measure <= outMeasure),
    noteCount: Object.values(pitchesByMeasure).reduce((sum, notes) => sum + notes.length, 0),
  };
}

function getPartInner(sourceXml, id) {
  for (const partBlock of sourceXml.split('<part id="').slice(1)) {
    const match = partBlock.match(/^([^"]+)"/);
    if (!match || match[1] !== id) continue;
    const end = partBlock.indexOf('</part>');
    if (end < 0) throw new Error(`part ${id}: missing </part>`);
    return partBlock.slice(partBlock.indexOf('>') + 1, end);
  }
  throw new Error(`part ${id} not found`);
}

function extractMeasurePitches(xmlText) {
  const out = {};
  for (const measureMatch of xmlText.matchAll(/<measure number="(\d+)"[\s\S]*?<\/measure>/g)) {
    const notes = extractPitchesFromMeasure(measureMatch[0]);
    if (notes.length) out[measureMatch[1]] = notes;
  }
  return out;
}

function extractPitchesFromMeasure(measureXml) {
  const notes = [];
  for (const noteMatch of measureXml.matchAll(/<note\b[\s\S]*?<\/note>/g)) {
    const noteXml = noteMatch[0];
    if (/<rest\b/.test(noteXml) || /<chord\s*\/?\s*>/.test(noteXml)) continue;
    const pitch = noteXml.match(/<pitch>[\s\S]*?<step>([A-G])<\/step>[\s\S]*?(?:<alter>(-?\d+)<\/alter>[\s\S]*?)?<octave>(\d+)<\/octave>[\s\S]*?<\/pitch>/);
    if (!pitch) continue;
    notes.push(spelledPitch(pitch[1], pitch[2] ? Number(pitch[2]) : 0, pitch[3]));
  }
  return notes;
}

function extractWholeNotes(xmlText) {
  const out = [];
  for (const measureMatch of xmlText.matchAll(/<measure number="(\d+)"[\s\S]*?<\/measure>/g)) {
    for (const pitch of extractWholeNotesFromMeasure(measureMatch[0])) {
      out.push({ measure: Number(measureMatch[1]), pitch });
    }
  }
  return out;
}

function extractWholeNotesFromMeasure(measureXml) {
  const out = [];
  for (const noteMatch of measureXml.matchAll(/<note\b[\s\S]*?<\/note>/g)) {
    const noteXml = noteMatch[0];
    if (/<rest\b/.test(noteXml) || /<chord\s*\/?\s*>/.test(noteXml)) continue;
    if (!/<type>whole<\/type>/.test(noteXml) && !/<duration>48<\/duration>/.test(noteXml)) continue;
    const pitch = extractPitchesFromMeasure(noteXml)[0];
    if (pitch) out.push(pitch);
  }
  return out;
}

function spelledPitch(step, alter, octave) {
  const suffix = alter === -2 ? 'bb' : alter === -1 ? 'b' : alter === 1 ? '#' : alter === 2 ? '##' : '';
  return `${step}${suffix}${octave}`;
}
