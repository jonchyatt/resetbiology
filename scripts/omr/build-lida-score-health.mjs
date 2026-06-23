// build-lida-score-health.mjs
// Emits the VT3 score-health artifact consumed by VocalTrainerIII.
// The artifact is derived from the corrected page-source MusicXML, not from the
// rendered UI, so it can catch wrong key signatures, missing whole notes, and
// accidental/courtesy-clef regressions before the trainer trusts a score.
import fs from 'fs';
import { normalizeLeadMeasure, PRINTED_FIFTHS } from './lida-lead-key-normalize.mjs';
import { applyLeadMeasureCorrections } from './lida-lead-source-corrections.mjs';

const XML = 'public/musicxml/lida-rose-lead.musicxml';
const SYNC = 'public/musicxml/lida-rose-lead-sync.json';
const RECONCILED = 'public/musicxml/lida-rose-lead-reconciled.json';
const OUT = 'public/musicxml/lida-rose-lead-score-health.json';
const PAGES = [
  { page: '196', file: 'scripts/omr/source/lida-196.xml', lead: 'P3' },
  { page: '197', file: 'scripts/omr/source/lida-197.xml', lead: 'P2' },
  { page: '198', file: 'scripts/omr/source/lida-198.xml', lead: 'P2' },
];

const xml = fs.readFileSync(XML, 'utf8');
const sync = readJson(SYNC);
const reconciled = readJson(RECONCILED);
const expected = expectedFromSource();
const actual = extractMeasurePitches(xml);
const actualWhole = extractWholeNotes(xml);
const fifths = [...new Set([...xml.matchAll(/<fifths>(-?\d+)<\/fifths>/g)].map((m) => Number(m[1])))];
const noteCount = Object.values(actual).reduce((sum, notes) => sum + notes.length, 0);
const checks = [];

checks.push(check(
  'key-fifths',
  'Printed key',
  PRINTED_FIFTHS === -6 && fifths.length === 1 && fifths[0] === -6,
  `expected -6; xml=${fifths.join(',') || 'none'} normalizer=${PRINTED_FIFTHS}`,
));

const pitchErrors = [];
for (const [measure, expectedNotes] of Object.entries(expected.pitchesByMeasure)) {
  const got = actual[measure] || [];
  if (got.join(' ') !== expectedNotes.join(' ')) {
    pitchErrors.push(`m${measure}: expected [${expectedNotes.join(' ')}], got [${got.join(' ')}]`);
  }
}
for (const [measure, got] of Object.entries(actual)) {
  if (!expected.pitchesByMeasure[measure] && got.length) {
    pitchErrors.push(`m${measure}: unexpected pitched notes [${got.join(' ')}]`);
  }
}
checks.push(check(
  'source-pitches',
  'Source pitch sequence',
  pitchErrors.length === 0,
  pitchErrors.length ? pitchErrors.slice(0, 5).join(' | ') : `${noteCount} pitches match pp.196-198`,
));

const expectedWhole = expected.wholeNotes.map((n) => `${n.measure}:${n.pitch}`);
const gotWhole = actualWhole.map((n) => `${n.measure}:${n.pitch}`);
checks.push(check(
  'whole-notes',
  'Whole-note survival',
  gotWhole.join(' ') === expectedWhole.join(' '),
  `expected [${expectedWhole.join(' ')}]; got [${gotWhole.join(' ')}]`,
));

checks.push(check(
  'note-count',
  'Pitched note count',
  noteCount === expected.noteCount && noteCount === 114,
  `expected ${expected.noteCount}; got ${noteCount}`,
));

const clefErrors = [];
for (const measureMatch of xml.matchAll(/<measure number="(\d+)"[\s\S]*?<\/measure>/g)) {
  const no = Number(measureMatch[1]);
  if (no <= 2) continue;
  const body = measureMatch[0];
  if (/<clef>/.test(body)) clefErrors.push(`m${no}: repeated clef`);
  if (/(<clef>|<key>)/.test(body) && !/<print\b[^>]*new-(?:system|page)="yes"/.test(body)) {
    clefErrors.push(`m${no}: clef/key without system break`);
  }
}
checks.push(check(
  'no-courtesy-clefs',
  'No stray courtesy clefs',
  clefErrors.length === 0,
  clefErrors.length ? clefErrors.join(' | ') : 'no later clefs in the line',
));

const syncNotes = Array.isArray(sync.notes) ? sync.notes : [];
const reconciledNotes = Array.isArray(reconciled.notes) ? reconciled.notes : [];
checks.push(check(
  'sync-count',
  'Sync target count',
  syncNotes.length === noteCount && reconciledNotes.length === noteCount,
  `sync=${syncNotes.length}; reconciled=${reconciledNotes.length}; score=${noteCount}`,
));

const recovered = reconciledNotes.filter((n) => n.src === 'engraving-recovered').length;
const confirmed = reconciledNotes.filter((n) => n.src === 'audio-confirmed').length;
const payload = {
  song: 'Lida Rose',
  part: 'Lead',
  scoreVersion: 'lida-rose-lead-six-flat-114',
  sourcePages: PAGES.map((p) => `${p.page}:${p.lead}`),
  generatedAt: new Date().toISOString(),
  keyFifths: -6,
  noteCount,
  wholeNotes: actualWhole,
  sync: {
    noteCount: syncNotes.length,
    reconciledCount: reconciledNotes.length,
    confirmed,
    recovered,
  },
  checks,
};

fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 1)}\n`);
console.log(`wrote ${OUT}`);
for (const c of checks) console.log(`${c.status.toUpperCase()} ${c.id}: ${c.detail}`);
if (checks.some((c) => c.status !== 'pass')) process.exit(1);

function check(id, label, passed, detail) {
  return { id, label, status: passed ? 'pass' : 'fail', detail };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

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
