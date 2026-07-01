// build-lead-dataset.mjs
// Regenerates the OMR target lane used by Vocal Trainer III. The filename is
// historical; it now emits all generated Lida Rose parts that have been promoted
// from source staff audit to VT3 trainer artifacts.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeLeadMeasure } from './lida-lead-key-normalize.mjs';
import { applyLeadMeasureCorrections } from './lida-lead-source-corrections.mjs';
import { applyTenorMeasureCorrections } from './lida-tenor-source-corrections.mjs';
import { applyBassMeasureCorrections } from './lida-bass-source-corrections.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = (f) => path.join(__dirname, 'source', f);
const OUT = path.join(__dirname, '..', '..', 'src', 'components', 'PitchDefender', 'omrTargets.ts');

const PARTS = [
  {
    song: 'Lida Rose',
    part: 'Tenor',
    sourcePages: 'pp.196-198 (Audiveris + printed corrections)',
    pages: [
      { pg: '196', path: SRC('lida-196.xml'), staff: 'P2' },
      { pg: '197', path: SRC('lida-197.xml'), staff: 'P1' },
      { pg: '198', path: SRC('lida-198.xml'), staff: 'P1' },
    ],
    audioTemplateUrl: null,
    fallbackDurationSec: 84.848,
    countEmptyMeasures: true,
    applyCorrections: applyTenorMeasureCorrections,
  },
  {
    song: 'Lida Rose',
    part: 'Lead',
    sourcePages: 'pp.196-198 (Audiveris)',
    pages: [
      { pg: '196', path: SRC('lida-196.xml'), staff: 'P3' },
      { pg: '197', path: SRC('lida-197.xml'), staff: 'P2' },
      { pg: '198', path: SRC('lida-198.xml'), staff: 'P2' },
    ],
    audioTemplateUrl: 'https://vv03sd8jufykivax.public.blob.vercel-storage.com/vocal-trainer/1781240825294-lead-lida-rose-lead-dominant/template.json',
    fallbackDurationSec: 83.242,
    countEmptyMeasures: false,
    applyCorrections: applyLeadMeasureCorrections,
  },
  {
    song: 'Lida Rose',
    part: 'Baritone',
    sourcePages: 'pp.196-198 (Audiveris)',
    pages: [
      { pg: '196', path: SRC('lida-196.xml'), staff: 'P4' },
      { pg: '197', path: SRC('lida-197.xml'), staff: 'P3' },
      { pg: '198', path: SRC('lida-198.xml'), staff: 'P3' },
    ],
    audioTemplateUrl: 'https://vv03sd8jufykivax.public.blob.vercel-storage.com/vocal-trainer/1781240808729-baritone-lida-rose-baritone-dominant/template.json',
    fallbackDurationSec: 83.289977,
    countEmptyMeasures: true,
    applyCorrections: applyLeadMeasureCorrections,
  },
  {
    song: 'Lida Rose',
    part: 'Bass',
    sourcePages: 'pp.196-198 (Audiveris + printed corrections)',
    pages: [
      { pg: '196', path: SRC('lida-196.xml'), staff: 'P5' },
      { pg: '197', path: SRC('lida-197.xml'), staff: 'P4' },
      { pg: '198', path: SRC('lida-198.xml'), staff: 'P4' },
    ],
    audioTemplateUrl: null,
    fallbackDurationSec: 84.848,
    countEmptyMeasures: true,
    applyCorrections: applyBassMeasureCorrections,
  },
];

const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NM = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const nameOf = (m) => NM[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);

function getPartInner(xml, id) {
  for (const pb of xml.split(/<part id="/).slice(1)) {
    const match = pb.match(/^([^"]+)"/);
    if (match?.[1] !== id) continue;
    const end = pb.indexOf('</part>');
    if (end < 0) throw new Error(`part ${id}: missing </part>`);
    return pb.slice(pb.indexOf('>') + 1, end);
  }
  throw new Error(`part ${id} not found`);
}

function noteEventsFromMeasures(measures, options = {}) {
  const out = [];
  let beat = 0;
  let div = 1;
  for (const measure of measures) {
    const divMatch = measure.match(/<divisions>(\d+)<\/divisions>/);
    if (divMatch) div = Number(divMatch[1]);
    const noteMatches = [...measure.matchAll(/<note\b[\s\S]*?<\/note>/g)];
    if (!noteMatches.length) {
      if (options.countEmptyMeasures) beat += 4;
      continue;
    }
    for (const noteMatch of noteMatches) {
      const noteXml = noteMatch[0];
      if (/<chord\s*\/?\s*>/.test(noteXml)) continue;
      const dur = Number((noteXml.match(/<duration>(\d+)<\/duration>/) || [])[1] || 0);
      const beats = dur / div;
      if (/<rest\b/.test(noteXml)) {
        beat += beats;
        continue;
      }
      const pm = noteXml.match(/<step>([A-G])<\/step>\s*(?:<alter>(-?\d+)<\/alter>\s*)?<octave>(\d+)<\/octave>/);
      if (!pm) {
        beat += beats;
        continue;
      }
      const midi = (Number(pm[3]) + 1) * 12 + SEMI[pm[1]] + (pm[2] ? Number(pm[2]) : 0);
      out.push({ midi, startBeat: beat, beats });
      beat += beats;
    }
  }
  return { notes: out, totalBeats: beat };
}

function sourceMeasures(partConfig) {
  const measures = [];
  for (const page of partConfig.pages) {
    const xml = fs.readFileSync(page.path, 'utf8');
    const inner = getPartInner(xml, page.staff);
    const divisions = Number((inner.match(/<divisions>(\d+)<\/divisions>/) || [])[1] || 1);
    const pageMeasures = (inner.match(/<measure\b[\s\S]*?<\/measure>/g) || [])
      .map(normalizeLeadMeasure);
    measures.push(...partConfig.applyCorrections(page.pg, pageMeasures, { part: partConfig.part, divisions }));
  }
  while (measures.length && !/<note\b/.test(measures[measures.length - 1])) measures.pop();
  return measures;
}

async function durationFor(partConfig) {
  if (!partConfig.audioTemplateUrl) return partConfig.fallbackDurationSec;
  try {
    const audio = await (await fetch(partConfig.audioTemplateUrl)).json();
    return Number(audio.durationSec) || partConfig.fallbackDurationSec;
  } catch (e) {
    console.log(`${partConfig.part}: duration fetch skipped (${e.message}); using fallback`);
    return partConfig.fallbackDurationSec;
  }
}

const targets = [];
for (const partConfig of PARTS) {
  const { notes, totalBeats } = noteEventsFromMeasures(sourceMeasures(partConfig), {
    countEmptyMeasures: partConfig.countEmptyMeasures,
  });
  const durationSec = await durationFor(partConfig);
  const midiValues = notes.map((n) => n.midi);
  console.log(`OMR ${partConfig.part} notes: ${notes.length} | totalBeats: ${totalBeats.toFixed(1)} | range ${nameOf(Math.min(...midiValues))} - ${nameOf(Math.max(...midiValues))}`);
  const sec = (b) => (b / totalBeats) * durationSec;
  targets.push({
    ...partConfig,
    notes: notes.map((n) => ({
      pitchMidi: n.midi,
      startTimeSeconds: +sec(n.startBeat).toFixed(3),
      durationSeconds: Math.max(0.12, +((n.beats / totalBeats) * durationSec).toFixed(3)),
    })),
  });
}

const targetBlocks = targets.map((target) => {
  const notesStr = target.notes
    .map((n) => `    { pitchMidi: ${n.pitchMidi}, startTimeSeconds: ${n.startTimeSeconds}, durationSeconds: ${n.durationSeconds} }`)
    .join(',\n');
  return `  {
    song: '${target.song}',
    part: '${target.part}',
    sourcePages: '${target.sourcePages}',
    noteCount: ${target.notes.length},
    notes: [
${notesStr},
    ],
  }`;
}).join(',\n');

const ts = `// AUTO-GENERATED - do not hand-edit. Regenerate via scripts/omr/build-lead-dataset.mjs
// Optical Music Recognition (Audiveris 5.10.2) of "The Music Man" full score,
// Lida Rose pp.196-198. These are score-derived part lanes for Vocal Trainer III.
// Runtime timing is superseded by each lida-rose-<part>-sync.json.
// omrTargets remains the visual-lane fallback and build-time pitch oracle.
export interface OmrTargetNote { pitchMidi: number; startTimeSeconds: number; durationSeconds: number }
export interface OmrTarget { song: string; part: string; sourcePages: string; noteCount: number; notes: OmrTargetNote[] }

export const OMR_TARGETS: OmrTarget[] = [
${targetBlocks},
];

export function getOmrTarget(song: string, part: string): OmrTarget | null {
  return OMR_TARGETS.find((t) => t.song === song && t.part === part) || null;
}
`;

fs.writeFileSync(OUT, ts);
console.log('WROTE', path.relative(path.join(__dirname, '..', '..'), OUT), '-', targets.map((t) => `${t.part}:${t.notes.length}`).join(' '));
