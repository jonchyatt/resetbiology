// score-timing.mjs
// Plumb's single source of timing truth: pure-notation timing for the VT3 sync builders.
//
// The verified MusicXML is the ONLY input. Pitches come straight from the score; timing
// is derived deterministically from <duration>/<divisions> at a constant contract tempo —
// NO audio, NO onset anchors, NO rubato. (Research synthesis §0: MusicXML <duration> is
// authoritative for timing and is ALREADY tuplet-adjusted; <type>/<time-modification> are
// display-only.) This module is the floor of truth every builder stands on; if it is wrong,
// the gate (verify-plunk-from-score.mjs) catches it before anything locks.

const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NM = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function noteName(m) {
  return Number.isFinite(m) ? NM[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1) : '∅';
}

export function pitchMidi(step, alter, octave) {
  return (octave + 1) * 12 + SEMI[step] + alter;
}

export function round3(n) {
  return Number.isFinite(n) ? +n.toFixed(3) : null;
}

export function round6(n) {
  return Number.isFinite(n) ? +n.toFixed(6) : null;
}

// Melodic score events in playback order, straight off the verified MusicXML.
// Same melodic filter the gate uses (skip <rest>, skip <chord>): every emitted event
// is exactly one plunk tone. startBeat/beats are in quarter-note units (the engraving
// build normalizes <divisions> to 12). Rests advance the beat cursor but emit nothing.
export function scoreEventsFromXml(xml) {
  const events = [];
  let beat = 0;
  let divisions = 12;
  for (const measureMatch of xml.matchAll(/<measure number="(\d+)"[\s\S]*?<\/measure>/g)) {
    const measure = Number(measureMatch[1]);
    const measureXml = measureMatch[0];
    const divMatch = measureXml.match(/<divisions>(\d+)<\/divisions>/);
    if (divMatch) divisions = Number(divMatch[1]);
    for (const noteMatch of measureXml.matchAll(/<note\b[\s\S]*?<\/note>/g)) {
      const noteXml = noteMatch[0];
      if (/<chord\s*\/?\s*>/.test(noteXml)) continue;
      const dur = Number((noteXml.match(/<duration>(\d+)<\/duration>/) || [])[1] || 0);
      const beats = dur / divisions;
      if (/<rest\b/.test(noteXml)) {
        beat += beats;
        continue;
      }
      const pitch = noteXml.match(/<pitch>[\s\S]*?<step>([A-G])<\/step>[\s\S]*?(?:<alter>(-?\d+)<\/alter>[\s\S]*?)?<octave>(\d+)<\/octave>[\s\S]*?<\/pitch>/);
      if (!pitch) {
        beat += beats;
        continue;
      }
      events.push({
        measure,
        midi: pitchMidi(pitch[1], pitch[2] ? Number(pitch[2]) : 0, Number(pitch[3])),
        startBeat: round6(beat),
        beats: round6(beats),
      });
      beat += beats;
    }
  }
  return events;
}

// EXACT verbatim mirror of verify-plunk-from-score.mjs `scorePitches` — the gate's
// melodic pitch sequence off the verified score. Builders assert their notes equal this,
// so any divergence between this module's parser and the gate is caught at BUILD time,
// not discovered later at gate time.
export function gateScorePitches(xml) {
  const inner = xml.slice(xml.indexOf('<part'), xml.lastIndexOf('</part>'));
  const out = [];
  for (const ch of inner.split(/<note[ >]/).slice(1)) {
    if (/<rest\b/.test(ch)) continue;
    if (/<chord\s*\/?>/.test(ch)) continue;
    const pm = ch.match(/<step>([A-G])<\/step>\s*(?:<alter>(-?\d+)<\/alter>\s*)?<octave>(\d+)<\/octave>/);
    if (!pm) continue;
    out.push((Number(pm[3]) + 1) * 12 + SEMI[pm[1]] + (pm[2] ? Number(pm[2]) : 0));
  }
  return out;
}

// Tempo is golden-truth, read once into the song contract — NEVER silently defaulted.
// (Synthesis tempo-trap: music21/OSMD/etc. fabricate 120 bpm when a score omits <sound
// tempo>; our MusicXML has no tempo at all.) Throw loudly so a score can't be onboarded
// without an explicit, human-verified tempo.
export function resolveTempoBpm(contract) {
  const bpm = contract && Number(contract.tempoBpm);
  if (!Number.isFinite(bpm) || bpm <= 0) {
    throw new Error(
      `[score-timing] ${contract?.id ?? 'song'} contract has no valid tempoBpm — ` +
      'pure-notation timing requires an explicit tempo (no audio, no 120-bpm default).',
    );
  }
  return bpm;
}

// THE timing function. Every note's start + duration is pure notation at a constant tempo:
//   start = startBeat × 60/bpm,  duration = beats × 60/bpm.
// No audio, no anchors, no rubato — so the metronome is dead-on by construction. Durations
// are clamped so a note never bleeds past the next note's onset (the final note keeps its
// full written length). Output shape {pitchMidi, startTimeSeconds, durationSeconds} is the
// contract every downstream consumer (plunk scheduler, cursor, ScoreEngraving) already reads.
export function buildNotationNotes(events, bpm) {
  const spb = 60 / bpm;
  const notes = events.map((event) => ({
    pitchMidi: event.midi,
    startTimeSeconds: round3(event.startBeat * spb),
    durationSeconds: round3(Math.max(0.08, event.beats * spb)),
  }));
  for (let i = 0; i < notes.length; i++) {
    const nextStart = i < notes.length - 1
      ? notes[i + 1].startTimeSeconds
      : notes[i].startTimeSeconds + notes[i].durationSeconds;
    if (notes[i].startTimeSeconds + notes[i].durationSeconds > nextStart) {
      notes[i].durationSeconds = round3(Math.max(0.08, nextStart - notes[i].startTimeSeconds));
    }
  }
  return notes;
}

// End of the last note, in seconds — the song's pure-notation duration.
export function totalDurationSec(events, bpm) {
  if (!events.length) return 0;
  const spb = 60 / bpm;
  const last = events[events.length - 1];
  return round3((last.startBeat + last.beats) * spb);
}

// Reconciled notes carry score provenance (measure / scoreBeat / scoreBeats) for the
// visual practice lane + the health "dead-on grid" check. src is 'score-notation' — the
// audio-conductor 'conductor-anchor' / 'score-conductor' markers are gone for good.
export function reconciledFromNotes(events, notes) {
  return notes.map((note, index) => ({
    ...note,
    measure: events[index].measure,
    scoreBeat: events[index].startBeat,
    scoreBeats: events[index].beats,
    src: 'score-notation',
  }));
}

// Shared notation-timing gate used by the health builders + verify-vt3-plunk-sync.
// Proves the sync is the pure-notation grid: monotonic, and every note lands exactly on
// round3(scoreBeat × 60/bpm). Returns { ok, detail, offBy } — no audio numbers involved.
export function notationTimingCheck(syncNotes, reconciledNotes, bpm) {
  const spb = 60 / bpm;
  let offGrid = 0;
  let firstOff = null;
  let monotonic = true;
  for (let i = 0; i < syncNotes.length; i++) {
    const note = syncNotes[i];
    const rec = reconciledNotes[i];
    if (i > 0 && note.startTimeSeconds < syncNotes[i - 1].startTimeSeconds) monotonic = false;
    const expected = round3((rec?.scoreBeat ?? 0) * spb);
    if (!rec || note.startTimeSeconds !== expected) {
      offGrid++;
      if (firstOff === null) firstOff = `@${i}: ${note.startTimeSeconds}s vs grid ${expected}s`;
    }
  }
  const ok = monotonic && offGrid === 0 && syncNotes.length === reconciledNotes.length;
  return {
    ok,
    offBy: offGrid,
    detail: `bpm=${bpm}; spb=${round3(spb)}; monotonic=${monotonic}; offGrid=${offGrid}/${syncNotes.length}` +
      (firstOff ? `; first ${firstOff}` : ''),
  };
}
