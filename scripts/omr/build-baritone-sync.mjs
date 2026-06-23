// build-baritone-sync.mjs
// Builds Baritone recording timestamps from isolated Baritone audio evidence.
// The Baritone template has no embedded note extraction, so the repeatable input
// is BasicPitch run over Baritone-dominant and no-Baritone stems, then differenced.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RBW = path.join(__dirname, '..', '..');
const BARITONE_XML = path.join(RBW, 'public', 'musicxml', 'lida-rose-baritone.musicxml');
const LEAD_XML = path.join(RBW, 'public', 'musicxml', 'lida-rose-lead.musicxml');
const LEAD_SYNC = path.join(RBW, 'public', 'musicxml', 'lida-rose-lead-sync.json');
const OUT = path.join(RBW, 'public', 'musicxml', 'lida-rose-baritone-sync.json');
const RECONCILED_OUT = path.join(RBW, 'public', 'musicxml', 'lida-rose-baritone-reconciled.json');
const BARITONE_TEMPLATE_URL = 'https://vv03sd8jufykivax.public.blob.vercel-storage.com/vocal-trainer/1781240808729-baritone-lida-rose-baritone-dominant/template.json';
const FALLBACK_DURATION_SEC = 83.289977;
const DEFAULT_AUDIO_STAGE = 'C:/Users/jonch/Projects/jarvis/data/vocal-trainer/runtime-logs/baritone-audio';
const AUDIO_STAGE = process.env.BARITONE_AUDIO_STAGE || DEFAULT_AUDIO_STAGE;
const DOMINANT_NOTES = path.join(AUDIO_STAGE, 'baritone-dominant.notes.json');
const NO_BARITONE_NOTES = path.join(AUDIO_STAGE, 'no-baritone.notes.json');

const CONFIG = {
  rangePadSemitones: 2,
  dominantAmpMin: 0.3,
  noBaritoneAmpMin: 0.21,
  subtractionWindowSec: 0.18,
  subtractionPitchClassDistance: 0,
  mergeGapSec: 0.12,
  minAudioAnchors: 70,
  minIsolatedOnsets: 120,
};

const NM = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const nm = (m) => NM[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);

const leadEvents = scoreEventsFromXml(fs.readFileSync(LEAD_XML, 'utf8'));
const baritoneEvents = scoreEventsFromXml(fs.readFileSync(BARITONE_XML, 'utf8'));
const leadSync = JSON.parse(fs.readFileSync(LEAD_SYNC, 'utf8')).notes || [];
if (leadEvents.length !== leadSync.length) {
  throw new Error(`Lead timeline mismatch: leadEvents=${leadEvents.length} leadSync=${leadSync.length}`);
}

const durationSec = await templateDuration();
const leadGridSync = buildLeadGridBaritoneSync(leadEvents, leadSync, baritoneEvents, durationSec);
const dominantNotes = readNoteFile(DOMINANT_NOTES);
const noBaritoneNotes = readNoteFile(NO_BARITONE_NOTES);
const isolatedOnsets = isolateBaritoneOnsets(dominantNotes, noBaritoneNotes, baritoneEvents);
const anchors = selectTempoSaneAnchors(isolatedOnsets, baritoneEvents, leadGridSync);
const anchorsByScoreIndex = new Map(anchors.map((anchor) => [anchor.scoreIndex, anchor]));

if (isolatedOnsets.length < CONFIG.minIsolatedOnsets) {
  throw new Error(`Baritone isolation too sparse: ${isolatedOnsets.length} onsets`);
}
if (anchors.length < CONFIG.minAudioAnchors) {
  throw new Error(`Baritone audio anchors too sparse: ${anchors.length}`);
}

const sync = baritoneEvents.map((event, index) => {
  const anchor = anchorsByScoreIndex.get(index);
  const start = anchor ? anchor.time : mapBeat(event.startBeat, anchors);
  const end = mapBeat(event.startBeat + event.beats, anchors);
  return {
    pitchMidi: event.midi,
    startTimeSeconds: round3(Math.max(0, start)),
    durationSeconds: round3(Math.max(0.08, end - start)),
  };
});

for (let i = 0; i < sync.length; i++) {
  const nextStart = i < sync.length - 1 ? sync[i + 1].startTimeSeconds : durationSec;
  if (sync[i].startTimeSeconds + sync[i].durationSeconds > nextStart) {
    sync[i].durationSeconds = round3(Math.max(0.08, nextStart - sync[i].startTimeSeconds));
  }
}

const timingDelta = timingDeltaSummary(sync, leadGridSync);
const monotonic = sync.every((s, i) => i === 0 || s.startTimeSeconds >= sync[i - 1].startTimeSeconds);
const errors = [];
if (sync.length !== 106) errors.push(`expected 106 Baritone notes, got ${sync.length}`);
if (!monotonic) errors.push('sync is not monotonic');
if (sync[sync.length - 1].startTimeSeconds > durationSec + 0.5) errors.push('last note exceeds Baritone recording duration');

const audit = {
  method: 'BaritoneDominant minus NoBaritone BasicPitch isolation; exact-pitch monotonic anchors with tempo-slope sanity gate; score-rhythm interpolation between anchors',
  audioStage: AUDIO_STAGE,
  dominantRawNotes: dominantNotes.length,
  noBaritoneRawNotes: noBaritoneNotes.length,
  isolatedOnsets: isolatedOnsets.length,
  audioAnchors: anchors.length,
  audioInterpolated: sync.length - anchors.length,
  pitchRange: `${nm(Math.min(...sync.map((n) => n.pitchMidi)))}-${nm(Math.max(...sync.map((n) => n.pitchMidi)))}`,
  timingDeltaFromLeadGrid: timingDelta,
  config: CONFIG,
};

const payload = {
  song: 'Lida Rose',
  part: 'Baritone',
  source: 'isolated Baritone audio sync from BaritoneDominant-NoBaritone BasicPitch anchors',
  durationSec,
  noteCount: sync.length,
  audit,
  notes: sync,
};
const reconciled = {
  song: 'Lida Rose',
  part: 'Baritone',
  method: audit.method,
  noteCount: sync.length,
  audit,
  notes: sync.map((note, index) => {
    const event = baritoneEvents[index];
    const anchor = anchorsByScoreIndex.get(index);
    return {
      ...note,
      measure: event.measure,
      scoreBeat: event.startBeat,
      scoreBeats: event.beats,
      src: anchor ? 'audio-confirmed' : 'audio-interpolated',
      ...(anchor ? {
        audioPitchMidi: anchor.audioPitchMidi,
        audioStartTimeSeconds: round3(anchor.time),
        audioAmplitude: round3(anchor.amplitude),
      } : {}),
    };
  }),
};

fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 1)}\n`);
fs.writeFileSync(RECONCILED_OUT, `${JSON.stringify(reconciled, null, 1)}\n`);

console.log(`Baritone score ${sync.length} (${audit.pitchRange}) | audio anchors ${anchors.length}/${sync.length} | isolated onsets ${isolatedOnsets.length}`);
console.log(`span ${sync[0].startTimeSeconds}s -> ${sync[sync.length - 1].startTimeSeconds}s | duration ${durationSec.toFixed(3)}s | monotonic ${monotonic}`);
console.log(`delta vs old Lead grid: mean ${timingDelta.meanAbsSec}s | max ${timingDelta.maxAbsSec}s @ note ${timingDelta.maxAbsNote} | final ${timingDelta.finalNoteDeltaSec}s`);
console.log('first 16 notes:', sync.slice(0, 16).map((s) => `${s.startTimeSeconds}${nm(s.pitchMidi)}`).join(' '));
console.log('last 16 notes:', sync.slice(-16).map((s, i) => `${sync.length - 15 + i}:${s.startTimeSeconds}${nm(s.pitchMidi)}`).join(' '));
if (errors.length) {
  console.error('VERIFY FAILED:\n  ' + errors.join('\n  '));
  process.exit(1);
}
console.log(`OK -> wrote ${path.relative(RBW, OUT)} and ${path.relative(RBW, RECONCILED_OUT)}`);

function readNoteFile(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing BasicPitch note file: ${file}`);
  }
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  const notes = Array.isArray(parsed) ? parsed : parsed.notes;
  if (!Array.isArray(notes)) throw new Error(`BasicPitch note file has no note array: ${file}`);
  return notes
    .filter((n) => Number.isFinite(n.pitchMidi) && Number.isFinite(n.startTimeSeconds) && Number.isFinite(n.durationSeconds))
    .map((n) => ({
      pitchMidi: Number(n.pitchMidi),
      startTimeSeconds: Number(n.startTimeSeconds),
      durationSeconds: Number(n.durationSeconds),
      amplitude: Number.isFinite(n.amplitude) ? Number(n.amplitude) : 0,
    }))
    .sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
}

function isolateBaritoneOnsets(dominant, noBaritone, scoreEvents) {
  const scoreMin = Math.min(...scoreEvents.map((e) => e.midi));
  const scoreMax = Math.max(...scoreEvents.map((e) => e.midi));
  const lo = scoreMin - CONFIG.rangePadSemitones;
  const hi = scoreMax + CONFIG.rangePadSemitones;
  const backing = noBaritone.filter((n) =>
    n.amplitude >= CONFIG.noBaritoneAmpMin &&
    n.pitchMidi >= lo &&
    n.pitchMidi <= hi
  );
  const isolated = dominant
    .filter((n) =>
      n.amplitude >= CONFIG.dominantAmpMin &&
      n.pitchMidi >= lo &&
      n.pitchMidi <= hi
    )
    .filter((note) => !hasBackingTwin(note, backing));
  return mergeFragments(isolated);
}

function hasBackingTwin(note, backing) {
  for (const other of backing) {
    if (other.startTimeSeconds < note.startTimeSeconds - CONFIG.subtractionWindowSec) continue;
    if (other.startTimeSeconds > note.startTimeSeconds + CONFIG.subtractionWindowSec) break;
    if (pitchClassDistance(other.pitchMidi, note.pitchMidi) <= CONFIG.subtractionPitchClassDistance) {
      return true;
    }
  }
  return false;
}

function mergeFragments(notes) {
  const out = [];
  for (const note of notes) {
    const prev = out[out.length - 1];
    if (
      prev &&
      prev.pitchMidi === note.pitchMidi &&
      note.startTimeSeconds <= prev.startTimeSeconds + prev.durationSeconds + CONFIG.mergeGapSec
    ) {
      const end = Math.max(prev.startTimeSeconds + prev.durationSeconds, note.startTimeSeconds + note.durationSeconds);
      prev.durationSeconds = end - prev.startTimeSeconds;
      prev.amplitude = Math.max(prev.amplitude, note.amplitude);
    } else {
      out.push({ ...note });
    }
  }
  return out;
}

function selectTempoSaneAnchors(audio, scoreEvents, leadGrid) {
  const candidates = [];
  for (let scoreIndex = 0; scoreIndex < scoreEvents.length; scoreIndex++) {
    for (let audioIndex = 0; audioIndex < audio.length; audioIndex++) {
      if (scoreEvents[scoreIndex].midi !== audio[audioIndex].pitchMidi) continue;
      candidates.push({
        scoreIndex,
        audioIndex,
        beat: scoreEvents[scoreIndex].startBeat,
        time: audio[audioIndex].startTimeSeconds,
        amplitude: audio[audioIndex].amplitude,
        audioPitchMidi: audio[audioIndex].pitchMidi,
      });
    }
  }
  candidates.sort((a, b) => a.scoreIndex - b.scoreIndex || a.audioIndex - b.audioIndex);

  const best = new Float64Array(candidates.length);
  const prev = new Int32Array(candidates.length);
  prev.fill(-1);
  for (let k = 0; k < candidates.length; k++) {
    const current = candidates[k];
    best[k] = anchorReward(current, leadGrid);
    for (let p = 0; p < k; p++) {
      const prior = candidates[p];
      if (prior.scoreIndex >= current.scoreIndex || prior.audioIndex >= current.audioIndex) continue;
      const rate = segmentRate(prior, current);
      if (!Number.isFinite(rate) || !rateAllowed(rate, current.beat - prior.beat)) continue;

      const priorRate = leadGridSegmentRate(leadGrid, prior.scoreIndex, current.scoreIndex);
      const smoothPenalty = Math.min(4, Math.abs(Math.log(rate / Math.max(0.12, priorRate))) * 0.6);
      const skipPenalty = 0.08 * (current.scoreIndex - prior.scoreIndex - 1) + 0.006 * (current.audioIndex - prior.audioIndex - 1);
      const candidateScore = best[p] + anchorReward(current, leadGrid) - smoothPenalty - skipPenalty;
      if (candidateScore > best[k]) {
        best[k] = candidateScore;
        prev[k] = p;
      }
    }
  }

  let end = 0;
  for (let k = 1; k < candidates.length; k++) {
    if (best[k] > best[end]) end = k;
  }
  const out = [];
  for (let k = end; k >= 0; k = prev[k]) {
    out.push(candidates[k]);
    if (prev[k] < 0) break;
  }
  return out.reverse();
}

function anchorReward(anchor, leadGrid) {
  const leadTime = leadGrid[anchor.scoreIndex]?.startTimeSeconds ?? anchor.time;
  return 10 + Math.min(2, anchor.amplitude * 2) - 0.02 * Math.abs(leadTime - anchor.time);
}

function segmentRate(a, b) {
  const beatDelta = b.beat - a.beat;
  const timeDelta = b.time - a.time;
  if (beatDelta <= 0 || timeDelta <= 0) return NaN;
  return timeDelta / beatDelta;
}

function rateAllowed(rate, beatDelta) {
  const min = beatDelta >= 1.5 ? 0.25 : 0.16;
  const max = beatDelta >= 4 ? 2.4 : 2.0;
  return rate >= min && rate <= max;
}

function leadGridSegmentRate(leadGrid, fromScoreIndex, toScoreIndex) {
  const from = leadGrid[fromScoreIndex];
  const to = leadGrid[toScoreIndex];
  if (!from || !to) return 0.75;
  const beatDelta = to.scoreBeat - from.scoreBeat;
  const timeDelta = to.startTimeSeconds - from.startTimeSeconds;
  return beatDelta > 0 && timeDelta > 0 ? timeDelta / beatDelta : 0.75;
}

function buildLeadGridBaritoneSync(leadScoreEvents, leadScoreSync, baritoneScoreEvents, durationSec) {
  const anchors = leadScoreEvents
    .map((event, index) => ({
      beat: event.startBeat,
      time: leadScoreSync[index].startTimeSeconds,
    }))
    .filter((anchor, index, arr) => index === 0 || anchor.beat > arr[index - 1].beat);
  const notes = baritoneScoreEvents.map((event) => ({
    pitchMidi: event.midi,
    scoreBeat: event.startBeat,
    startTimeSeconds: round3(Math.max(0, mapBeat(event.startBeat, anchors))),
    durationSeconds: round3(Math.max(0.08, mapBeat(event.startBeat + event.beats, anchors) - mapBeat(event.startBeat, anchors))),
  }));
  for (let i = 0; i < notes.length; i++) {
    const nextStart = i < notes.length - 1 ? notes[i + 1].startTimeSeconds : durationSec;
    if (notes[i].startTimeSeconds + notes[i].durationSeconds > nextStart) {
      notes[i].durationSeconds = round3(Math.max(0.08, nextStart - notes[i].startTimeSeconds));
    }
  }
  return notes;
}

function mapBeat(beat, anchors) {
  if (anchors.length < 2) return beat;
  if (beat <= anchors[0].beat) return extrapolateBeat(beat, anchors[0], anchors[1]);
  const last = anchors[anchors.length - 1];
  if (beat >= last.beat) return extrapolateBeat(beat, anchors[anchors.length - 2], last);
  let hi = 1;
  while (hi < anchors.length && anchors[hi].beat < beat) hi++;
  const lo = anchors[hi - 1];
  const next = anchors[hi];
  const span = next.beat - lo.beat || 1;
  return lo.time + ((beat - lo.beat) / span) * (next.time - lo.time);
}

function extrapolateBeat(beat, a, b) {
  const rate = (b.time - a.time) / ((b.beat - a.beat) || 1);
  return a.time + (beat - a.beat) * rate;
}

function timingDeltaSummary(sync, baseline) {
  const deltas = sync.map((note, index) => round3(note.startTimeSeconds - baseline[index].startTimeSeconds));
  const abs = deltas.map(Math.abs);
  let maxIndex = 0;
  for (let i = 1; i < abs.length; i++) {
    if (abs[i] > abs[maxIndex]) maxIndex = i;
  }
  return {
    meanAbsSec: round3(abs.reduce((sum, n) => sum + n, 0) / abs.length),
    maxAbsSec: round3(abs[maxIndex]),
    maxAbsNote: maxIndex + 1,
    finalNoteDeltaSec: deltas[deltas.length - 1],
  };
}

async function templateDuration() {
  try {
    const template = await (await fetch(BARITONE_TEMPLATE_URL)).json();
    return Number(template.durationSec) || FALLBACK_DURATION_SEC;
  } catch (e) {
    console.log(`Baritone duration fetch failed (${e.message}); using fallback`);
    return FALLBACK_DURATION_SEC;
  }
}

function scoreEventsFromXml(xml) {
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
        startBeat: beat,
        beats,
      });
      beat += beats;
    }
  }
  return events;
}

function pitchMidi(step, alter, octave) {
  const semi = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  return (octave + 1) * 12 + semi[step] + alter;
}

function pitchClassDistance(a, b) {
  const diff = Math.abs((a - b) % 12);
  return Math.min(diff, 12 - diff);
}

function round3(n) {
  return +n.toFixed(3);
}
