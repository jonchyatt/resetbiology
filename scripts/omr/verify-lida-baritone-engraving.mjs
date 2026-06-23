// verify-lida-baritone-engraving.mjs
// Fast gate for the generated Lida Rose Baritone VT3 artifacts.
import fs from 'fs';
import { EXPECTED_BARITONE_NOTE_COUNT, BARITONE_SCORE_VERSION } from './lida-baritone-printed-manifest.mjs';
import { PRINTED_FIFTHS } from './lida-lead-key-normalize.mjs';

const XML = 'public/musicxml/lida-rose-baritone.musicxml';
const HEALTH = 'public/musicxml/lida-rose-baritone-score-health.json';
const SYNC = 'public/musicxml/lida-rose-baritone-sync.json';
const RECONCILED = 'public/musicxml/lida-rose-baritone-reconciled.json';
const NOTE_MAP = 'public/musicxml/lida-rose-baritone-note-map.json';

const xml = fs.readFileSync(XML, 'utf8');
const health = readJson(HEALTH);
const sync = readJson(SYNC);
const reconciled = readJson(RECONCILED);
const noteMap = readJson(NOTE_MAP);
const errors = [];

const fifths = [...new Set([...xml.matchAll(/<fifths>(-?\d+)<\/fifths>/g)].map((m) => Number(m[1])))];
const pitched = [...xml.matchAll(/<note\b[\s\S]*?<\/note>/g)]
  .filter((m) => /<pitch>/.test(m[0]) && !/<rest\b/.test(m[0]) && !/<chord\s*\/?\s*>/.test(m[0]));

if (!fifths.length || fifths.some((f) => f !== PRINTED_FIFTHS)) errors.push(`unexpected key fifths ${fifths.join(',') || 'none'}`);
if (pitched.length !== EXPECTED_BARITONE_NOTE_COUNT) errors.push(`pitched notes ${pitched.length}, expected ${EXPECTED_BARITONE_NOTE_COUNT}`);
if (health.scoreVersion !== BARITONE_SCORE_VERSION) errors.push(`health scoreVersion ${health.scoreVersion}, expected ${BARITONE_SCORE_VERSION}`);
if (health.noteCount !== EXPECTED_BARITONE_NOTE_COUNT) errors.push(`health noteCount ${health.noteCount}`);
if (!Array.isArray(health.checks) || health.checks.some((c) => c.status !== 'pass')) errors.push(`health checks failing ${JSON.stringify(health.checks)}`);
if ((sync.notes || []).length !== EXPECTED_BARITONE_NOTE_COUNT) errors.push(`sync notes ${(sync.notes || []).length}`);
if ((reconciled.notes || []).length !== EXPECTED_BARITONE_NOTE_COUNT) errors.push(`reconciled notes ${(reconciled.notes || []).length}`);
if ((noteMap.notes || []).length !== EXPECTED_BARITONE_NOTE_COUNT) errors.push(`note-map notes ${(noteMap.notes || []).length}`);
if (!/score-conductor/i.test(sync.source || '')) errors.push(`sync source is not score-conductor: ${sync.source || 'missing'}`);
if ((health.sync?.conductorAnchors ?? 0) < 20) errors.push(`conductorAnchors too low: ${health.sync?.conductorAnchors ?? 'missing'}`);
if ((health.sync?.tempoSmoothness?.scoreConductor?.p90RateJumpSecPerBeat ?? 99) > 0.5) errors.push(`conductor timing too jittery: ${JSON.stringify(health.sync?.tempoSmoothness?.scoreConductor)}`);
if ((health.sync?.leadTimeline ?? 0) !== 0) errors.push(`leadTimeline sync notes remain: ${health.sync?.leadTimeline}`);
if (!(noteMap.notes || []).every((n) => typeof n.phraseLabel === 'string' && n.phraseLabel.length > 0)) {
  errors.push('note-map has missing phrase labels');
}

if (errors.length) {
  console.error('BARITONE ENGRAVING VERIFY FAILED');
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}

console.log('BARITONE ENGRAVING VERIFY PASS');
console.log(`key: fifths ${fifths.join(',')}`);
console.log(`pitched notes: ${pitched.length}`);
console.log(`sync: ${(sync.notes || []).length}; note-map: ${(noteMap.notes || []).length}`);
console.log(`score conductor: anchors ${health.sync?.conductorAnchors}; notes ${health.sync?.scoreConductorNotes}; p90 jump ${health.sync?.tempoSmoothness?.scoreConductor?.p90RateJumpSecPerBeat}; isolated ${health.sync?.isolatedOnsets}`);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
