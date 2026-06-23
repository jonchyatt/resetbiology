// verify-lida-conductor-v2.mjs
// Hard gate for the VT3 Lida Rose shared conductor lane.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  EXPECTED_LEAD_NOTE_COUNT,
  LEAD_SCORE_VERSION,
} from './lida-lead-printed-manifest.mjs';
import {
  BARITONE_SCORE_VERSION,
  EXPECTED_BARITONE_NOTE_COUNT,
} from './lida-baritone-printed-manifest.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const PUBLIC = path.join(ROOT, 'public', 'musicxml');
const VT3 = path.join(ROOT, 'src', 'components', 'PitchDefender', 'VocalTrainerIII.tsx');
const errors = [];
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const PARTS = [
  {
    part: 'Lead',
    slug: 'lead',
    expectedNoteCount: EXPECTED_LEAD_NOTE_COUNT,
    scoreVersion: LEAD_SCORE_VERSION,
    maxMeanShiftSec: 0.05,
    maxShiftSec: 0.1,
  },
  {
    part: 'Baritone',
    slug: 'baritone',
    expectedNoteCount: EXPECTED_BARITONE_NOTE_COUNT,
    scoreVersion: BARITONE_SCORE_VERSION,
    minMeanShiftSec: 2.5,
    minFinalEarlierSec: 4,
  },
];

const conductor = readJson(path.join(PUBLIC, 'lida-rose-conductor-v2.json'));
assert(conductor.version === 'lida-rose-conductor-v2', `unexpected conductor version ${conductor.version}`);
assert(conductor.primaryPart === 'Lead', `conductor-v2 must be Lead-led, got ${conductor.primaryPart}`);
assert((conductor.masterAnchors ?? 0) >= 20, `conductor-v2 too sparse: ${conductor.masterAnchors}`);
assert((conductor.tempoSmoothness?.scoreConductor?.p90RateJumpSecPerBeat ?? 99) <= 0.5,
  `conductor-v2 p90 jump too high: ${JSON.stringify(conductor.tempoSmoothness)}`);
assert((conductor.tempoSmoothness?.scoreConductor?.maxRateJumpSecPerBeat ?? 99) <= 0.45,
  `conductor-v2 max jump too high: ${JSON.stringify(conductor.tempoSmoothness)}`);
const rejectedLateBaritone = (conductor.rejectedPartAnchors || []).filter((a) => a.part === 'Baritone' && a.measure >= 9);
assert(rejectedLateBaritone.length >= 10, `expected late Baritone anchors to be rejected, got ${rejectedLateBaritone.length}`);

for (const cfg of PARTS) {
  const xml = fs.readFileSync(path.join(PUBLIC, `lida-rose-${cfg.slug}.musicxml`), 'utf8');
  const currentSync = readJson(path.join(PUBLIC, `lida-rose-${cfg.slug}-sync.json`));
  const sync = readJson(path.join(PUBLIC, `lida-rose-${cfg.slug}-sync-v2.json`));
  const reconciled = readJson(path.join(PUBLIC, `lida-rose-${cfg.slug}-reconciled-v2.json`));
  const health = readJson(path.join(PUBLIC, `lida-rose-${cfg.slug}-score-health-v2.json`));
  const xmlPitches = melodicPitches(xml);
  const syncNotes = sync.notes || [];
  const reconciledNotes = reconciled.notes || [];

  assert(sync.source === 'score-conductor-v2 shared Lead-led timing from corrected score rhythm',
    `${cfg.part}: wrong v2 source ${sync.source || 'missing'}`);
  assert(syncNotes.length === cfg.expectedNoteCount,
    `${cfg.part}: sync-v2 notes ${syncNotes.length} != ${cfg.expectedNoteCount}`);
  assert(reconciledNotes.length === cfg.expectedNoteCount,
    `${cfg.part}: reconciled-v2 notes ${reconciledNotes.length} != ${cfg.expectedNoteCount}`);
  assert(xmlPitches.length === cfg.expectedNoteCount,
    `${cfg.part}: XML pitches ${xmlPitches.length} != ${cfg.expectedNoteCount}`);
  assert(health.scoreVersion === `${cfg.scoreVersion}-conductor-v2`,
    `${cfg.part}: v2 health scoreVersion ${health.scoreVersion}`);
  assert(health.noteCount === cfg.expectedNoteCount,
    `${cfg.part}: v2 health noteCount ${health.noteCount}`);
  assert(Array.isArray(health.checks) && health.checks.every((c) => c.status === 'pass'),
    `${cfg.part}: v2 health checks failing: ${JSON.stringify(health.checks)}`);

  for (let i = 0; i < syncNotes.length; i++) {
    const note = syncNotes[i];
    assert(note.pitchMidi === xmlPitches[i],
      `${cfg.part}: pitch mismatch note ${i + 1}: sync ${note.pitchMidi}, XML ${xmlPitches[i]}`);
    assert(Number.isFinite(note.startTimeSeconds), `${cfg.part}: note ${i + 1} missing startTimeSeconds`);
    assert(Number.isFinite(note.durationSeconds) && note.durationSeconds > 0,
      `${cfg.part}: note ${i + 1} invalid durationSeconds ${note.durationSeconds}`);
    if (i > 0) {
      assert(note.startTimeSeconds >= syncNotes[i - 1].startTimeSeconds,
        `${cfg.part}: v2 sync is not monotonic at note ${i + 1}`);
    }
  }

  const smooth = sync.audit?.tempoSmoothness?.scoreConductor;
  assert((smooth?.p90RateJumpSecPerBeat ?? 99) <= 0.5,
    `${cfg.part}: v2 p90 jump too high ${JSON.stringify(smooth)}`);
  assert((smooth?.maxRateJumpSecPerBeat ?? 99) <= 0.45,
    `${cfg.part}: v2 max jump too high ${JSON.stringify(smooth)}`);
  const delta = sync.audit?.timingDeltaFromCurrent;
  if (cfg.part === 'Lead') {
    assert((delta?.meanAbsSec ?? 99) <= cfg.maxMeanShiftSec,
      `${cfg.part}: v2 should preserve Lead grid, delta ${JSON.stringify(delta)}`);
    assert((delta?.maxAbsSec ?? 99) <= cfg.maxShiftSec,
      `${cfg.part}: v2 shifted Lead too far, delta ${JSON.stringify(delta)}`);
  } else {
    assert((delta?.meanAbsSec ?? 0) >= cfg.minMeanShiftSec,
      `${cfg.part}: v2 did not materially move late grid, delta ${JSON.stringify(delta)}`);
    assert((delta?.finalNoteDeltaSec ?? 0) <= -cfg.minFinalEarlierSec,
      `${cfg.part}: v2 final note was not corrected earlier, delta ${JSON.stringify(delta)}`);
    assert((sync.audit?.rejectedPartAnchors ?? 0) >= 10,
      `${cfg.part}: expected rejected noisy anchors, got ${sync.audit?.rejectedPartAnchors}`);
  }
  assert((currentSync.notes || []).map((n) => n.pitchMidi).join(',') === syncNotes.map((n) => n.pitchMidi).join(','),
    `${cfg.part}: v2 changed pitch order versus current sync`);

  console.log(`${cfg.part} conductor-v2 PASS: ${syncNotes.length} notes, p90/max ${smooth.p90RateJumpSecPerBeat}/${smooth.maxRateJumpSecPerBeat}, delta ${JSON.stringify(delta)}`);
}

const vt3 = fs.readFileSync(VT3, 'utf8');
assert(/scoreTimingMode/.test(vt3), 'VT3 must expose scoreTimingMode');
assert(/syncV2Url/.test(vt3), 'VT3 must register syncV2Url files');
assert(/activeLidaRoseScorePart/.test(vt3), 'VT3 must route active score part through selected timing lane');

if (errors.length) {
  console.error('CONDUCTOR V2 VERIFY FAILED:\n  ' + errors.join('\n  '));
  process.exit(1);
}
console.log(`Conductor v2 PASS: masterAnchors=${conductor.masterAnchors}, rejectedLateBaritone=${rejectedLateBaritone.length}`);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function melodicPitches(xml) {
  return [...xml.matchAll(/<note\b[\s\S]*?<\/note>/g)]
    .map((m) => m[0])
    .filter((note) => /<pitch>/.test(note) && !/<rest\b/.test(note) && !/<chord\s*\/?\s*>/.test(note))
    .map((note) => {
      const pitch = note.match(/<step>([A-G])<\/step>\s*(?:<alter>(-?\d+)<\/alter>\s*)?<octave>(\d+)<\/octave>/);
      if (!pitch) throw new Error(`unparseable pitch note: ${note.slice(0, 120)}`);
      return (Number(pitch[3]) + 1) * 12 + SEMI[pitch[1]] + (pitch[2] ? Number(pitch[2]) : 0);
    });
}

function assert(condition, message) {
  if (!condition) errors.push(message);
}
