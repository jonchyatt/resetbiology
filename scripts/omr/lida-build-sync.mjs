import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import contract from './songs/lida-rose.song.mjs';
import {
  scoreEventsFromXml,
  gateScorePitches,
  resolveTempoBpm,
  buildNotationNotes,
  totalDurationSec,
  reconciledFromNotes,
  notationTimingCheck,
  noteName,
  round3,
} from './score-timing.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

export function buildLidaPartSync({ part, slug, localStemPath = null, libraryTemplateUrl = null }) {
  const partCfg = contract.parts.find((p) => p.name === part);
  if (!partCfg) throw new Error(`missing ${part} in lida-rose.song.mjs`);

  const xmlPath = path.join(ROOT, partCfg.musicxml);
  const out = path.join(ROOT, 'public', 'musicxml', `lida-rose-${slug}-sync.json`);
  const reconciledOut = path.join(ROOT, 'public', 'musicxml', `lida-rose-${slug}-reconciled.json`);
  const stemExists = localStemPath ? fs.existsSync(localStemPath) : false;
  const verificationStatus = libraryTemplateUrl ? 'VERIFIED' : 'UNVERIFIED';
  const source = libraryTemplateUrl
    ? `score timing reconciled against ${part} library template`
    : 'pure-notation timing from verified MusicXML (UNVERIFIED: no committed audio library template URL)';

  const bpm = resolveTempoBpm(contract);
  const xml = fs.readFileSync(xmlPath, 'utf8');
  const events = scoreEventsFromXml(xml);
  const notes = buildNotationNotes(events, bpm);
  const reconciledNotes = reconciledFromNotes(events, notes);
  const durationSec = totalDurationSec(events, bpm);

  const errors = [];
  if (partCfg.expectedNotes != null && notes.length !== partCfg.expectedNotes) {
    errors.push(`expected ${partCfg.expectedNotes} ${part} notes, got ${notes.length}`);
  }
  const xmlPitches = gateScorePitches(xml);
  const pitchK = notes.findIndex((n, i) => n.pitchMidi !== xmlPitches[i]);
  if (xmlPitches.length !== notes.length || pitchK >= 0) {
    errors.push(`pitch != verified score: xml ${xmlPitches.length} vs sync ${notes.length}` +
      (pitchK >= 0 ? ` @${pitchK}: ${noteName(xmlPitches[pitchK])} vs ${noteName(notes[pitchK]?.pitchMidi)}` : ''));
  }
  const timing = notationTimingCheck(notes, reconciledNotes, bpm);
  if (!timing.ok) errors.push(`timing not dead-on grid: ${timing.detail}`);

  const totalBeats = round3(events.reduce((sum, event) => Math.max(sum, event.startBeat + event.beats), 0));
  const audit = {
    method: libraryTemplateUrl
      ? 'score timing reconciled against committed library template'
      : 'pure-notation timing: start = startBeat x 60/bpm from verified MusicXML; no committed audio template',
    verificationStatus,
    tempoBpm: bpm,
    secondsPerBeat: round3(60 / bpm),
    totalBeats,
    noteCount: notes.length,
    pitchRange: `${noteName(Math.min(...notes.map((n) => n.pitchMidi)))}-${noteName(Math.max(...notes.map((n) => n.pitchMidi)))}`,
    notationTiming: timing,
    audioStem: {
      localPath: localStemPath,
      localExists: stemExists,
      libraryTemplateUrl,
      note: libraryTemplateUrl
        ? 'committed library template URL available'
        : 'local stem exists but no committed template/onset artifact was available in this repo',
    },
  };

  const payload = {
    song: 'Lida Rose',
    part,
    source,
    verificationStatus,
    tempoBpm: bpm,
    durationSec,
    noteCount: notes.length,
    audit,
    notes,
  };
  const reconciled = {
    song: 'Lida Rose',
    part,
    method: audit.method,
    verificationStatus,
    tempoBpm: bpm,
    noteCount: notes.length,
    audit,
    notes: reconciledNotes,
  };

  fs.writeFileSync(out, `${JSON.stringify(payload, null, 1)}\n`);
  fs.writeFileSync(reconciledOut, `${JSON.stringify(reconciled, null, 1)}\n`);

  console.log(`${part} ${verificationStatus} score-rhythm ${notes.length} notes (${audit.pitchRange}) @ ${bpm}bpm | ${totalBeats} beats -> ${durationSec}s`);
  console.log(`grid: ${timing.detail}`);
  console.log(`audio stem: ${stemExists ? localStemPath : 'not found'} | library template: ${libraryTemplateUrl || 'none committed'}`);
  console.log('first 16:', notes.slice(0, 16).map((n) => `${n.startTimeSeconds}${noteName(n.pitchMidi)}`).join(' '));
  console.log('last 16:', notes.slice(-16).map((n, i) => `${notes.length - 15 + i}:${n.startTimeSeconds}${noteName(n.pitchMidi)}`).join(' '));
  if (errors.length) {
    console.error('VERIFY FAILED:\n  ' + errors.join('\n  '));
    process.exit(1);
  }
  console.log(`OK -> wrote ${path.relative(ROOT, out)} and ${path.relative(ROOT, reconciledOut)}`);
}
