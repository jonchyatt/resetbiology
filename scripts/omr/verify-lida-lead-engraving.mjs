// verify-lida-lead-engraving.mjs
// Checks the generated VT3 Lead engraving against the normalized source parts.
// This is intentionally structural: key signature, source pitch spelling,
// whole-note survival, and page/system-break safety all have to pass before the
// MusicXML is trusted by OSMD.
import fs from 'fs';
import { normalizeLeadMeasure, PRINTED_FIFTHS } from './lida-lead-key-normalize.mjs';
import { applyLeadMeasureCorrections } from './lida-lead-source-corrections.mjs';
import {
  EXPECTED_LEAD_NOTE_COUNT,
  LEAD_SECTION_TRANSITIONS,
  PRINTED_LEAD_AUDIT_MEASURES,
} from './lida-lead-printed-manifest.mjs';

const XML = 'public/musicxml/lida-rose-lead.musicxml';
const SYNC = 'public/musicxml/lida-rose-lead-sync.json';
const RECONCILED = 'public/musicxml/lida-rose-lead-reconciled.json';
const PAGES = [
  { page: '196', file: 'scripts/omr/source/lida-196.xml', lead: 'P3' },
  { page: '197', file: 'scripts/omr/source/lida-197.xml', lead: 'P2' },
  { page: '198', file: 'scripts/omr/source/lida-198.xml', lead: 'P2' },
];

const xml = fs.readFileSync(XML, 'utf8');
const sync = JSON.parse(fs.readFileSync(SYNC, 'utf8'));
const reconciled = JSON.parse(fs.readFileSync(RECONCILED, 'utf8'));
const expected = expectedFromSource();
const actual = extractMeasurePitches(xml);
const actualWhole = extractWholeNotes(xml);
const fifths = [...new Set([...xml.matchAll(/<fifths>(-?\d+)<\/fifths>/g)].map((m) => Number(m[1])))];
const allowedFifths = new Set([PRINTED_FIFTHS, ...LEAD_SECTION_TRANSITIONS.map((t) => t.nextKeyFifths)]);

const errors = [];
if (PRINTED_FIFTHS !== -6) errors.push(`normalizer must target six flats (-6), got ${PRINTED_FIFTHS}`);
if (!fifths.length || fifths.some((f) => !allowedFifths.has(f))) {
  errors.push(`unexpected fifths: got ${fifths.join(',') || 'none'}, allowed ${[...allowedFifths].join(',')}`);
}

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
if (noteCount !== EXPECTED_LEAD_NOTE_COUNT) errors.push(`printed manifest expects ${EXPECTED_LEAD_NOTE_COUNT} pitched notes, got ${noteCount}`);

const syncNotes = Array.isArray(sync.notes) ? sync.notes : [];
const reconciledNotes = Array.isArray(reconciled.notes) ? reconciled.notes : [];
const conductorAnchors = reconciledNotes.filter((n) => n.src === 'conductor-anchor').length;
const scoreConductorNotes = reconciledNotes.filter((n) => n.src === 'score-conductor').length;
if (!/score-conductor/i.test(sync.source || '')) errors.push(`sync source is not score-conductor: ${sync.source || 'missing'}`);
if (syncNotes.length !== noteCount || reconciledNotes.length !== noteCount) {
  errors.push(`sync count mismatch: sync=${syncNotes.length}; reconciled=${reconciledNotes.length}; score=${noteCount}`);
}
if (conductorAnchors < 20) errors.push(`conductorAnchors too low: ${conductorAnchors}`);
if (conductorAnchors + scoreConductorNotes !== noteCount) {
  errors.push(`score-conductor note accounting mismatch: anchors=${conductorAnchors}; scoreConductor=${scoreConductorNotes}; score=${noteCount}`);
}
if ((sync.audit?.tempoSmoothness?.scoreConductor?.p90RateJumpSecPerBeat ?? 99) > 0.5) {
  errors.push(`conductor timing too jittery: ${JSON.stringify(sync.audit?.tempoSmoothness?.scoreConductor)}`);
}

for (const err of comparePrintedAudit(xml)) errors.push(err);

if (errors.length) {
  console.error('ENGRAVING VERIFY FAILED');
  for (const err of errors) console.error(`  ${err}`);
  process.exit(1);
}

console.log('ENGRAVING VERIFY PASS');
console.log(`key: fifths allowed ${[...allowedFifths].join(',')}`);
console.log(`pitched notes: ${noteCount}`);
console.log(`whole notes: ${gotWhole.join(' ') || '(none)'}`);
console.log(`printed audit: ${PRINTED_LEAD_AUDIT_MEASURES.length} measures`);
console.log(`score conductor: anchors ${conductorAnchors}; notes ${scoreConductorNotes}; p90 jump ${sync.audit?.tempoSmoothness?.scoreConductor?.p90RateJumpSecPerBeat}; isolated ${sync.audit?.isolatedOnsets}`);
console.log(`source pages: ${PAGES.map((p) => `${p.page}:${p.lead}`).join(' ')}`);

function expectedFromSource() {
  const pitchesByMeasure = {};
  const wholeNotes = [];
  let outMeasure = 0;

  for (const page of PAGES) {
    const sourceXml = fs.readFileSync(page.file, 'utf8');
    const part = getPartInner(sourceXml, page.lead);
    const divisions = Number((part.match(/<divisions>(\d+)<\/divisions>/) || [])[1] || 1);
    const measures = applyLeadMeasureCorrections(
      page.page,
      part.match(/<measure\b[\s\S]*?<\/measure>/g) || [],
      { part: 'Lead', divisions },
    );
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

function comparePrintedAudit(xmlText) {
  const measureNotes = extractMeasureNotes(xmlText);
  const errors = [];
  for (const audit of PRINTED_LEAD_AUDIT_MEASURES) {
    const got = measureNotes[String(audit.measure)] || [];
    const gotSummary = got.map(noteSummary).join(' ');
    const expectedSummary = audit.notes.map(noteSummary).join(' ');
    if (gotSummary !== expectedSummary) {
      errors.push(`m${audit.measure}: printed score expected [${expectedSummary}], got [${gotSummary}] (${audit.source})`);
    }
    const measureXml = getMeasureXml(xmlText, audit.measure);
    for (const required of audit.requiredXml || []) {
      if (!measureXml.includes(required)) {
        errors.push(`m${audit.measure}: missing printed notation ${required} (${audit.source})`);
      }
    }
  }
  return errors;
}

function getMeasureXml(xmlText, measure) {
  return xmlText.match(new RegExp(`<measure number="${measure}"[\\s\\S]*?<\\/measure>`))?.[0] || '';
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
