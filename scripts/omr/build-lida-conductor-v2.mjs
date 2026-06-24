// build-lida-conductor-v2.mjs
// Plumb: the v2 sync the app actually fetches (syncV2Url -> the plunk; reconciledV2Url ->
// the visual lane; healthV2Url -> the badge). PURE-NOTATION timing, identical to v1 by
// construction — both parts derive from their verified MusicXML at the SAME shared contract
// tempo, so "Lead-led shared conductor" is automatic (one grid, no audio anchors, no
// cross-part tolerance windows). The old DTW/anchor/prune machinery is gone.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import contract from './songs/lida-rose.song.mjs';
import {
  scoreEventsFromXml, gateScorePitches, resolveTempoBpm, buildNotationNotes,
  totalDurationSec, reconciledFromNotes, notationTimingCheck, noteName, round3,
} from './score-timing.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RBW = path.join(__dirname, '..', '..');
const PUBLIC = path.join(RBW, 'public', 'musicxml');
const GENERATED_AT = new Date().toISOString();
const V2_SOURCE = 'score-conductor-v2 shared Lead-led pure-notation timing from corrected score (no audio)';

const bpm = resolveTempoBpm(contract);
const PARTS = [
  { part: 'Lead', slug: 'lead' },
  { part: 'Baritone', slug: 'baritone' },
];

const errors = [];
const summary = [];

for (const cfg of PARTS) {
  const partContract = contract.parts.find((p) => p.name === cfg.part);
  const xml = fs.readFileSync(path.join(RBW, partContract.musicxml), 'utf8');
  const events = scoreEventsFromXml(xml);
  const notes = buildNotationNotes(events, bpm);
  const reconciledNotes = reconciledFromNotes(events, notes);
  const durationSec = totalDurationSec(events, bpm);

  // pitch == verified score (the gate, embedded) + dead-on grid
  const xmlPitches = gateScorePitches(xml);
  const pitchK = notes.findIndex((n, i) => n.pitchMidi !== xmlPitches[i]);
  if (xmlPitches.length !== notes.length || pitchK >= 0) {
    errors.push(`${cfg.part}: v2 pitch != verified score @${pitchK} (${noteName(xmlPitches[pitchK])} vs ${noteName(notes[pitchK]?.pitchMidi)})`);
  }
  if (partContract.expectedNotes != null && notes.length !== partContract.expectedNotes) {
    errors.push(`${cfg.part}: v2 expected ${partContract.expectedNotes} notes, got ${notes.length}`);
  }
  const timing = notationTimingCheck(notes, reconciledNotes, bpm);
  if (!timing.ok) errors.push(`${cfg.part}: v2 timing not dead-on grid: ${timing.detail}`);

  const audit = {
    method: 'pure-notation timing (shared contract tempo); both parts on one grid, no audio',
    conductorVersion: 'lida-rose-conductor-v2-notation',
    source: V2_SOURCE,
    tempoBpm: bpm,
    secondsPerBeat: round3(60 / bpm),
    noteCount: notes.length,
    notationTiming: timing,
  };
  const syncPayload = {
    song: 'Lida Rose', part: cfg.part, source: V2_SOURCE,
    tempoBpm: bpm, durationSec, noteCount: notes.length, audit, notes,
  };
  const reconciledPayload = {
    song: 'Lida Rose', part: cfg.part, method: audit.method,
    tempoBpm: bpm, noteCount: notes.length, audit, notes: reconciledNotes,
  };

  fs.writeFileSync(path.join(PUBLIC, `lida-rose-${cfg.slug}-sync-v2.json`), `${JSON.stringify(syncPayload, null, 1)}\n`);
  fs.writeFileSync(path.join(PUBLIC, `lida-rose-${cfg.slug}-reconciled-v2.json`), `${JSON.stringify(reconciledPayload, null, 1)}\n`);
  fs.writeFileSync(path.join(PUBLIC, `lida-rose-${cfg.slug}-score-health-v2.json`), `${JSON.stringify(buildHealthV2(cfg, syncPayload, reconciledPayload, timing), null, 1)}\n`);

  summary.push({ part: cfg.part, notes: notes.length, durationSec, timingOk: timing.ok });
}

// small provenance file
fs.writeFileSync(path.join(PUBLIC, 'lida-rose-conductor-v2.json'), `${JSON.stringify({
  song: 'Lida Rose',
  version: 'lida-rose-conductor-v2-notation',
  generatedAt: GENERATED_AT,
  source: V2_SOURCE,
  primaryPart: 'Lead',
  tempoBpm: bpm,
  secondsPerBeat: round3(60 / bpm),
  parts: summary,
}, null, 1)}\n`);

for (const s of summary) {
  console.log(`${s.part} v2 pure-notation ${s.notes} notes -> ${s.durationSec}s @ ${bpm}bpm | dead-on grid ${s.timingOk}`);
}
if (errors.length) {
  console.error('CONDUCTOR-V2 VERIFY FAILED:\n  ' + errors.join('\n  '));
  process.exit(1);
}
console.log(`OK -> wrote lida-rose-{lead,baritone}-{sync,reconciled,score-health}-v2.json + conductor-v2.json @ ${bpm}bpm`);

// Carry the v1 health verdict forward (source-side checks are about the musicxml, identical
// for v1/v2) and re-evaluate the notation-timing check for the v2 grid.
function buildHealthV2(cfg, syncPayload, reconciledPayload, timing) {
  const v1Path = path.join(PUBLIC, `lida-rose-${cfg.slug}-score-health.json`);
  const health = JSON.parse(fs.readFileSync(v1Path, 'utf8'));
  health.generatedAt = GENERATED_AT;
  health.scoreVersion = `${health.scoreVersion}-notation-v2`;
  health.sync = {
    noteCount: syncPayload.notes.length,
    reconciledCount: reconciledPayload.notes.length,
    source: syncPayload.source,
    tempoBpm: bpm,
    secondsPerBeat: round3(60 / bpm),
    notationTiming: timing,
  };
  let found = false;
  health.checks = (health.checks || []).map((check) => {
    if (check.id !== 'notation-timing') return check;
    found = true;
    return { ...check, status: timing.ok ? 'pass' : 'fail', detail: timing.detail };
  });
  if (!found) {
    health.checks.push({ id: 'notation-timing', label: 'Pure-notation timing', status: timing.ok ? 'pass' : 'fail', detail: timing.detail });
  }
  return health;
}
