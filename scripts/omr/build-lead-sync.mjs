// build-lead-sync.mjs
// Builds Lead recording timestamps from the corrected score rhythm plus
// measure-level LeadDominant-NoLead audio evidence. The score is the conductor;
// extracted audio is only timing evidence.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pruneTempoCliffAnchors } from './timing-grid.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RBW = path.join(__dirname, '..', '..');
const LEAD_XML = path.join(RBW, 'public', 'musicxml', 'lida-rose-lead.musicxml');
const OUT = path.join(RBW, 'public', 'musicxml', 'lida-rose-lead-sync.json');
const RECONCILED_OUT = path.join(RBW, 'public', 'musicxml', 'lida-rose-lead-reconciled.json');
const BLOB = 'https://vv03sd8jufykivax.public.blob.vercel-storage.com/vocal-trainer';
const LD_URL = `${BLOB}/1781240825294-lead-lida-rose-lead-dominant/template.json`;
const NL_URL = `${BLOB}/1781240827136-lead-lida-rose-no-lead/template.json`;
const STAGE = 'C:/Users/jonch/Projects/jarvis/data/vocal-trainer/runtime-logs';

const CONFIG = {
  rangePadSemitones: 1,
  subtractionWindowSec: 0.35,
  subtractionPitchClassDistance: 1,
  mergeGapSec: 0.12,
  skipAudioCost: 0.7,
  sharedOnsetPenalty: 1.1,
  minIsolatedOnsets: 100,
  minAudioEvidenceAnchors: 80,
  minConductorAnchors: 18,
  maxConductorP90RateJump: 0.5,
  maxConductorMaxRateJump: 0.45,
  conductorMinSegmentSecPerBeat: 0.35,
  conductorMaxSegmentSecPerBeat: 1.08,
  conductorMaxAdjacentRateJump: 0.38,
};

const NM = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const nm = (m) => NM[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);

const scoreEvents = scoreEventsFromXml(fs.readFileSync(LEAD_XML, 'utf8'));
const scoreMin = Math.min(...scoreEvents.map((n) => n.midi));
const scoreMax = Math.max(...scoreEvents.map((n) => n.midi));
const { leadDominant, noLead, durationSec } = await loadTemplates();
const isolatedOnsets = isolateLeadOnsets(leadDominant, noLead, scoreEvents);
const audioEvidenceAnchors = alignScoreToAudio(scoreEvents, isolatedOnsets);
const audioEvidenceByScoreIndex = new Map(audioEvidenceAnchors.map((anchor) => [anchor.scoreIndex, anchor]));

if (isolatedOnsets.length < CONFIG.minIsolatedOnsets) {
  throw new Error(`Lead isolation too sparse: ${isolatedOnsets.length} onsets`);
}
if (audioEvidenceAnchors.length < CONFIG.minAudioEvidenceAnchors) {
  throw new Error(`Lead audio evidence too sparse: ${audioEvidenceAnchors.length} anchors`);
}

const noteLevelAudioSync = buildSyncFromAnchors(scoreEvents, audioEvidenceAnchors, durationSec);
const rawConductorAnchors = selectConductorAnchors(audioEvidenceAnchors, scoreEvents);
const conductorPrune = pruneTempoCliffAnchors(rawConductorAnchors, {
  minSegmentSecPerBeat: CONFIG.conductorMinSegmentSecPerBeat,
  maxSegmentSecPerBeat: CONFIG.conductorMaxSegmentSecPerBeat,
  maxAdjacentRateJump: CONFIG.conductorMaxAdjacentRateJump,
});
const conductorAnchors = conductorPrune.anchors;
const conductorByScoreIndex = new Map(conductorAnchors.map((anchor) => [anchor.scoreIndex, anchor]));
const sync = buildSyncFromAnchors(scoreEvents, conductorAnchors, durationSec);
const noteLevelSmoothness = tempoSmoothness(noteLevelAudioSync, scoreEvents);
const conductorSmoothness = tempoSmoothness(sync, scoreEvents);
const timingDelta = timingDeltaSummary(sync, noteLevelAudioSync);

if (conductorAnchors.length < CONFIG.minConductorAnchors) {
  throw new Error(`Lead conductor anchors too sparse: ${conductorAnchors.length}`);
}
if (conductorSmoothness.p90RateJumpSecPerBeat > CONFIG.maxConductorP90RateJump) {
  throw new Error(`Lead conductor grid is still too jittery: p90 jump ${conductorSmoothness.p90RateJumpSecPerBeat}`);
}
if (conductorSmoothness.maxRateJumpSecPerBeat > CONFIG.maxConductorMaxRateJump) {
  throw new Error(`Lead conductor grid has a tempo cliff: max jump ${conductorSmoothness.maxRateJumpSecPerBeat}`);
}

const monotonic = sync.every((s, i) => i === 0 || s.startTimeSeconds >= sync[i - 1].startTimeSeconds);
const errors = [];
if (sync.length !== scoreEvents.length) errors.push(`expected ${scoreEvents.length} Lead notes, got ${sync.length}`);
if (!monotonic) errors.push('sync is not monotonic');
if (sync[sync.length - 1].startTimeSeconds > durationSec + 0.5) errors.push('last note exceeds Lead recording duration');

const audit = {
  method: 'score-conductor grid: LeadDominant-NoLead audio evidence downsampled to measure-level anchors; every note regenerated from score rhythm between anchors',
  leadDominantRawNotes: leadDominant.length,
  noLeadRawNotes: noLead.length,
  isolatedOnsets: isolatedOnsets.length,
  audioEvidenceAnchors: audioEvidenceAnchors.length,
  rawConductorAnchors: rawConductorAnchors.length,
  conductorAnchors: conductorAnchors.length,
  removedConductorAnchors: conductorPrune.removed,
  scoreConductorNotes: sync.length - conductorAnchors.length,
  pitchRange: `${nm(scoreMin)}-${nm(scoreMax)}`,
  tempoSmoothness: {
    noteLevelAudio: noteLevelSmoothness,
    scoreConductor: conductorSmoothness,
  },
  timingDeltaFromNoteLevelAudio: timingDelta,
  config: CONFIG,
};

const payload = {
  song: 'Lida Rose',
  part: 'Lead',
  source: 'score-conductor Lead timing from score rhythm plus measure-level isolated-audio anchors',
  durationSec,
  noteCount: sync.length,
  audit,
  notes: sync,
};
const reconciled = {
  song: 'Lida Rose',
  part: 'Lead',
  method: audit.method,
  noteCount: sync.length,
  audit,
  notes: sync.map((note, index) => {
    const event = scoreEvents[index];
    const audioAnchor = audioEvidenceByScoreIndex.get(index);
    return {
      ...note,
      measure: event.measure,
      scoreBeat: event.startBeat,
      scoreBeats: event.beats,
      src: conductorByScoreIndex.has(index) ? 'conductor-anchor' : 'score-conductor',
      ...(conductorByScoreIndex.has(index) ? {
        conductorReason: conductorByScoreIndex.get(index)?.reason,
      } : {}),
      ...(audioAnchor ? {
        audioEvidencePitchMidi: audioAnchor.audioPitchMidi,
        audioEvidenceStartTimeSeconds: round3(audioAnchor.time),
        audioEvidenceDurationSeconds: round3(audioAnchor.durationSeconds),
      } : {}),
    };
  }),
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 1)}\n`);
fs.writeFileSync(RECONCILED_OUT, `${JSON.stringify(reconciled, null, 1)}\n`);

console.log(`Lead score ${sync.length} (${audit.pitchRange}) | audio evidence ${audioEvidenceAnchors.length}/${sync.length} | conductor anchors ${rawConductorAnchors.length}->${conductorAnchors.length} | isolated onsets ${isolatedOnsets.length}`);
console.log(`span ${sync[0].startTimeSeconds}s -> ${sync[sync.length - 1].startTimeSeconds}s | duration ${durationSec.toFixed(3)}s | monotonic ${monotonic}`);
console.log(`tempo jitter p90/max: note-level ${noteLevelSmoothness.p90RateJumpSecPerBeat}/${noteLevelSmoothness.maxRateJumpSecPerBeat}s/beat -> conductor ${conductorSmoothness.p90RateJumpSecPerBeat}/${conductorSmoothness.maxRateJumpSecPerBeat}s/beat`);
if (conductorPrune.removed.length) console.log('removed conductor cliffs:', conductorPrune.removed.map((a) => `m${a.measure}@${a.time}s:${a.removedReason}`).join(' '));
console.log(`delta vs note-level audio: mean ${timingDelta.meanAbsSec}s | max ${timingDelta.maxAbsSec}s @ note ${timingDelta.maxAbsNote} | final ${timingDelta.finalNoteDeltaSec}s`);
console.log('first 16 notes:', sync.slice(0, 16).map((s) => `${s.startTimeSeconds}${nm(s.pitchMidi)}`).join(' '));
console.log('last 16 notes:', sync.slice(-16).map((s, i) => `${sync.length - 15 + i}:${s.startTimeSeconds}${nm(s.pitchMidi)}`).join(' '));
if (errors.length) {
  console.error('VERIFY FAILED:\n  ' + errors.join('\n  '));
  process.exit(1);
}
console.log(`OK -> wrote ${path.relative(RBW, OUT)} and ${path.relative(RBW, RECONCILED_OUT)}`);

async function loadTemplates() {
  const ldJ = await loadTemplate(LD_URL, 'ld-lida-lead-dominant.json');
  const nlJ = await loadTemplate(NL_URL, 'nl-lida-no-lead.json');
  return {
    leadDominant: normalizeTemplateNotes(ldJ.notes || []),
    noLead: normalizeTemplateNotes(nlJ.notes || []),
    durationSec: Number(ldJ.durationSec) || 83.24208333333333,
  };
}

async function loadTemplate(url, stageName) {
  const stagePath = `${STAGE}/${stageName}`;
  try {
    const json = await (await fetch(url)).json();
    fs.writeFileSync(stagePath, JSON.stringify(json));
    return json;
  } catch (e) {
    console.log(`fetch failed for ${stageName}: ${e.message}; using staged copy`);
    return JSON.parse(fs.readFileSync(stagePath, 'utf8'));
  }
}

function normalizeTemplateNotes(notes) {
  return notes
    .filter((n) => Number.isFinite(n.pitchMidi) && Number.isFinite(n.startTimeSeconds) && Number.isFinite(n.durationSeconds))
    .map((n) => ({
      pitchMidi: Number(n.pitchMidi),
      startTimeSeconds: Number(n.startTimeSeconds),
      durationSeconds: Number(n.durationSeconds),
    }))
    .sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
}

function isolateLeadOnsets(leadDominant, noLead, events) {
  const scoreLo = Math.min(...events.map((n) => n.midi)) - CONFIG.rangePadSemitones;
  const scoreHi = Math.max(...events.map((n) => n.midi)) + CONFIG.rangePadSemitones;
  const backing = noLead.filter((n) => n.pitchMidi >= scoreLo && n.pitchMidi <= scoreHi);
  const isolated = leadDominant
    .filter((n) => n.pitchMidi >= scoreLo && n.pitchMidi <= scoreHi)
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
    const prior = out[out.length - 1];
    if (
      prior &&
      prior.pitchMidi === note.pitchMidi &&
      note.startTimeSeconds <= prior.startTimeSeconds + prior.durationSeconds + CONFIG.mergeGapSec
    ) {
      const end = Math.max(
        prior.startTimeSeconds + prior.durationSeconds,
        note.startTimeSeconds + note.durationSeconds,
      );
      prior.durationSeconds = end - prior.startTimeSeconds;
    } else {
      out.push({ ...note });
    }
  }
  return out;
}

function alignScoreToAudio(events, audio) {
  const n = events.length;
  const m = audio.length;
  const inf = 1e9;
  const d = Array.from({ length: n + 1 }, () => new Float64Array(m + 1).fill(inf));
  const p = Array.from({ length: n + 1 }, () => new Int8Array(m + 1));
  for (let j = 0; j <= m; j++) d[0][j] = 0;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = pitchClassDistance(events[i - 1].midi, audio[j - 1].pitchMidi);
      const diag = d[i - 1][j - 1] + cost;
      const skip = d[i][j - 1] + CONFIG.skipAudioCost;
      const shared = d[i - 1][j] + cost + CONFIG.sharedOnsetPenalty;
      let best = diag;
      let move = 1;
      if (skip < best) {
        best = skip;
        move = 2;
      }
      if (shared < best) {
        best = shared;
        move = 3;
      }
      d[i][j] = best;
      p[i][j] = move;
    }
  }

  let jStar = 1;
  for (let j = 1; j <= m; j++) {
    if (d[n][j] < d[n][jStar]) jStar = j;
  }

  const match = new Array(n).fill(-1);
  let i = n;
  let j = jStar;
  while (i > 0 && j > 0) {
    const move = p[i][j];
    if (move === 2) {
      j--;
      continue;
    }
    match[i - 1] = j - 1;
    if (move === 1) {
      i--;
      j--;
    } else {
      i--;
    }
  }

  const matchCount = new Map();
  for (const audioIndex of match) {
    if (audioIndex >= 0) matchCount.set(audioIndex, (matchCount.get(audioIndex) || 0) + 1);
  }

  const anchors = [];
  for (let scoreIndex = 0; scoreIndex < n; scoreIndex++) {
    const audioIndex = match[scoreIndex];
    if (audioIndex < 0) continue;
    if (matchCount.get(audioIndex) > 1) continue;
    if (pitchClassDistance(events[scoreIndex].midi, audio[audioIndex].pitchMidi) > 1) continue;
    const time = audio[audioIndex].startTimeSeconds;
    if (anchors.length && time <= anchors[anchors.length - 1].time) continue;
    anchors.push({
      scoreIndex,
      audioIndex,
      beat: events[scoreIndex].startBeat,
      time,
      durationSeconds: audio[audioIndex].durationSeconds,
      audioPitchMidi: audio[audioIndex].pitchMidi,
    });
  }
  return anchors;
}

function selectConductorAnchors(audioAnchors, events) {
  const audioByScoreIndex = new Map(audioAnchors.map((anchor) => [anchor.scoreIndex, anchor]));
  const out = [];
  const add = (scoreIndex, reason) => {
    if (scoreIndex < 0 || scoreIndex >= events.length) return;
    if (out.some((anchor) => anchor.scoreIndex === scoreIndex)) return;
    const audioAnchor = audioByScoreIndex.get(scoreIndex);
    const event = events[scoreIndex];
    out.push({
      scoreIndex,
      beat: event.startBeat,
      time: audioAnchor ? audioAnchor.time : mapBeat(event.startBeat, audioAnchors),
      measure: event.measure,
      reason,
      audioPitchMidi: audioAnchor?.audioPitchMidi ?? event.midi,
      durationSeconds: audioAnchor?.durationSeconds ?? event.beats,
    });
  };

  add(0, 'first-note');
  for (const measure of [...new Set(events.map((event) => event.measure))]) {
    const noteIndexes = events
      .map((event, index) => event.measure === measure ? index : -1)
      .filter((index) => index >= 0);
    if (!noteIndexes.length) continue;
    const firstIndex = noteIndexes[0];
    const confirmedIndexes = noteIndexes.filter((index) => audioByScoreIndex.has(index));
    let choice = firstIndex;
    if (!audioByScoreIndex.has(firstIndex) && confirmedIndexes.length) {
      choice = confirmedIndexes.slice().sort((a, b) => {
        const beatRank = events[b].beats - events[a].beats;
        if (Math.abs(beatRank) > 0.01) return beatRank;
        return events[a].startBeat - events[b].startBeat;
      })[0];
    }
    add(choice, choice === firstIndex ? 'measure-start' : 'measure-strong-note');
  }
  add(events.length - 1, 'final-note');

  out.sort((a, b) => a.beat - b.beat || a.scoreIndex - b.scoreIndex);
  const pruned = [];
  for (const anchor of out) {
    const prior = pruned[pruned.length - 1];
    if (
      prior &&
      anchor.scoreIndex !== events.length - 1 &&
      anchor.beat - prior.beat < 1.5
    ) {
      continue;
    }
    pruned.push(anchor);
  }
  return pruned;
}

function buildSyncFromAnchors(events, beatAnchors, durationSec) {
  const notes = events.map((event) => {
    const start = mapBeat(event.startBeat, beatAnchors);
    const end = mapBeat(event.startBeat + event.beats, beatAnchors);
    return {
      pitchMidi: event.midi,
      startTimeSeconds: round3(Math.max(0, start)),
      durationSeconds: round3(Math.max(0.08, end - start)),
    };
  });
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

function tempoSmoothness(sync, events) {
  const rates = [];
  for (let i = 1; i < sync.length; i++) {
    const beatDelta = events[i].startBeat - events[i - 1].startBeat;
    const timeDelta = sync[i].startTimeSeconds - sync[i - 1].startTimeSeconds;
    if (beatDelta > 0 && timeDelta >= 0) rates.push(timeDelta / beatDelta);
  }
  const jumps = [];
  for (let i = 1; i < rates.length; i++) jumps.push(Math.abs(rates[i] - rates[i - 1]));
  return {
    medianSecPerBeat: round3(percentile(rates, 0.5)),
    p90RateJumpSecPerBeat: round3(percentile(jumps, 0.9)),
    maxRateJumpSecPerBeat: round3(percentile(jumps, 1)),
  };
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[index];
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
