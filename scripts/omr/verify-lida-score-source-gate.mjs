// verify-lida-score-source-gate.mjs
// Score-first gate for VT3 Lida Rose parts. This compares the generated
// single-part MusicXML back to corrected page-source MusicXML by measure before
// timing/plunk artifacts are allowed to be trusted.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PRINTED_FIFTHS, normalizeLeadMeasure } from './lida-lead-key-normalize.mjs';
import { applyLeadMeasureCorrections } from './lida-lead-source-corrections.mjs';
import {
  EXPECTED_LEAD_NOTE_COUNT,
  LEAD_SECTION_TRANSITIONS,
  PRINTED_LEAD_AUDIT_MEASURES,
} from './lida-lead-printed-manifest.mjs';
import {
  EXPECTED_BARITONE_NOTE_COUNT,
  PRINTED_BARITONE_AUDIT_MEASURES,
} from './lida-baritone-printed-manifest.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const PUBLIC = path.join(ROOT, 'public', 'musicxml');
const SOURCE = path.join(__dirname, 'source');
const LCM = 12;
const FULL_MEASURE_REST = LCM * 4;
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const errors = [];

const PARTS = [
  {
    part: 'Lead',
    slug: 'lead',
    expectedNoteCount: EXPECTED_LEAD_NOTE_COUNT,
    pages: [
      { page: '196', file: 'lida-196.xml', staff: 'P3' },
      { page: '197', file: 'lida-197.xml', staff: 'P2' },
      { page: '198', file: 'lida-198.xml', staff: 'P2' },
    ],
    allowedFifths: new Set([PRINTED_FIFTHS, ...LEAD_SECTION_TRANSITIONS.map((t) => t.nextKeyFifths)]),
    auditMeasures: PRINTED_LEAD_AUDIT_MEASURES,
  },
  {
    part: 'Baritone',
    slug: 'baritone',
    expectedNoteCount: EXPECTED_BARITONE_NOTE_COUNT,
    pages: [
      { page: '196', file: 'lida-196.xml', staff: 'P4' },
      { page: '197', file: 'lida-197.xml', staff: 'P3' },
      { page: '198', file: 'lida-198.xml', staff: 'P3' },
    ],
    allowedFifths: new Set([PRINTED_FIFTHS]),
    auditMeasures: PRINTED_BARITONE_AUDIT_MEASURES,
  },
];

for (const cfg of PARTS) {
  verifyPart(cfg);
}

if (errors.length) {
  console.error('LIDA SCORE SOURCE GATE FAILED:\n  ' + errors.join('\n  '));
  process.exit(1);
}
console.log('Lida score source gate PASS: generated MusicXML matches corrected source measures before timing');

function verifyPart(cfg) {
  const generatedXml = fs.readFileSync(path.join(PUBLIC, `lida-rose-${cfg.slug}.musicxml`), 'utf8');
  const expectedMeasures = expectedMeasuresFromSource(cfg);
  const actualMeasures = generatedMeasures(generatedXml);
  const expectedPitches = expectedMeasures.flatMap((m) => m.pitched.map((n) => n.pitch));
  const actualPitches = actualMeasures.flatMap((m) => m.pitched.map((n) => n.pitch));
  const expectedWhole = expectedMeasures.flatMap((m) =>
    m.pitched
      .filter((n) => n.type === 'whole' || n.durationTicks === FULL_MEASURE_REST)
      .map((n) => `${m.measure}:${n.pitch}`)
  );
  const actualWhole = actualMeasures.flatMap((m) =>
    m.pitched
      .filter((n) => n.type === 'whole' || n.durationTicks === FULL_MEASURE_REST)
      .map((n) => `${m.measure}:${n.pitch}`)
  );

  assert(expectedPitches.length === cfg.expectedNoteCount,
    `${cfg.part}: source expected ${expectedPitches.length} pitches != ${cfg.expectedNoteCount}`);
  assert(actualPitches.length === cfg.expectedNoteCount,
    `${cfg.part}: generated ${actualPitches.length} pitches != ${cfg.expectedNoteCount}`);
  assert(expectedPitches.join(' ') === actualPitches.join(' '),
    `${cfg.part}: generated pitch sequence differs from corrected source`);
  assert(expectedWhole.join(' ') === actualWhole.join(' '),
    `${cfg.part}: whole-note survival mismatch expected [${expectedWhole.join(' ')}], got [${actualWhole.join(' ')}]`);

  const fifths = [...new Set([...generatedXml.matchAll(/<fifths>(-?\d+)<\/fifths>/g)].map((m) => Number(m[1])))];
  assert(fifths.length > 0 && fifths.every((f) => cfg.allowedFifths.has(f)),
    `${cfg.part}: unexpected key fifths ${fifths.join(',') || 'none'}`);
  assert(expectedMeasures.length === actualMeasures.length,
    `${cfg.part}: measure count mismatch source=${expectedMeasures.length} generated=${actualMeasures.length}`);
  const measureCount = Math.min(expectedMeasures.length, actualMeasures.length);
  for (let i = 0; i < measureCount; i++) {
    const expected = expectedMeasures[i];
    const actual = actualMeasures[i];
    const prefix = `${cfg.part} m${actual.measure}`;
    assert(expected.measure === actual.measure, `${prefix}: measure numbering mismatch expected ${expected.measure}`);
    assert(expected.durationTicks === actual.durationTicks,
      `${prefix}: duration ${actual.durationTicks} != corrected source ${expected.durationTicks}`);
    assert(noteSummary(expected.pitched) === noteSummary(actual.pitched),
      `${prefix}: pitched notes differ expected [${noteSummary(expected.pitched)}], got [${noteSummary(actual.pitched)}]`);
    assert(expected.restTicks === actual.restTicks,
      `${prefix}: rest ticks ${actual.restTicks} != corrected source ${expected.restTicks}`);
  }

  for (const m of actualMeasures) {
    if (m.measure <= 2) continue;
    assert(!m.hasClef, `${cfg.part} m${m.measure}: repeated clef would render as courtesy clef`);
    assert(!(m.hasClefOrKey && !m.hasSystemOrPageBreak),
      `${cfg.part} m${m.measure}: clef/key appears without explicit system/page break`);
  }

  for (const audit of cfg.auditMeasures) {
    const measure = actualMeasures.find((m) => m.measure === audit.measure);
    assert(!!measure, `${cfg.part}: missing printed audit measure ${audit.measure}`);
    if (!measure) continue;
    const got = measure.pitched.map((n) => ({
      pitch: n.pitch,
      beats: n.beats,
      type: n.type,
      ...(n.dots ? { dots: n.dots } : {}),
    }));
    assert(JSON.stringify(got) === JSON.stringify(audit.notes),
      `${cfg.part} m${audit.measure}: printed audit expected [${noteSummary(audit.notes)}], got [${noteSummary(got)}] (${audit.source})`);
    for (const required of audit.requiredXml || []) {
      assert(measure.xml.includes(required),
        `${cfg.part} m${audit.measure}: missing required printed notation ${required}`);
    }
  }

  const actualTieStarts = actualMeasures.flatMap((m) => m.pitched.filter((n) => n.tieStart).map((n) => `${m.measure}:${n.pitch}`));
  const actualTieStops = actualMeasures.flatMap((m) => m.pitched.filter((n) => n.tieStop).map((n) => `${m.measure}:${n.pitch}`));
  const expectedTieStarts = expectedMeasures.flatMap((m) => m.pitched.filter((n) => n.tieStart).map((n) => `${m.measure}:${n.pitch}`));
  const expectedTieStops = expectedMeasures.flatMap((m) => m.pitched.filter((n) => n.tieStop).map((n) => `${m.measure}:${n.pitch}`));
  assert(actualTieStarts.join(' ') === expectedTieStarts.join(' '),
    `${cfg.part}: tie starts differ expected [${expectedTieStarts.join(' ')}], got [${actualTieStarts.join(' ')}]`);
  assert(actualTieStops.join(' ') === expectedTieStops.join(' '),
    `${cfg.part}: tie stops differ expected [${expectedTieStops.join(' ')}], got [${actualTieStops.join(' ')}]`);

  console.log(`${cfg.part} source gate PASS: ${actualMeasures.length} measures, ${actualPitches.length} notes, fifths ${fifths.join(',')}, whole [${actualWhole.join(' ')}]`);
}

function expectedMeasuresFromSource(cfg) {
  const measures = [];
  for (const page of cfg.pages) {
    const sourceXml = fs.readFileSync(path.join(SOURCE, page.file), 'utf8');
    let inner = getPartInner(sourceXml, page.staff);
    const firstMeasure = inner.indexOf('<measure ');
    const lastMeasure = inner.lastIndexOf('</measure>');
    inner = inner.slice(firstMeasure, lastMeasure + '</measure>'.length);
    const divisions = Number((inner.match(/<divisions>(\d+)<\/divisions>/) || [])[1] || 1);
    const factor = LCM / divisions;
    inner = inner.replace(/<duration>(\d+)<\/duration>/g, (_, n) => `<duration>${Number(n) * factor}</duration>`);
    inner = inner.replace(/<divisions>\d+<\/divisions>/g, `<divisions>${LCM}</divisions>`);
    let units = (inner.match(/<measure\b[\s\S]*?<\/measure>/g) || []).map(normalizeLeadMeasure);
    units = applyLeadMeasureCorrections(page.page, units, { part: cfg.part, divisions: LCM });
    measures.push(...units);
  }

  while (measures.length && !/<note\b/.test(measures[measures.length - 1])) measures.pop();
  for (let i = 0; i < measures.length; i++) {
    if (!/<note\b/.test(measures[i])) {
      measures[i] = measures[i].replace(/<\/measure>$/, `  <note><rest measure="yes"/><duration>${FULL_MEASURE_REST}</duration><voice>1</voice></note>\n    </measure>`);
    }
  }
  for (let i = 1; i < measures.length; i++) measures[i] = stripRepeatedClef(measures[i]);

  return measures.map((xml, index) =>
    summarizeMeasure(xml.replace(/<measure number="[^"]*"/, `<measure number="${index + 1}"`), index + 1)
  );
}

function generatedMeasures(xml) {
  return [...xml.matchAll(/<measure number="(\d+)"[\s\S]*?<\/measure>/g)]
    .map((m) => summarizeMeasure(m[0], Number(m[1])));
}

function summarizeMeasure(xml, measure) {
  const notes = [...xml.matchAll(/<note\b[\s\S]*?<\/note>/g)].map((m) => m[0]);
  const pitched = [];
  let durationTicks = 0;
  let restTicks = 0;
  for (const noteXml of notes) {
    if (/<chord\s*\/?\s*>/.test(noteXml)) continue;
    const duration = Number((noteXml.match(/<duration>(\d+)<\/duration>/) || [])[1] || 0);
    durationTicks += duration;
    if (/<rest\b/.test(noteXml)) {
      restTicks += duration;
      continue;
    }
    const pitch = extractPitch(noteXml);
    if (!pitch) continue;
    const dots = (noteXml.match(/<dot\s*\/>/g) || []).length;
    const accidental = (noteXml.match(/<accidental(?:\s[^>]*)?>([^<]+)<\/accidental>/) || [])[1] || null;
    pitched.push({
      pitch,
      durationTicks: duration,
      beats: round3(duration / LCM),
      type: (noteXml.match(/<type>([^<]+)<\/type>/) || [])[1] || null,
      ...(dots ? { dots } : {}),
      ...(accidental ? { accidental } : {}),
      tieStart: /<tie type="start"\/>/.test(noteXml) || /<tied type="start"/.test(noteXml),
      tieStop: /<tie type="stop"\/>/.test(noteXml) || /<tied type="stop"/.test(noteXml),
    });
  }
  return {
    measure,
    xml,
    durationTicks,
    restTicks,
    pitched,
    hasClef: /<clef>/.test(xml),
    hasClefOrKey: /(<clef>|<key>)/.test(xml),
    hasSystemOrPageBreak: /<print\b[^>]*new-(?:system|page)="yes"/.test(xml),
  };
}

function extractPitch(noteXml) {
  const pitch = noteXml.match(/<pitch>[\s\S]*?<step>([A-G])<\/step>[\s\S]*?(?:<alter>(-?\d+)<\/alter>[\s\S]*?)?<octave>(\d+)<\/octave>[\s\S]*?<\/pitch>/);
  if (!pitch) return null;
  return spelledPitch(pitch[1], pitch[2] ? Number(pitch[2]) : 0, pitch[3]);
}

function spelledPitch(step, alter, octave) {
  const accidentals = {
    '-2': 'bb',
    '-1': 'b',
    0: '',
    1: '#',
    2: '##',
  };
  return `${step}${accidentals[alter] ?? `(${alter})`}${octave}`;
}

function noteSummary(notes) {
  return notes.map((n) => {
    const dots = n.dots ? `.${n.dots}` : '';
    const accidental = n.accidental ? `:${n.accidental}` : '';
    const tie = n.tieStart ? ':tie-start' : n.tieStop ? ':tie-stop' : '';
    return `${n.pitch}/${n.beats}/${n.type || '?'}${dots}${accidental}${tie}`;
  }).join(' ');
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

function stripRepeatedClef(measureXml) {
  return measureXml.replace(/\s*<clef>[\s\S]*?<\/clef>/g, '');
}

function round3(n) {
  return +n.toFixed(3);
}

function assert(condition, message) {
  if (!condition) errors.push(message);
}
