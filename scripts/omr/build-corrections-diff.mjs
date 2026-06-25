// build-corrections-diff.mjs
// PLUMB deterministic judge — LAYER 1 (Codex/FLW approved, 2026-06-24).
// Diffs the RAW Audiveris reading (the source staff exactly as the OMR read it — NO
// normalization, NO corrections) against the shipped ENGRAVING, per part. Every
// divergence = an intervention WE layered on Audiveris (a correction or a normalization
// effect) = the highest-risk suspect rows to verify against the printed page. Deterministic,
// reproducible, no vision. (Codex HIGH: this shares Audiveris's own errors — rows where raw
// and engraving AGREE can still both be wrong; those need the Layer-2 second signal.)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { scoreEventsFromXml, noteName } from './score-timing.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RBW = path.join(__dirname, '..', '..');
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// staff map (from build-lida-score-health PART_SOURCES): which source-part id is which voice per page
const PART_STAVES = {
  Lead: [['lida-196.xml', 'P3'], ['lida-197.xml', 'P2'], ['lida-198.xml', 'P2']],
  Baritone: [['lida-196.xml', 'P4'], ['lida-197.xml', 'P3'], ['lida-198.xml', 'P3']],
};
const ENGRAVING = { Lead: 'public/musicxml/lida-rose-lead.musicxml', Baritone: 'public/musicxml/lida-rose-baritone.musicxml' };

function getPartInner(sourceXml, id) {
  for (const block of sourceXml.split('<part id="').slice(1)) {
    const m = block.match(/^([^"]+)"/);
    if (!m || m[1] !== id) continue;
    const end = block.indexOf('</part>');
    return block.slice(block.indexOf('>') + 1, end);
  }
  throw new Error(`part ${id} not found`);
}
// raw melodic MIDI sequence from a source staff — exactly as Audiveris read it (no normalize/correct)
function rawMidiSeq(part) {
  const out = [];
  for (const [file, id] of PART_STAVES[part]) {
    const xml = fs.readFileSync(path.join(__dirname, 'source', file), 'utf8');
    const inner = getPartInner(xml, id);
    for (const ch of inner.split(/<note[ >]/).slice(1)) {
      if (/<rest\b/.test(ch) || /<chord\s*\/?>/.test(ch)) continue;
      const pm = ch.match(/<step>([A-G])<\/step>\s*(?:<alter>(-?\d+)<\/alter>\s*)?<octave>(\d+)<\/octave>/);
      if (!pm) continue;
      out.push({ midi: (Number(pm[3]) + 1) * 12 + SEMI[pm[1]] + (pm[2] ? Number(pm[2]) : 0), src: `${file}:${id}` });
    }
  }
  return out;
}

// LCS diff of two MIDI sequences → ops: match | sub | ins(engraving-only) | del(raw-only)
function diff(rawArr, engArr) {
  const a = rawArr.map((x) => x.midi), b = engArr.map((x) => x.midi);
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = []; let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push({ op: 'match', raw: a[i], eng: b[j] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ op: 'del', raw: a[i], engMeasure: engArr[j]?.measure }); i++; }
    else { ops.push({ op: 'ins', eng: b[j], engMeasure: engArr[j].measure }); j++; }
  }
  while (i < n) { ops.push({ op: 'del', raw: a[i] }); i++; }
  while (j < m) { ops.push({ op: 'ins', eng: b[j], engMeasure: engArr[j].measure }); j++; }
  return ops;
}

const report = { generatedAt: new Date().toISOString(), method: 'corrections-diff: raw Audiveris source staff vs shipped engraving (MIDI sequence LCS)', parts: {} };
let totalSuspect = 0;
for (const part of ['Lead', 'Baritone']) {
  const raw = rawMidiSeq(part);
  const eng = scoreEventsFromXml(fs.readFileSync(path.join(RBW, ENGRAVING[part]), 'utf8')).map((e) => ({ midi: e.midi, measure: e.measure }));
  const ops = diff(raw, eng);
  const matches = ops.filter((o) => o.op === 'match').length;
  const ins = ops.filter((o) => o.op === 'ins');   // notes the engraving ADDED vs raw (inserted/restored bars)
  const del = ops.filter((o) => o.op === 'del');    // notes raw had that the engraving dropped/changed
  const suspects = ins.length + del.length;
  totalSuspect += suspects;
  report.parts[part] = {
    rawNotes: raw.length, engravingNotes: eng.length, matched: matches, divergences: suspects,
    inserted: ins.map((o) => `m${o.engMeasure}:${noteName(o.eng)}`),
    raw_only: del.map((o) => noteName(o.raw)),
  };
  console.log(`\n=== ${part} === raw Audiveris ${raw.length} notes vs engraving ${eng.length} notes`);
  console.log(`matched in-sequence: ${matches} · DIVERGENCES (suspects): ${suspects} (${ins.length} engraving-added, ${del.length} raw-only)`);
  console.log(`  engraving-added (our insertions/corrections): ${ins.map((o) => `m${o.engMeasure}:${noteName(o.eng)}`).join(' ') || '(none)'}`);
  console.log(`  raw-only (Audiveris had, engraving changed/dropped): ${del.map((o) => noteName(o.raw)).join(' ') || '(none)'}`);
}
const OUT = path.join(__dirname, 'lock', 'lida-rose', 'corrections-diff.json');
fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
console.log(`\nTOTAL suspect divergences (rows to verify vs the page): ${totalSuspect}`);
console.log(`wrote ${path.relative(RBW, OUT)}`);
console.log('NOTE (Codex HIGH): rows where raw==engraving are NOT proven — they share Audiveris errors; Layer-2 (oemer/Jon) covers those.');
