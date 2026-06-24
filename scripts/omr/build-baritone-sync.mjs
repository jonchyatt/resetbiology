// build-baritone-sync.mjs
// Plumb: Baritone plunk sync from the VERIFIED score, PURE-NOTATION timing (no audio).
//
// timing = startBeat × 60/bpm straight off public/musicxml/lida-rose-baritone.musicxml,
// at the SAME shared contract tempo as the Lead so the two voices stay aligned when sung
// together. The audio-isolation machinery (BasicPitch dominant/no-baritone diff, tempo-sane
// anchor DP, conductor pruning) and the stale `!== 106` hardcode are GONE. Output shape is
// unchanged: {pitchMidi, startTimeSeconds, durationSeconds}.
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
const PART = contract.parts.find((p) => p.name === 'Baritone');
const BARITONE_XML = path.join(RBW, PART.musicxml);
const OUT = path.join(RBW, 'public', 'musicxml', 'lida-rose-baritone-sync.json');
const RECONCILED_OUT = path.join(RBW, 'public', 'musicxml', 'lida-rose-baritone-reconciled.json');
const SOURCE = 'pure-notation timing from verified MusicXML (no audio)';

const bpm = resolveTempoBpm(contract);
const xml = fs.readFileSync(BARITONE_XML, 'utf8');
const events = scoreEventsFromXml(xml);
const notes = buildNotationNotes(events, bpm);
const reconciledNotes = reconciledFromNotes(events, notes);
const durationSec = totalDurationSec(events, bpm);

// ── self-verify: count + pitch == verified score + dead-on grid (the gate, embedded) ──
const errors = [];
if (PART.expectedNotes != null && notes.length !== PART.expectedNotes) {
  errors.push(`expected ${PART.expectedNotes} Baritone notes, got ${notes.length}`);
}
const xmlPitches = gateScorePitches(xml);
const pitchK = notes.findIndex((n, i) => n.pitchMidi !== xmlPitches[i]);
if (xmlPitches.length !== notes.length || pitchK >= 0) {
  errors.push(`pitch != verified score: xml ${xmlPitches.length} vs sync ${notes.length}` +
    (pitchK >= 0 ? ` @${pitchK}: ${noteName(xmlPitches[pitchK])} vs ${noteName(notes[pitchK]?.pitchMidi)}` : ''));
}
const timing = notationTimingCheck(notes, reconciledNotes, bpm);
if (!timing.ok) errors.push(`timing not dead-on grid: ${timing.detail}`);

const totalBeats = round3(events.reduce((s, e) => Math.max(s, e.startBeat + e.beats), 0));
const audit = {
  method: 'pure-notation timing: start = startBeat × 60/bpm from verified MusicXML; no audio, no anchors',
  tempoBpm: bpm,
  secondsPerBeat: round3(60 / bpm),
  totalBeats,
  noteCount: notes.length,
  pitchRange: `${noteName(Math.min(...notes.map((n) => n.pitchMidi)))}-${noteName(Math.max(...notes.map((n) => n.pitchMidi)))}`,
  notationTiming: timing,
};

const payload = {
  song: 'Lida Rose', part: 'Baritone', source: SOURCE,
  tempoBpm: bpm, durationSec, noteCount: notes.length, audit, notes,
};
const reconciled = {
  song: 'Lida Rose', part: 'Baritone', method: audit.method,
  tempoBpm: bpm, noteCount: notes.length, audit, notes: reconciledNotes,
};

fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 1)}\n`);
fs.writeFileSync(RECONCILED_OUT, `${JSON.stringify(reconciled, null, 1)}\n`);

console.log(`Baritone pure-notation ${notes.length} notes (${audit.pitchRange}) @ ${bpm}bpm | ${totalBeats} beats -> ${durationSec}s`);
console.log(`grid: ${timing.detail}`);
console.log('first 16:', notes.slice(0, 16).map((n) => `${n.startTimeSeconds}${noteName(n.pitchMidi)}`).join(' '));
console.log('last 16:', notes.slice(-16).map((n, i) => `${notes.length - 15 + i}:${n.startTimeSeconds}${noteName(n.pitchMidi)}`).join(' '));
if (errors.length) {
  console.error('VERIFY FAILED:\n  ' + errors.join('\n  '));
  process.exit(1);
}
console.log(`OK -> wrote ${path.relative(RBW, OUT)} and ${path.relative(RBW, RECONCILED_OUT)}`);
