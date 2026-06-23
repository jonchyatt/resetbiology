// build-lida-conductor-v2.mjs
// Builds a shared Lida Rose conductor map for VT3 without overwriting the
// current production sync files. The Lead score-conductor grid is the spine;
// Baritone extracted anchors may confirm local timing, but late/noisy anchors
// are rejected instead of being allowed to pull the whole score off beat.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pruneTempoCliffAnchors } from './timing-grid.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RBW = path.join(__dirname, '..', '..');
const PUBLIC = path.join(RBW, 'public', 'musicxml');
const GENERATED_AT = new Date().toISOString();

const CONFIG = {
  baritoneConfirmToleranceSec: 0.55,
  minMasterAnchors: 20,
  maxP90RateJumpSecPerBeat: 0.5,
  maxRateJumpSecPerBeat: 0.45,
  conductorMinSegmentSecPerBeat: 0.35,
  conductorMaxSegmentSecPerBeat: 1.08,
  conductorMaxAdjacentRateJump: 0.38,
};

const PARTS = [
  { part: 'Lead', slug: 'lead', primary: true },
  { part: 'Baritone', slug: 'baritone', primary: false },
];

const parts = PARTS.map((cfg) => ({
  ...cfg,
  sync: readJson(path.join(PUBLIC, `lida-rose-${cfg.slug}-sync.json`)),
  reconciled: readJson(path.join(PUBLIC, `lida-rose-${cfg.slug}-reconciled.json`)),
  health: readJson(path.join(PUBLIC, `lida-rose-${cfg.slug}-score-health.json`)),
}));

const lead = parts.find((p) => p.part === 'Lead');
if (!lead) throw new Error('Lead part is required for conductor-v2');

const leadAnchors = conductorNotes(lead).map((note) => ({
  part: 'Lead',
  beat: note.scoreBeat,
  time: note.startTimeSeconds,
  measure: note.measure,
  scoreIndex: note.scoreIndex,
  reason: note.conductorReason || 'lead-spine',
  accepted: true,
  deltaFromLeadSec: 0,
}));

const leadGrid = leadAnchors.map((a) => ({ beat: a.beat, time: a.time, measure: a.measure, scoreIndex: a.scoreIndex }));
const candidateAnchors = [...leadAnchors];
const rejectedPartAnchors = [];
const confirmedPartAnchors = [];

for (const part of parts.filter((p) => !p.primary)) {
  for (const note of conductorNotes(part)) {
    const expectedTime = timeAtBeat(leadGrid, note.scoreBeat);
    const delta = note.startTimeSeconds - expectedTime;
    const candidate = {
      part: part.part,
      beat: note.scoreBeat,
      time: note.startTimeSeconds,
      measure: note.measure,
      scoreIndex: note.scoreIndex,
      reason: note.conductorReason || 'part-anchor',
      expectedLeadTimeSeconds: round3(expectedTime),
      deltaFromLeadSec: round3(delta),
    };
    if (Math.abs(delta) <= CONFIG.baritoneConfirmToleranceSec) {
      confirmedPartAnchors.push(candidate);
      candidateAnchors.push({ ...candidate, accepted: true });
    } else {
      rejectedPartAnchors.push({
        ...candidate,
        rejectedReason: 'outside-lead-conductor-window',
        toleranceSec: CONFIG.baritoneConfirmToleranceSec,
      });
    }
  }
}

const rawMasterAnchors = mergeAnchorCandidates(candidateAnchors);
const pruned = pruneTempoCliffAnchors(rawMasterAnchors, {
  minSegmentSecPerBeat: CONFIG.conductorMinSegmentSecPerBeat,
  maxSegmentSecPerBeat: CONFIG.conductorMaxSegmentSecPerBeat,
  maxAdjacentRateJump: CONFIG.conductorMaxAdjacentRateJump,
});
const masterAnchors = pruned.anchors;
const masterBeatSet = new Set(masterAnchors.map((a) => beatKey(a.beat)));

if (masterAnchors.length < CONFIG.minMasterAnchors) {
  throw new Error(`conductor-v2 anchors too sparse: ${masterAnchors.length}`);
}

const conductorSmoothness = tempoSmoothnessFromAnchors(masterAnchors);
if (conductorSmoothness.p90RateJumpSecPerBeat > CONFIG.maxP90RateJumpSecPerBeat) {
  throw new Error(`conductor-v2 p90 tempo jump too high: ${conductorSmoothness.p90RateJumpSecPerBeat}`);
}
if (conductorSmoothness.maxRateJumpSecPerBeat > CONFIG.maxRateJumpSecPerBeat) {
  throw new Error(`conductor-v2 max tempo jump too high: ${conductorSmoothness.maxRateJumpSecPerBeat}`);
}

const conductorPayload = {
  song: 'Lida Rose',
  version: 'lida-rose-conductor-v2',
  generatedAt: GENERATED_AT,
  source: 'lead-led shared score-conductor v2; Baritone anchors confirm only when close to the Lead conductor',
  primaryPart: 'Lead',
  config: CONFIG,
  candidateAnchors: candidateAnchors.length,
  confirmedPartAnchors,
  rejectedPartAnchors,
  rawMasterAnchors: rawMasterAnchors.length,
  removedMasterAnchors: pruned.removed,
  masterAnchors: masterAnchors.length,
  tempoSmoothness: {
    scoreConductor: conductorSmoothness,
  },
  anchors: masterAnchors,
};

fs.writeFileSync(
  path.join(PUBLIC, 'lida-rose-conductor-v2.json'),
  `${JSON.stringify(conductorPayload, null, 1)}\n`,
);

for (const part of parts) {
  const mapped = mapPartToMasterConductor(part);
  writePartArtifacts(part, mapped);
}

console.log(`conductor-v2 anchors ${rawMasterAnchors.length}->${masterAnchors.length}; p90/max jump ${conductorSmoothness.p90RateJumpSecPerBeat}/${conductorSmoothness.maxRateJumpSecPerBeat}s/beat`);
console.log(`accepted Baritone confirmations ${confirmedPartAnchors.length}; rejected late Baritone anchors ${rejectedPartAnchors.length}`);
for (const part of parts) {
  const sync = readJson(path.join(PUBLIC, `lida-rose-${part.slug}-sync-v2.json`));
  const delta = sync.audit?.timingDeltaFromCurrent;
  console.log(`${part.part} v2 ${sync.noteCount} notes; delta vs current mean/max/final ${delta?.meanAbsSec}/${delta?.maxAbsSec}/${delta?.finalNoteDeltaSec}s`);
}

function conductorNotes(part) {
  return (part.reconciled.notes || [])
    .map((note, index) => ({ ...note, scoreIndex: index }))
    .filter((note) => note.src === 'conductor-anchor' && Number.isFinite(note.scoreBeat) && Number.isFinite(note.startTimeSeconds));
}

function mergeAnchorCandidates(candidates) {
  const byBeat = new Map();
  for (const candidate of candidates) {
    const key = beatKey(candidate.beat);
    const prior = byBeat.get(key);
    if (!prior) {
      byBeat.set(key, { ...candidate, sources: [sourceSummary(candidate)] });
      continue;
    }
    prior.sources.push(sourceSummary(candidate));
    if (prior.part !== 'Lead' && candidate.part === 'Lead') {
      prior.time = candidate.time;
      prior.measure = candidate.measure;
      prior.scoreIndex = candidate.scoreIndex;
      prior.reason = candidate.reason;
      prior.part = candidate.part;
    }
  }
  return [...byBeat.values()]
    .sort((a, b) => a.beat - b.beat)
    .map((anchor, index) => ({
      beat: round6(anchor.beat),
      time: round3(anchor.time),
      measure: anchor.measure,
      scoreIndex: index,
      reason: anchor.reason,
      sources: anchor.sources,
    }));
}

function sourceSummary(anchor) {
  return {
    part: anchor.part,
    measure: anchor.measure,
    scoreIndex: anchor.scoreIndex,
    time: round3(anchor.time),
    deltaFromLeadSec: round3(anchor.deltaFromLeadSec || 0),
    reason: anchor.reason,
  };
}

function mapPartToMasterConductor(part) {
  const currentNotes = part.reconciled.notes || [];
  const mappedNotes = currentNotes.map((note) => {
    const start = timeAtBeat(masterAnchors, note.scoreBeat);
    const end = timeAtBeat(masterAnchors, note.scoreBeat + note.scoreBeats);
    const duration = Math.max(0.06, end - start);
    const isAnchorBeat = masterBeatSet.has(beatKey(note.scoreBeat));
    return {
      ...note,
      startTimeSeconds: round3(start),
      durationSeconds: round3(duration),
      src: isAnchorBeat ? 'conductor-anchor' : 'score-conductor',
      conductorReason: isAnchorBeat ? 'shared-conductor-v2' : undefined,
      timingMode: 'conductor-v2',
    };
  });
  return mappedNotes.map((note) => {
    const cleaned = { ...note };
    if (cleaned.conductorReason == null) delete cleaned.conductorReason;
    return cleaned;
  });
}

function writePartArtifacts(part, mappedNotes) {
  const currentSyncNotes = part.sync.notes || [];
  const syncNotes = mappedNotes.map((note) => ({
    pitchMidi: note.pitchMidi,
    startTimeSeconds: note.startTimeSeconds,
    durationSeconds: note.durationSeconds,
    measure: note.measure,
    scoreBeat: note.scoreBeat,
    scoreBeats: note.scoreBeats,
  }));
  const conductorAnchors = mappedNotes.filter((n) => n.src === 'conductor-anchor').length;
  const scoreConductorNotes = mappedNotes.filter((n) => n.src === 'score-conductor').length;
  const smoothness = tempoSmoothnessFromNotes(mappedNotes);
  const timingDelta = timingDeltaSummary(mappedNotes, part.reconciled.notes || []);
  const audit = {
    method: 'shared score-conductor v2: Lead conductor spine plus score rhythm; noisy part anchors rejected by cross-part timing window',
    conductorVersion: conductorPayload.version,
    source: conductorPayload.source,
    primaryPart: conductorPayload.primaryPart,
    currentSource: part.sync.source || null,
    currentConductorAnchors: part.sync.audit?.conductorAnchors ?? null,
    currentTempoSmoothness: part.sync.audit?.tempoSmoothness?.scoreConductor ?? null,
    rawMasterAnchors: rawMasterAnchors.length,
    masterAnchors: masterAnchors.length,
    conductorAnchors,
    scoreConductorNotes,
    confirmedPartAnchors: confirmedPartAnchors.filter((a) => a.part === part.part).length,
    rejectedPartAnchors: rejectedPartAnchors.filter((a) => a.part === part.part).length,
    removedMasterAnchors: pruned.removed,
    tempoSmoothness: {
      scoreConductor: smoothness,
    },
    timingDeltaFromCurrent: timingDelta,
    config: CONFIG,
  };
  const syncPayload = {
    song: 'Lida Rose',
    part: part.part,
    source: 'score-conductor-v2 shared Lead-led timing from corrected score rhythm',
    durationSec: part.sync.durationSec,
    noteCount: syncNotes.length,
    audit,
    notes: syncNotes,
  };
  const reconciledPayload = {
    song: 'Lida Rose',
    part: part.part,
    method: audit.method,
    noteCount: mappedNotes.length,
    audit,
    notes: mappedNotes,
  };
  const health = buildV2Health(part, syncPayload, reconciledPayload, conductorAnchors, scoreConductorNotes, smoothness, timingDelta);

  fs.writeFileSync(path.join(PUBLIC, `lida-rose-${part.slug}-sync-v2.json`), `${JSON.stringify(syncPayload, null, 1)}\n`);
  fs.writeFileSync(path.join(PUBLIC, `lida-rose-${part.slug}-reconciled-v2.json`), `${JSON.stringify(reconciledPayload, null, 1)}\n`);
  fs.writeFileSync(path.join(PUBLIC, `lida-rose-${part.slug}-score-health-v2.json`), `${JSON.stringify(health, null, 1)}\n`);

  if (currentSyncNotes.length !== syncNotes.length) {
    throw new Error(`${part.part}: v2 sync count ${syncNotes.length} != current ${currentSyncNotes.length}`);
  }
}

function buildV2Health(part, syncPayload, reconciledPayload, conductorAnchors, scoreConductorNotes, smoothness, timingDelta) {
  const health = JSON.parse(JSON.stringify(part.health));
  health.generatedAt = GENERATED_AT;
  health.scoreVersion = `${part.health.scoreVersion}-conductor-v2`;
  health.sync = {
    noteCount: syncPayload.notes.length,
    reconciledCount: reconciledPayload.notes.length,
    source: syncPayload.source,
    currentAudioEvidenceAnchors: part.sync.audit?.audioEvidenceAnchors ?? health.sync?.audioEvidenceAnchors ?? null,
    currentRawConductorAnchors: part.sync.audit?.rawConductorAnchors ?? health.sync?.rawConductorAnchors ?? null,
    currentConductorAnchors: part.sync.audit?.conductorAnchors ?? health.sync?.conductorAnchors ?? null,
    rawMasterAnchors: rawMasterAnchors.length,
    masterAnchors: masterAnchors.length,
    conductorAnchors,
    scoreConductorNotes,
    confirmedPartAnchors: confirmedPartAnchors.filter((a) => a.part === part.part).length,
    rejectedPartAnchors: rejectedPartAnchors.filter((a) => a.part === part.part).length,
    removedMasterAnchors: pruned.removed,
    tempoSmoothness: syncPayload.audit.tempoSmoothness,
    timingDeltaFromCurrent: timingDelta,
  };
  health.checks = (health.checks || []).map((check) => {
    if (check.id !== 'score-conductor-sync') return check;
    const passed =
      /score-conductor-v2/i.test(syncPayload.source || '') &&
      syncPayload.notes.length === health.noteCount &&
      reconciledPayload.notes.length === health.noteCount &&
      masterAnchors.length >= CONFIG.minMasterAnchors &&
      conductorAnchors + scoreConductorNotes === health.noteCount &&
      smoothness.p90RateJumpSecPerBeat <= CONFIG.maxP90RateJumpSecPerBeat &&
      smoothness.maxRateJumpSecPerBeat <= CONFIG.maxRateJumpSecPerBeat;
    return {
      ...check,
      status: passed ? 'pass' : 'fail',
      detail: `masterAnchors=${masterAnchors.length}; partAnchorStarts=${conductorAnchors}; scoreConductor=${scoreConductorNotes}; p90Jump=${smoothness.p90RateJumpSecPerBeat}; maxJump=${smoothness.maxRateJumpSecPerBeat}; deltaCurrentMean=${timingDelta.meanAbsSec}; rejectedPartAnchors=${health.sync.rejectedPartAnchors}`,
    };
  });
  health.checks.push({
    id: 'shared-conductor-v2',
    label: 'Shared conductor v2',
    status: rejectedPartAnchors.length >= 1 && conductorPayload.primaryPart === 'Lead' ? 'pass' : 'fail',
    detail: `primary=${conductorPayload.primaryPart}; masterAnchors=${masterAnchors.length}; confirmed=${confirmedPartAnchors.length}; rejected=${rejectedPartAnchors.length}`,
  });
  return health;
}

function timeAtBeat(anchors, beat) {
  const sorted = anchors.slice().sort((a, b) => a.beat - b.beat);
  if (!sorted.length) throw new Error('no anchors available');
  if (beat <= sorted[0].beat) {
    return extrapolate(sorted[0], sorted[1] || sorted[0], beat);
  }
  for (let i = 1; i < sorted.length; i++) {
    if (beat <= sorted[i].beat) return interpolate(sorted[i - 1], sorted[i], beat);
  }
  return extrapolate(sorted[sorted.length - 2] || sorted[0], sorted[sorted.length - 1], beat);
}

function interpolate(a, b, beat) {
  const beatDelta = b.beat - a.beat;
  if (!(beatDelta > 0)) return a.time;
  const t = (beat - a.beat) / beatDelta;
  return a.time + (b.time - a.time) * t;
}

function extrapolate(a, b, beat) {
  const beatDelta = b.beat - a.beat;
  const rate = beatDelta > 0 ? (b.time - a.time) / beatDelta : 0.6;
  return a.time + (beat - a.beat) * rate;
}

function tempoSmoothnessFromAnchors(anchors) {
  const notes = anchors.map((anchor) => ({
    scoreBeat: anchor.beat,
    startTimeSeconds: anchor.time,
  }));
  return tempoSmoothnessFromNotes(notes);
}

function tempoSmoothnessFromNotes(notes) {
  const sorted = notes
    .filter((n) => Number.isFinite(n.scoreBeat) && Number.isFinite(n.startTimeSeconds))
    .sort((a, b) => a.scoreBeat - b.scoreBeat);
  const rates = [];
  for (let i = 1; i < sorted.length; i++) {
    const beatDelta = sorted[i].scoreBeat - sorted[i - 1].scoreBeat;
    const timeDelta = sorted[i].startTimeSeconds - sorted[i - 1].startTimeSeconds;
    if (beatDelta > 0 && timeDelta > 0) rates.push(timeDelta / beatDelta);
  }
  const jumps = [];
  for (let i = 1; i < rates.length; i++) jumps.push(Math.abs(rates[i] - rates[i - 1]));
  return {
    medianSecPerBeat: round3(percentile(rates, 0.5)),
    p90RateJumpSecPerBeat: round3(percentile(jumps, 0.9)),
    maxRateJumpSecPerBeat: round3(jumps.length ? Math.max(...jumps) : 0),
  };
}

function timingDeltaSummary(nextNotes, priorNotes) {
  const deltas = nextNotes.map((note, index) => note.startTimeSeconds - (priorNotes[index]?.startTimeSeconds ?? note.startTimeSeconds));
  const abs = deltas.map((d) => Math.abs(d));
  let maxIndex = 0;
  for (let i = 1; i < abs.length; i++) if (abs[i] > abs[maxIndex]) maxIndex = i;
  return {
    meanAbsSec: round3(abs.reduce((sum, d) => sum + d, 0) / Math.max(1, abs.length)),
    maxAbsSec: round3(abs[maxIndex] || 0),
    maxAbsNote: maxIndex + 1,
    finalNoteDeltaSec: round3(deltas[deltas.length - 1] || 0),
  };
}

function percentile(values, p) {
  const sorted = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[idx];
}

function beatKey(beat) {
  return round6(beat).toFixed(6);
}

function round3(n) {
  return Number.isFinite(n) ? +n.toFixed(3) : null;
}

function round6(n) {
  return Number.isFinite(n) ? +n.toFixed(6) : null;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
