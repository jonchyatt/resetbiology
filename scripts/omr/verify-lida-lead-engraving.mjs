// verify-lida-lead-engraving.mjs
// Locked per-measure Lead pitch spelling check for Lida Rose pp.196-198.
// The expected list is the printed Ewart/Lead staff read under the A-flat major
// key signature (fifths = -4), including printed accidentals.
import fs from 'fs';

const XML = 'public/musicxml/lida-rose-lead.musicxml';
const EXPECTED = {
  3: ['Bb3', 'A3', 'Bb3'],
  4: ['Eb4', 'Db4', 'C4', 'Db4'],
  5: ['Cb4'],
  6: ['C4', 'Bb3', 'C4', 'Db3'],
  7: ['C4', 'B3', 'C4', 'C4', 'C4', 'C4', 'B3', 'C4'],
  8: ['Eb4', 'Db4', 'C4', 'Db4'],
  9: ['Eb4', 'C4'],
  10: ['G3', 'Eb4', 'D4'],
  11: ['Db4', 'Bb3', 'Db4', 'Bb3', 'Db4'],
  12: ['Bb3', 'G3'],
  13: ['C4', 'Ab3', 'G3'],
  14: ['F3', 'G3', 'Ab3', 'Bb3'],
  15: ['Db4', 'C4', 'Db4', 'Cb4', 'Db3'],
  16: ['Bb3', 'A3', 'Bb3', 'Db3'],
  17: ['Bb3', 'A3', 'Bb3', 'Db3', 'Db3', 'Bb3', 'A3', 'Bb3'],
  18: ['Eb4', 'Db4', 'C4', 'Db4'],
  19: ['C4', 'Bb3', 'C4', 'Db3'],
  20: ['C4', 'B3', 'C4', 'C4', 'C4', 'C4', 'B3', 'C4'],
  21: ['Eb4', 'Db4', 'C4', 'Db4', 'E4'],
  22: ['Eb4', 'Eb4'],
  23: ['Eb4', 'Eb4', 'D4', 'Eb4'],
  24: ['G3', 'Ab3'],
  25: ['Bb3', 'Db4', 'Bb3', 'Db4'],
  27: ['Eb4', 'D4', 'Eb4', 'Gb3'],
  28: ['F3', 'G3', 'Ab3'],
  29: ['G3', 'Bb3', 'A3', 'Bb3', 'G3'],
  30: ['Bb3', 'A3', 'Bb3', 'G3', 'Bb3', 'A3'],
  31: ['Bb3', 'B3'],
};

const xml = fs.readFileSync(XML, 'utf8');
const fifths = [...new Set([...xml.matchAll(/<fifths>(-?\d+)<\/fifths>/g)].map((m) => Number(m[1])))];
const actual = extractMeasurePitches(xml);

const errors = [];
if (fifths.length !== 1 || fifths[0] !== -4) errors.push(`expected only fifths=-4, got ${fifths.join(',') || 'none'}`);

for (const [measure, expected] of Object.entries(EXPECTED)) {
  const got = actual[measure] || [];
  if (got.join(' ') !== expected.join(' ')) {
    errors.push(`m${measure}: expected [${expected.join(' ')}], got [${got.join(' ')}]`);
  }
}

for (const [measure, got] of Object.entries(actual)) {
  if (!EXPECTED[measure] && got.length) errors.push(`m${measure}: unexpected pitched notes [${got.join(' ')}]`);
}

const noteCount = Object.values(actual).reduce((sum, notes) => sum + notes.length, 0);
if (noteCount !== 113) errors.push(`expected 113 pitched notes, got ${noteCount}`);

if (errors.length) {
  console.error('ENGRAVING VERIFY FAILED');
  for (const err of errors) console.error(`  ${err}`);
  process.exit(1);
}

console.log('ENGRAVING VERIFY PASS');
console.log('key: fifths=-4 (A-flat major) only');
console.log(`pitched notes: ${noteCount}`);
for (const [measure, notes] of Object.entries(EXPECTED)) {
  console.log(`m${measure}: ${notes.join(' ')}`);
}

function extractMeasurePitches(xmlText) {
  const out = {};
  for (const measureMatch of xmlText.matchAll(/<measure number="(\d+)"[\s\S]*?<\/measure>/g)) {
    const notes = [];
    for (const noteMatch of measureMatch[0].matchAll(/<note\b[\s\S]*?<\/note>/g)) {
      const noteXml = noteMatch[0];
      if (/<rest\b/.test(noteXml) || /<chord\s*\/?\s*>/.test(noteXml)) continue;
      const pitch = noteXml.match(/<pitch>[\s\S]*?<step>([A-G])<\/step>[\s\S]*?(?:<alter>(-?\d+)<\/alter>[\s\S]*?)?<octave>(\d+)<\/octave>[\s\S]*?<\/pitch>/);
      if (!pitch) continue;
      notes.push(spelledPitch(pitch[1], pitch[2] ? Number(pitch[2]) : 0, pitch[3]));
    }
    if (notes.length) out[measureMatch[1]] = notes;
  }
  return out;
}

function spelledPitch(step, alter, octave) {
  const suffix = alter === -2 ? 'bb' : alter === -1 ? 'b' : alter === 1 ? '#' : alter === 2 ? '##' : '';
  return `${step}${suffix}${octave}`;
}
