// verify-vt3-plunk-sync.mjs
// Proves VT3 plunk tones are sourced from the corrected score sync files.
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

const PARTS = [
  {
    part: 'Lead',
    slug: 'lead',
    expectedNoteCount: EXPECTED_LEAD_NOTE_COUNT,
    scoreVersion: LEAD_SCORE_VERSION,
  },
  {
    part: 'Baritone',
    slug: 'baritone',
    expectedNoteCount: EXPECTED_BARITONE_NOTE_COUNT,
    scoreVersion: BARITONE_SCORE_VERSION,
  },
];

const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const nameOf = (midi) => ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][midi % 12] + (Math.floor(midi / 12) - 1);
const errors = [];

const vt3 = fs.readFileSync(VT3, 'utf8');
assert(/fetch\(lidaRoseScorePart\.syncUrl/.test(vt3), 'plunk loader must fetch lidaRoseScorePart.syncUrl');
assert(/syncUrl=\{lidaRoseScorePart\.syncUrl\}/.test(vt3), 'ScoreEngraving must receive the same selected-part syncUrl');
assert(/startPlunkScheduler/.test(vt3), 'plunk must use the rolling scheduler path');
assert(!/plunkGainRef\.current\s*=\s*gain;[\s\S]{0,120}gain\.connect\(ctx\.destination\)/.test(vt3),
  'plunk gain should route through the limiter, not directly to destination');

for (const cfg of PARTS) {
  const xml = fs.readFileSync(path.join(PUBLIC, `lida-rose-${cfg.slug}.musicxml`), 'utf8');
  const sync = JSON.parse(fs.readFileSync(path.join(PUBLIC, `lida-rose-${cfg.slug}-sync.json`), 'utf8'));
  const health = JSON.parse(fs.readFileSync(path.join(PUBLIC, `lida-rose-${cfg.slug}-score-health.json`), 'utf8'));
  const xmlPitches = melodicPitches(xml);
  const syncNotes = sync.notes || [];

  assert(health.scoreVersion === cfg.scoreVersion,
    `${cfg.part}: health scoreVersion ${health.scoreVersion} != ${cfg.scoreVersion}`);
  assert(health.noteCount === cfg.expectedNoteCount,
    `${cfg.part}: health noteCount ${health.noteCount} != ${cfg.expectedNoteCount}`);
  assert(syncNotes.length === cfg.expectedNoteCount,
    `${cfg.part}: sync note count ${syncNotes.length} != ${cfg.expectedNoteCount}`);
  assert(xmlPitches.length === cfg.expectedNoteCount,
    `${cfg.part}: XML pitch count ${xmlPitches.length} != ${cfg.expectedNoteCount}`);
  if (cfg.part === 'Baritone') {
    assert(/isolated Baritone audio/i.test(sync.source || ''),
      `${cfg.part}: plunk sync must use audio-derived Baritone timing, got ${sync.source || 'missing source'}`);
    assert((health.sync?.audioConfirmed ?? 0) >= 70,
      `${cfg.part}: audio-confirmed sync count too low: ${health.sync?.audioConfirmed ?? 'missing'}`);
  }

  for (let i = 0; i < syncNotes.length; i++) {
    const note = syncNotes[i];
    assert(Number.isFinite(note.pitchMidi), `${cfg.part}: sync[${i}] missing pitchMidi`);
    assert(Number.isFinite(note.startTimeSeconds), `${cfg.part}: sync[${i}] missing startTimeSeconds`);
    assert(Number.isFinite(note.durationSeconds) && note.durationSeconds > 0,
      `${cfg.part}: sync[${i}] invalid durationSeconds`);
    if (i > 0) {
      assert(note.startTimeSeconds >= syncNotes[i - 1].startTimeSeconds,
        `${cfg.part}: sync is not monotonic at ${i}`);
    }
    if (note.pitchMidi !== xmlPitches[i]) {
      errors.push(`${cfg.part}: sync pitch mismatch @${i + 1}: ${nameOf(note.pitchMidi)} vs XML ${nameOf(xmlPitches[i])}`);
      break;
    }
  }

  console.log(`${cfg.part} plunk sync PASS: ${syncNotes.length} notes, scoreVersion=${health.scoreVersion}`);
}

if (errors.length) {
  console.error('PLUNK SYNC VERIFY FAILED:\n  ' + errors.join('\n  '));
  process.exit(1);
}
console.log('VT3 plunk source PASS: selected score sync drives both plunk and engraving');

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
