// build-baritone-score-health.mjs
// Emits the VT3 score-health + note-map artifacts for Lida Rose Baritone.
import fs from 'fs';
import { normalizeLeadMeasure, PRINTED_FIFTHS } from './lida-lead-key-normalize.mjs';
import { applyLeadMeasureCorrections } from './lida-lead-source-corrections.mjs';
import {
  BARITONE_SCORE_VERSION,
  EXPECTED_BARITONE_NOTE_COUNT,
  PRINTED_BARITONE_AUDIT_MEASURES,
  pageForBaritoneMeasure,
} from './lida-baritone-printed-manifest.mjs';

const XML = 'public/musicxml/lida-rose-baritone.musicxml';
const SYNC = 'public/musicxml/lida-rose-baritone-sync.json';
const RECONCILED = 'public/musicxml/lida-rose-baritone-reconciled.json';
const PHRASES = 'public/musicxml/lida-rose-baritone-phrases.json';
const OUT = 'public/musicxml/lida-rose-baritone-score-health.json';
const NOTE_MAP_OUT = 'public/musicxml/lida-rose-baritone-note-map.json';
const PAGES = [
  { page: '196', file: 'scripts/omr/source/lida-196.xml', staff: 'P4' },
  { page: '197', file: 'scripts/omr/source/lida-197.xml', staff: 'P3' },
  { page: '198', file: 'scripts/omr/source/lida-198.xml', staff: 'P3' },
];

const xml = fs.readFileSync(XML, 'utf8');
const sync = readJson(SYNC);
const reconciled = readJson(RECONCILED);
const phraseManifest = fs.existsSync(PHRASES) ? readJson(PHRASES) : { phrases: [] };
const expected = expectedFromPages(PAGES, 'Baritone');
const actual = extractMeasurePitches(xml);
const actualWhole = extractWholeNotes(xml);
const noteMap = extractNoteMap(xml, phraseManifest.phrases || []);
const fifths = [...new Set([...xml.matchAll(/<fifths>(-?\d+)<\/fifths>/g)].map((m) => Number(m[1])))];
const noteCount = Object.values(actual).reduce((sum, notes) => sum + notes.length, 0);
const checks = [];

checks.push(check(
  'key-fifths',
  'Printed key',
  PRINTED_FIFTHS === -6 && fifths.length > 0 && fifths.every((f) => f === PRINTED_FIFTHS),
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
  noteCount === expected.noteCount && noteCount === EXPECTED_BARITONE_NOTE_COUNT,
  `expected ${expected.noteCount}; got ${noteCount}`,
));

const printedAuditErrors = comparePrintedAudit(xml);
checks.push(check(
  'printed-score-audit',
  'Printed/source audit',
  printedAuditErrors.length === 0,
  printedAuditErrors.length ? printedAuditErrors.join(' | ') : `${PRINTED_BARITONE_AUDIT_MEASURES.length} Baritone audit measures match`,
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

const conductorAnchors = reconciledNotes.filter((n) => n.src === 'conductor-anchor').length;
const scoreConductorNotes = reconciledNotes.filter((n) => n.src === 'score-conductor').length;
const leadTimeline = reconciledNotes.filter((n) => n.src === 'lead-timeline').length;
const conductorTempo = sync.audit?.tempoSmoothness?.scoreConductor;
checks.push(check(
  'score-conductor-sync',
  'Score-conductor Baritone sync',
  /score-conductor/i.test(sync.source || '') &&
    leadTimeline === 0 &&
    conductorAnchors >= 20 &&
    conductorAnchors + scoreConductorNotes === noteCount &&
    Number(conductorTempo?.p90RateJumpSecPerBeat ?? 99) <= 0.5,
  `conductorAnchors=${conductorAnchors}; scoreConductor=${scoreConductorNotes}; leadTimeline=${leadTimeline}; p90Jump=${conductorTempo?.p90RateJumpSecPerBeat ?? 'n/a'}; isolated=${sync.audit?.isolatedOnsets ?? 'n/a'}`,
));

const payload = {
  song: 'Lida Rose',
  part: 'Baritone',
  scoreVersion: BARITONE_SCORE_VERSION,
  sourcePages: PAGES.map((p) => `${p.page}:${p.staff}`),
  generatedAt: new Date().toISOString(),
  keyFifths: -6,
  noteCount,
  wholeNotes: actualWhole,
  sync: {
    noteCount: syncNotes.length,
    reconciledCount: reconciledNotes.length,
    source: sync.source || null,
    audioEvidenceAnchors: sync.audit?.audioEvidenceAnchors ?? null,
    conductorAnchors,
    scoreConductorNotes,
    leadTimeline,
    isolatedOnsets: sync.audit?.isolatedOnsets ?? null,
    tempoSmoothness: sync.audit?.tempoSmoothness ?? null,
    timingDeltaFromLeadGrid: sync.audit?.timingDeltaFromLeadGrid ?? null,
  },
  checks,
};

fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 1)}\n`);
fs.writeFileSync(NOTE_MAP_OUT, `${JSON.stringify({
  song: 'Lida Rose',
  part: 'Baritone',
  scoreVersion: payload.scoreVersion,
  generatedAt: payload.generatedAt,
  notes: noteMap,
}, null, 1)}\n`);
console.log(`wrote ${OUT}`);
console.log(`wrote ${NOTE_MAP_OUT}`);
for (const c of checks) console.log(`${c.status.toUpperCase()} ${c.id}: ${c.detail}`);
if (checks.some((c) => c.status !== 'pass')) process.exit(1);

function check(id, label, passed, detail) {
  return { id, label, status: passed ? 'pass' : 'fail', detail };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function expectedFromPages(pages, partName) {
  const pitchesByMeasure = {};
  const wholeNotes = [];
  let outMeasure = 0;

  for (const page of pages) {
    const sourceXml = fs.readFileSync(page.file, 'utf8');
    const part = getPartInner(sourceXml, page.staff);
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
        page: pageForBaritoneMeasure(measure),
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

function comparePrintedAudit(xmlText) {
  const measureNotes = extractMeasureNotes(xmlText);
  const errors = [];
  for (const audit of PRINTED_BARITONE_AUDIT_MEASURES) {
    const got = measureNotes[String(audit.measure)] || [];
    const gotSummary = got.map(noteSummary).join(' ');
    const expectedSummary = audit.notes.map(noteSummary).join(' ');
    if (gotSummary !== expectedSummary) {
      errors.push(`m${audit.measure}: expected [${expectedSummary}], got [${gotSummary}] (${audit.source})`);
    }
  }
  return errors;
}

function extractMeasureNotes(xmlText) {
  const out = {};
  for (const measureMatch of xmlText.matchAll(/<measure number="(\d+)"[\s\S]*?<\/measure>/g)) {
    const divisions = Number((measureMatch[0].match(/<divisions>(\d+)<\/divisions>/) || [])[1] || 12);
    const notes = [];
    for (const noteMatch of measureMatch[0].matchAll(/<note\b[\s\S]*?<\/note>/g)) {
      const noteXml = noteMatch[0];
      if (/<rest\b/.test(noteXml) || /<chord\s*\/?\s*>/.test(noteXml)) continue;
      const pitch = extractPitchesFromMeasure(noteXml)[0];
      if (!pitch) continue;
      const duration = Number((noteXml.match(/<duration>(\d+)<\/duration>/) || [])[1] || 0);
      const type = (noteXml.match(/<type>([^<]+)<\/type>/) || [])[1] || '';
      const dots = (noteXml.match(/<dot\s*\/>/g) || []).length;
      notes.push({ pitch, beats: duration / divisions, type, ...(dots ? { dots } : {}) });
    }
    if (notes.length) out[measureMatch[1]] = notes;
  }
  return out;
}

function noteSummary(note) {
  const dots = note.dots ? `.${note.dots}` : '';
  return `${note.pitch}:${note.beats}:${note.type}${dots}`;
}
