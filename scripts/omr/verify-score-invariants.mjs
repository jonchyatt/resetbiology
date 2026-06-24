// verify-score-invariants.mjs
// ===========================================================================
// ABSOLUTE notation-law gate for Vocal Trainer score parts. Song-agnostic.
//
// WHY THIS EXISTS
// verify-lida-score-source-gate.mjs compares the generated MusicXML to a
// re-run of the SAME correction scripts. That proves the build is deterministic,
// but it can never catch a mistake IN the corrections — the corrections are both
// the answer key and the student. So a wrong correction (a 3-beat bar, a tie
// between two different pitches, a part that lost 3 measures) stays GREEN, and
// the only thing that catches it is a human re-reading the printed score. That is
// the "it keeps looking at it" loop.
//
// This gate is the missing layer. It checks laws of music notation that the
// corrections CANNOT satisfy just by being self-consistent:
//
//   I1  measure completeness : sum(note+rest ticks) == the meter's full-bar ticks
//   I2  tie pitch parity     : every tie-stop pitch == its matching tie-start pitch
//   I3  numbering            : measures are 1..N, contiguous, no gaps/dupes/reorder
//   I4  part bar count       : measure count == the printed-bar truth in the contract
//   I5  note count           : pitched-note count == contract (when declared)
//   I6  no dangling ties      : every tie has a partner
//   I7  key fifths            : only the contract's declared key signatures appear
//
// A failure here means the generated data is WRONG regardless of what any
// correction said. Run it on EVERY build; a song is only "locked" once it is green.
//
// Usage:
//   node scripts/omr/verify-score-invariants.mjs [songId]      (default: lida-rose)
//   import { checkSong } from './verify-score-invariants.mjs'
// ===========================================================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// --- MusicXML parsing (self-contained; deliberately independent of the build) ---

export function parsePart(xml) {
  const measures = [];
  let divisions = Number((xml.match(/<divisions>(\d+)<\/divisions>/) || [])[1] || 1);
  let beats = 4;
  let beatType = 4;

  for (const block of xml.matchAll(/<measure number="([^"]+)"[\s\S]*?<\/measure>/g)) {
    const measureXml = block[0];
    const number = Number(block[1]);

    const div = measureXml.match(/<divisions>(\d+)<\/divisions>/);
    if (div) divisions = Number(div[1]);
    const time = measureXml.match(/<beats>(\d+)<\/beats>[\s\S]*?<beat-type>(\d+)<\/beat-type>/);
    if (time) { beats = Number(time[1]); beatType = Number(time[2]); }

    const notes = [];
    let tickSum = 0;
    for (const noteBlock of measureXml.matchAll(/<note\b[\s\S]*?<\/note>/g)) {
      const noteXml = noteBlock[0];
      const isChord = /<chord\s*\/?>/.test(noteXml);
      const duration = Number((noteXml.match(/<duration>(\d+)<\/duration>/) || [])[1] || 0);
      if (!isChord) tickSum += duration; // chord notes share the prior onset's time

      const isRest = /<rest\b/.test(noteXml);
      const voice = Number((noteXml.match(/<voice>(\d+)<\/voice>/) || [])[1] || 1);
      const pitchMatch = noteXml.match(/<step>([A-G])<\/step>\s*(?:<alter>(-?\d+)<\/alter>\s*)?<octave>(\d+)<\/octave>/);
      const pitch = pitchMatch
        ? { step: pitchMatch[1], alter: pitchMatch[2] ? Number(pitchMatch[2]) : 0, octave: Number(pitchMatch[3]) }
        : null;

      notes.push({
        isChord,
        isRest,
        voice,
        duration,
        pitch,
        midi: pitch ? 12 * (pitch.octave + 1) + SEMITONE[pitch.step] + pitch.alter : null,
        name: pitch ? spell(pitch) : isRest ? 'rest' : '?',
        type: (noteXml.match(/<type>([^<]+)<\/type>/) || [])[1] || null,
        tieStart: /<tie type="start"\/>/.test(noteXml) || /<tied[^>]*type="start"/.test(noteXml),
        tieStop: /<tie type="stop"\/>/.test(noteXml) || /<tied[^>]*type="stop"/.test(noteXml),
      });
    }

    const fullBarTicks = Math.round(divisions * beats * (4 / beatType));
    measures.push({ number, divisions, beats, beatType, fullBarTicks, tickSum, notes });
  }
  return measures;
}

function spell(p) {
  const acc = { '-2': 'bb', '-1': 'b', 0: '', 1: '#', 2: '##' }[p.alter] ?? `(${p.alter})`;
  return `${p.step}${acc}${p.octave}`;
}

// --- The invariant checks ---

export function checkPart(partCfg, meter) {
  const abs = path.isAbsolute(partCfg.musicxml) ? partCfg.musicxml : path.join(ROOT, partCfg.musicxml);
  const violations = [];
  if (!fs.existsSync(abs)) {
    return [{ law: 'FILE', measure: null, message: `MusicXML not found: ${partCfg.musicxml}` }];
  }
  const xml = fs.readFileSync(abs, 'utf8');
  const measures = parsePart(xml);
  const pickup = new Set(partCfg.pickupMeasures || []);
  const V = (law, measure, message) => violations.push({ law, measure, message });

  // I1 — measure completeness
  for (const m of measures) {
    if (pickup.has(m.number)) continue; // declared anacrusis may be partial
    if (m.tickSum !== m.fullBarTicks) {
      const beatsGot = (m.tickSum / m.divisions).toFixed(3);
      const beatsWant = (m.fullBarTicks / m.divisions).toFixed(3);
      V('I1', m.number,
        `incomplete bar: ${m.tickSum} ticks (${beatsGot} beats) != ${m.fullBarTicks} (${beatsWant}) ` +
        `for ${m.beats}/${m.beatType} — notes [${m.notes.filter(n => !n.isChord).map(n => `${n.name}:${n.duration}`).join(' ')}]`);
    }
  }

  // I2 + I6 — tie pitch parity and no dangling ties (per voice, document order)
  const open = new Map(); // voice -> queue of {midi, name, measure}
  for (const m of measures) {
    for (const n of m.notes) {
      if (n.isRest || !n.pitch) continue;
      if (n.tieStop) {
        const q = open.get(n.voice) || [];
        const start = q.shift();
        if (!start) {
          V('I6', m.number, `dangling tie-stop on ${n.name} (voice ${n.voice}) with no open tie-start`);
        } else if (start.midi !== n.midi) {
          V('I2', m.number,
            `cross-pitch tie: tie-start ${start.name} (m${start.measure}, MIDI ${start.midi}) ` +
            `joined to tie-stop ${n.name} (MIDI ${n.midi}) — a tie must connect identical pitches`);
        }
        open.set(n.voice, q);
      }
      if (n.tieStart) {
        const q = open.get(n.voice) || [];
        q.push({ midi: n.midi, name: n.name, measure: m.number });
        open.set(n.voice, q);
      }
    }
  }
  for (const [voice, q] of open) {
    for (const s of q) V('I6', s.measure, `dangling tie-start on ${s.name} (voice ${voice}) never closed`);
  }

  // I3 — numbering 1..N contiguous
  const numbers = measures.map(m => m.number);
  for (let i = 0; i < numbers.length; i++) {
    if (numbers[i] !== i + 1) {
      V('I3', numbers[i], `numbering broken: position ${i + 1} has number ${numbers[i]} (expected contiguous 1..N)`);
      break;
    }
  }

  // I4 — part bar count vs contract
  if (partCfg.expectedMeasures != null && measures.length !== partCfg.expectedMeasures) {
    V('I4', null,
      `bar count ${measures.length} != contract ${partCfg.expectedMeasures} ` +
      `(printed-score truth) — ${measures.length < partCfg.expectedMeasures ? 'measures are MISSING' : 'extra measures'}`);
  }

  // I5 — note count vs contract
  if (partCfg.expectedNotes != null) {
    const noteCount = measures.reduce((s, m) => s + m.notes.filter(n => !n.isRest && !n.isChord && n.pitch).length, 0);
    if (noteCount !== partCfg.expectedNotes) {
      V('I5', null, `pitched-note count ${noteCount} != contract ${partCfg.expectedNotes}`);
    }
  }

  // I7 — key fifths whitelist
  if (partCfg.keyFifths) {
    const allowed = new Set(partCfg.keyFifths);
    const seen = [...new Set([...xml.matchAll(/<fifths>(-?\d+)<\/fifths>/g)].map(m => Number(m[1])))];
    for (const f of seen) {
      if (!allowed.has(f)) V('I7', null, `unexpected key fifths ${f} (contract allows ${[...allowed].join(', ')})`);
    }
  }

  return violations;
}

export function checkSong(descriptor) {
  const report = { id: descriptor.id, parts: [], violations: 0 };
  for (const partCfg of descriptor.parts) {
    const violations = checkPart(partCfg, descriptor.meter);
    report.parts.push({ name: partCfg.name, measures: partCfg.expectedMeasures, violations });
    report.violations += violations.length;
  }
  return report;
}

// --- CLI ---

const isCli = pathToFileURL(process.argv[1]).href === import.meta.url;
if (isCli) {
  const songId = process.argv[2] || 'lida-rose';
  const descriptorPath = path.join(__dirname, 'songs', `${songId}.song.mjs`);
  if (!fs.existsSync(descriptorPath)) {
    console.error(`No song contract at ${descriptorPath}`);
    process.exit(2);
  }
  const descriptor = (await import(pathToFileURL(descriptorPath).href)).default;
  const report = checkSong(descriptor);

  console.log(`\n=== SCORE-INVARIANT GATE — ${descriptor.title || descriptor.id} ===`);
  for (const part of report.parts) {
    if (!part.violations.length) {
      console.log(`  [PASS] ${part.name}: all notation laws hold (${part.measures ?? '?'} bars)`);
      continue;
    }
    console.log(`  [FAIL] ${part.name}: ${part.violations.length} violation(s)`);
    for (const v of part.violations) {
      const loc = v.measure != null ? `m${v.measure}` : 'part';
      console.log(`         ${v.law} @ ${loc}: ${v.message}`);
    }
  }

  if (report.violations) {
    console.error(`\nSCORE-INVARIANT GATE FAILED: ${report.violations} violation(s). ` +
      `These are notation-law failures the source-gate cannot catch. Fix the source/corrections, do not silence the gate.`);
    process.exit(1);
  }
  console.log(`\nSCORE-INVARIANT GATE PASS: ${descriptor.id} obeys every checked notation law. Safe to lock.`);
}
