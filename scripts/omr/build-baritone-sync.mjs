// build-baritone-sync.mjs
// Builds Baritone recording timestamps by mapping Oliver's score-beat positions
// onto the corrected Lead sync timeline. This is deliberately not claiming a
// Baritone BasicPitch extraction: the live Baritone template currently has no
// extracted notes, so the Lead rubato grid is the best available timing source.
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

const NM = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const nm = (m) => NM[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);

const leadEvents = scoreEventsFromXml(fs.readFileSync(LEAD_XML, 'utf8'));
const baritoneEvents = scoreEventsFromXml(fs.readFileSync(BARITONE_XML, 'utf8'));
const leadSync = JSON.parse(fs.readFileSync(LEAD_SYNC, 'utf8')).notes || [];
if (leadEvents.length !== leadSync.length) {
  throw new Error(`Lead timeline mismatch: leadEvents=${leadEvents.length} leadSync=${leadSync.length}`);
}

const durationSec = await templateDuration();
const anchors = leadEvents.map((event, index) => ({
  beat: event.startBeat,
  time: leadSync[index].startTimeSeconds,
})).filter((anchor, index, arr) => index === 0 || anchor.beat > arr[index - 1].beat);

function mapBeat(beat) {
  if (anchors.length < 2) return beat;
  if (beat <= anchors[0].beat) return extrapolate(beat, anchors[0], anchors[1]);
  const last = anchors[anchors.length - 1];
  if (beat >= last.beat) return extrapolate(beat, anchors[anchors.length - 2], last);
  let hi = 1;
  while (hi < anchors.length && anchors[hi].beat < beat) hi++;
  const lo = anchors[hi - 1];
  const next = anchors[hi];
  const span = next.beat - lo.beat || 1;
  return lo.time + ((beat - lo.beat) / span) * (next.time - lo.time);
}

function extrapolate(beat, a, b) {
  const rate = (b.time - a.time) / ((b.beat - a.beat) || 1);
  return a.time + (beat - a.beat) * rate;
}

const sync = baritoneEvents.map((event) => ({
  pitchMidi: event.midi,
  startTimeSeconds: +Math.max(0, mapBeat(event.startBeat)).toFixed(3),
  durationSeconds: +Math.max(0.08, mapBeat(event.startBeat + event.beats) - mapBeat(event.startBeat)).toFixed(3),
}));

for (let i = 0; i < sync.length; i++) {
  const nextStart = i < sync.length - 1 ? sync[i + 1].startTimeSeconds : durationSec;
  if (sync[i].startTimeSeconds + sync[i].durationSeconds > nextStart) {
    sync[i].durationSeconds = +Math.max(0.08, nextStart - sync[i].startTimeSeconds).toFixed(3);
  }
}

const monotonic = sync.every((s, i) => i === 0 || s.startTimeSeconds >= sync[i - 1].startTimeSeconds);
const errors = [];
if (sync.length !== 106) errors.push(`expected 106 Baritone notes, got ${sync.length}`);
if (!monotonic) errors.push('sync is not monotonic');
if (sync[sync.length - 1].startTimeSeconds > durationSec + 0.5) errors.push('last note exceeds Baritone recording duration');

const payload = {
  song: 'Lida Rose',
  part: 'Baritone',
  source: 'score-beat interpolation onto corrected Lead sync timeline; Baritone template currently has empty extracted notes',
  durationSec,
  noteCount: sync.length,
  notes: sync,
};
const reconciled = {
  song: 'Lida Rose',
  part: 'Baritone',
  method: 'engraving truth timed from Lead rubato grid; no Baritone BasicPitch extraction available yet',
  noteCount: sync.length,
  notes: sync.map((note) => ({ ...note, src: 'lead-timeline' })),
};

fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 1)}\n`);
fs.writeFileSync(RECONCILED_OUT, `${JSON.stringify(reconciled, null, 1)}\n`);

console.log(`Baritone score ${sync.length} (${nm(Math.min(...sync.map((n) => n.pitchMidi)))}-${nm(Math.max(...sync.map((n) => n.pitchMidi)))}) | lead anchors ${anchors.length}`);
console.log(`span ${sync[0].startTimeSeconds}s -> ${sync[sync.length - 1].startTimeSeconds}s | duration ${durationSec.toFixed(3)}s | monotonic ${monotonic}`);
console.log('first 16 notes:', sync.slice(0, 16).map((s) => `${s.startTimeSeconds}${nm(s.pitchMidi)}`).join(' '));
if (errors.length) {
  console.error('VERIFY FAILED:\n  ' + errors.join('\n  '));
  process.exit(1);
}
console.log(`OK -> wrote ${path.relative(RBW, OUT)} and ${path.relative(RBW, RECONCILED_OUT)}`);

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
