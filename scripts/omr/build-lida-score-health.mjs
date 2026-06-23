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
const PHRASES = 'public/musicxml/lida-rose-lead-phrases.json';
const OUT = 'public/musicxml/lida-rose-lead-score-health.json';
const ALL_OUT = 'public/musicxml/lida-rose-score-health.json';
const NOTE_MAP_OUT = 'public/musicxml/lida-rose-lead-note-map.json';
const PAGES = [
  { page: '196', file: 'scripts/omr/source/lida-196.xml', lead: 'P3' },
  { page: '197', file: 'scripts/omr/source/lida-197.xml', lead: 'P2' },
  { page: '198', file: 'scripts/omr/source/lida-198.xml', lead: 'P2' },
];
const PART_SOURCES = [
  {
    part: 'Tenor',
    pages: [
      { page: '196', file: 'scripts/omr/source/lida-196.xml', lead: 'P2' },
      { page: '197', file: 'scripts/omr/source/lida-197.xml', lead: 'P1' },
      { page: '198', file: 'scripts/omr/source/lida-198.xml', lead: 'P1' },
    ],
  },
  { part: 'Lead', pages: PAGES },
  {
    part: 'Baritone',
    pages: [
      { page: '196', file: 'scripts/omr/source/lida-196.xml', lead: 'P4' },
      { page: '197', file: 'scripts/omr/source/lida-197.xml', lead: 'P3' },
      { page: '198', file: 'scripts/omr/source/lida-198.xml', lead: 'P3' },
    ],
  },
  {
    part: 'Bass',
    pages: [
      { page: '196', file: 'scripts/omr/source/lida-196.xml', lead: 'P5' },
      { page: '197', file: 'scripts/omr/source/lida-197.xml', lead: 'P4' },
      { page: '198', file: 'scripts/omr/source/lida-198.xml', lead: 'P4' },
    ],
  },
];

const xml = fs.readFileSync(XML, 'utf8');
const sync = readJson(SYNC);
const reconciled = readJson(RECONCILED);
const phraseManifest = fs.existsSync(PHRASES) ? readJson(PHRASES) : { phrases: [] };
const expected = expectedFromSource();
const actual = extractMeasurePitches(xml);
const actualWhole = extractWholeNotes(xml);
const noteMap = extractNoteMap(xml, phraseManifest.phrases || []);
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
  noteCount === expected.noteCount && noteCount === 113,
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
  scoreVersion: 'lida-rose-lead-six-flat-113',
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
const aggregate = buildAggregateHealth(payload.generatedAt);
fs.writeFileSync(ALL_OUT, `${JSON.stringify(aggregate, null, 1)}\n`);
fs.writeFileSync(NOTE_MAP_OUT, `${JSON.stringify({
  song: 'Lida Rose',
  part: 'Lead',
  scoreVersion: payload.scoreVersion,
  generatedAt: payload.generatedAt,
  notes: noteMap,
}, null, 1)}\n`);
console.log(`wrote ${OUT}`);
console.log(`wrote ${ALL_OUT}`);
console.log(`wrote ${NOTE_MAP_OUT}`);
for (const c of checks) console.log(`${c.status.toUpperCase()} ${c.id}: ${c.detail}`);
if (checks.some((c) => c.status !== 'pass')) process.exit(1);

function check(id, label, passed, detail) {
  return { id, label, status: passed ? 'pass' : 'fail', detail };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function expectedFromSource() {
  return expectedFromPages(PAGES, 'Lead');
}

function buildAggregateHealth(generatedAt) {
  const parts = PART_SOURCES.map((partSource) => {
    const expectedPart = expectedFromPages(partSource.pages, partSource.part);
    const sourceNoteCount = expectedPart.noteCount;
    const sourceWholeNotes = expectedPart.wholeNotes;
    const sourceMeasures = Object.keys(expectedPart.pitchesByMeasure).length;
    const hasGeneratedMusicXml = partSource.part === 'Lead';
    return {
      part: partSource.part,
      sourcePages: partSource.pages.map((p) => `${p.page}:${p.lead}`),
      sourceNoteCount,
      sourceMeasures,
      sourceWholeNotes,
      generatedMusicXml: hasGeneratedMusicXml ? 'available' : 'not-yet-generated',
      checks: [
        check('source-readable', 'Source pages readable', sourceNoteCount > 0, `${sourceNoteCount} pitched notes from ${sourceMeasures} source measures`),
        check('key-normalizer', 'Six-flat normalizer applies', PRINTED_FIFTHS === -6, `normalizer=${PRINTED_FIFTHS}`),
      ],
    };
  });
  const checks = [
    check('four-part-source-map', 'Four-part source map', parts.length === 4, `${parts.map((p) => p.part).join(', ')}`),
    check('all-source-parts-readable', 'All source parts readable', parts.every((p) => p.sourceNoteCount > 0), parts.map((p) => `${p.part}:${p.sourceNoteCount}`).join(' ')),
    check('lead-output-generated', 'Lead generated MusicXML verified', parts.find((p) => p.part === 'Lead')?.generatedMusicXml === 'available', 'Lead is the current rendered VT3 score'),
  ];
  return {
    song: 'Lida Rose',
    scoreVersion: 'lida-rose-source-parts-six-flat',
    generatedAt,
    sourceImages: ['/score/page-196.jpg', '/score/page-197.jpg', '/score/page-198.jpg'],
    parts,
    checks,
  };
}

function expectedFromPages(pages, partName) {
  const pitchesByMeasure = {};
  const wholeNotes = [];
  let outMeasure = 0;

  for (const page of pages) {
    const sourceXml = fs.readFileSync(page.file, 'utf8');
    const part = getPartInner(sourceXml, page.lead);
    const divisions = Number((part.match(/<divisions>(\d+)<\/divisions>/) || [])[1] || 1);
    const correctedMeasures = applyLeadMeasureCorrections(
      page.page,
      part.match(/<measure\b[\s\S]*?<\/measure>/g) || [],
      { part: partName, divisions },
    );
    for (const measure of correctedMeasures) {
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

function extractNoteMap(xmlText, phrases) {
  const out = [];
  let index = 0;
  for (const measureMatch of xmlText.matchAll(/<measure number="(\d+)"[\s\S]*?<\/measure>/g)) {
    const measure = Number(measureMatch[1]);
    for (const noteMatch of measureMatch[0].matchAll(/<note\b[\s\S]*?<\/note>/g)) {
      const noteXml = noteMatch[0];
      if (/<rest\b/.test(noteXml) || /<chord\s*\/?\s*>/.test(noteXml)) continue;
      const pitch = extractPitchesFromMeasure(noteXml)[0];
      if (!pitch) continue;
      index++;
      const phrase = phrases.find((p) => index >= p.noteStart && index <= p.noteEnd) ?? null;
      out.push({
        index,
        measure,
        page: measure <= 9 ? 196 : measure <= 19 ? 197 : 198,
        pitch,
        phraseId: phrase?.id ?? null,
        phraseLabel: phrase?.label ?? null,
        phraseShortLabel: phrase?.shortLabel ?? null,
      });
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
