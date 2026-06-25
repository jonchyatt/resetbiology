// build-measure-map.mjs
// PLUMB — LOCK the staff/measure/page mapping (Codex HIGH; the silent-offset guard, FLW #1 risk).
// Replays the EXACT engraving assembly (same normalize + corrections + trim + renumber as
// build-{lead,baritone}-musicxml.mjs) but TAGS every final engraving measure with its
// provenance: which page it came from and its source-local measure number (or that it is an
// INSERT). Output = the one authoritative engraving# -> {page, sourceLocal|insert} map.
// Then RECONCILES the baritone printed-manifest (which counts cumulative SOURCE bars, no
// inserts) onto the engraving numbering, so its m9/m18/m31 "audit FAILs" are resolved as
// real-vs-numbering-artifact deterministically.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeLeadMeasure } from './lida-lead-key-normalize.mjs';
import { applyLeadMeasureCorrections } from './lida-lead-source-corrections.mjs';
import { scoreEventsFromXml, noteName } from './score-timing.mjs';
import { PRINTED_BARITONE_AUDIT_MEASURES } from './lida-baritone-printed-manifest.mjs';
import { PRINTED_LEAD_AUDIT_MEASURES } from './lida-lead-printed-manifest.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RBW = path.join(__dirname, '..', '..');
const SRC = (f) => path.join(__dirname, 'source', f);
const LCM = 12;
const PARTS = {
  Lead: [{ pg: '196', file: 'lida-196.xml', staff: 'P3' }, { pg: '197', file: 'lida-197.xml', staff: 'P2' }, { pg: '198', file: 'lida-198.xml', staff: 'P2' }],
  Baritone: [{ pg: '196', file: 'lida-196.xml', staff: 'P4' }, { pg: '197', file: 'lida-197.xml', staff: 'P3' }, { pg: '198', file: 'lida-198.xml', staff: 'P3' }],
};
const pageFile = (pg) => `page-${pg}.jpg`;

function getPartInner(xml, id) {
  for (const pb of xml.split('<part id="').slice(1)) {
    const m = pb.match(/^([^"]+)"/);
    if (m?.[1] !== id) continue;
    return pb.slice(pb.indexOf('>') + 1, pb.indexOf('</part>'));
  }
  throw new Error(`part ${id} not found`);
}

// replay the assembly, tagging each unit with {pg, srcLocal} (srcLocal from the pre-renumber number=)
function assemble(part) {
  const tagged = [];
  for (const { pg, file, staff } of PARTS[part]) {
    const xml = fs.readFileSync(SRC(file), 'utf8');
    let inner = getPartInner(xml, staff);
    const a = inner.indexOf('<measure '); const b = inner.lastIndexOf('</measure>');
    inner = inner.slice(a, b + '</measure>'.length);
    const div = Number((inner.match(/<divisions>(\d+)<\/divisions>/) || [])[1] || 1);
    inner = inner.replace(/<duration>(\d+)<\/duration>/g, (_, n) => `<duration>${Number(n) * (LCM / div)}</duration>`);
    // source-local measure numbers BEFORE corrections (the real page bars)
    const srcUnits = (inner.match(/<measure\b[\s\S]*?<\/measure>/g) || []);
    const srcNums = new Set(srcUnits.map((u) => (u.match(/number="([^"]+)"/) || [])[1]));
    let units = srcUnits.map(normalizeLeadMeasure);
    units = applyLeadMeasureCorrections(pg, units, { part, divisions: LCM });
    for (const u of units) {
      const num = (u.match(/<measure number="([^"]+)"/) || [])[1];
      const isInsert = !srcNums.has(num) || Number(num) >= 100;   // fake insert numbers (900,905,913,...) or replaced
      tagged.push({ pg, srcLocal: num, isInsert, hasNote: /<note\b/.test(u) });
    }
  }
  // trim trailing empty (build-*-musicxml trims trailing note-less measures)
  while (tagged.length && !tagged[tagged.length - 1].hasNote) tagged.pop();
  // renumber 1..N = engraving measure
  return tagged.map((t, i) => ({ eng: i + 1, page: pageFile(t.pg), srcPage: t.pg, srcLocal: t.srcLocal, insert: t.isInsert }));
}

const map = {};
for (const part of ['Lead', 'Baritone']) map[part] = assemble(part);

// ── reconcile the baritone printed-manifest (cumulative SOURCE-bar numbering, no inserts) ──
// manifest measure N = the Nth SOURCE bar overall. Map N -> (page, page-local source bar) using
// the known source counts (196=8, 197=10, 198=14), then find the engraving measure whose
// srcPage+srcLocal match. Compare by MIDI (enharmonic-safe: B3==Cb4), not by spelling.
const SRC_COUNTS = { '196': 8, '197': 10, '198': 14 };
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const pitchToMidi = (p) => {
  const m = p.match(/^([A-G])(b|#)?(\d)$/); if (!m) return NaN;
  return (Number(m[3]) + 1) * 12 + SEMI[m[1]] + (m[2] === 'b' ? -1 : m[2] === '#' ? 1 : 0);
};
function manifestToPageLocal(n) {
  if (n <= SRC_COUNTS['196']) return { pg: '196', local: n };
  if (n <= SRC_COUNTS['196'] + SRC_COUNTS['197']) return { pg: '197', local: n - SRC_COUNTS['196'] };
  return { pg: '198', local: n - SRC_COUNTS['196'] - SRC_COUNTS['197'] };
}
const engEvents = scoreEventsFromXml(fs.readFileSync(path.join(RBW, 'public/musicxml/lida-rose-baritone.musicxml'), 'utf8'));
const engMidiByMeasure = {};
for (const e of engEvents) (engMidiByMeasure[e.measure] = engMidiByMeasure[e.measure] || []).push(e.midi);
const engNameByMeasure = {};
for (const e of engEvents) (engNameByMeasure[e.measure] = engNameByMeasure[e.measure] || []).push(noteName(e.midi));

const reconcile = [];
for (const pt of PRINTED_BARITONE_AUDIT_MEASURES) {
  const manifestN = pt.measure;
  const { pg, local } = manifestToPageLocal(manifestN);
  const engRow = map.Baritone.find((m) => m.srcPage === pg && m.srcLocal === String(local) && !m.insert);
  const engNum = engRow ? engRow.eng : null;
  const expMidi = pt.notes.map((x) => pitchToMidi(x.pitch));
  const engMidi = engNum ? (engMidiByMeasure[engNum] || []) : [];
  const sameMidi = expMidi.length === engMidi.length && expMidi.every((v, i) => v === engMidi[i]);
  reconcile.push({
    manifestMeasure: manifestN, source: pt.source, mappedTo: `${pg} local ${local}`,
    expected: pt.notes.map((x) => x.pitch).join(' '),
    reconciledEngMeasure: engNum, engPitchesThere: engNum ? engNameByMeasure[engNum].join(' ') : '(?)',
    naiveSameNumberEng: (engNameByMeasure[manifestN] || []).join(' '),
    agreesByMidi: sameMidi, verdict: sameMidi ? 'AGREE (numbering+spelling artifact — NOT an error)' : 'DIFFERS — real suspect for Jon',
  });
}

// ── Lead printed-manifest: uses ENGRAVING numbering directly (lyric-anchored to the inserted
//    held bars), so compare manifest-N to engraving-N by MIDI. ──
const leadEvents = scoreEventsFromXml(fs.readFileSync(path.join(RBW, 'public/musicxml/lida-rose-lead.musicxml'), 'utf8'));
const leadMidiByMeasure = {}, leadNameByMeasure = {};
for (const e of leadEvents) { (leadMidiByMeasure[e.measure] = leadMidiByMeasure[e.measure] || []).push(e.midi); (leadNameByMeasure[e.measure] = leadNameByMeasure[e.measure] || []).push(noteName(e.midi)); }
const leadReconcile = PRINTED_LEAD_AUDIT_MEASURES.map((pt) => {
  const expMidi = pt.notes.map((x) => pitchToMidi(x.pitch));
  const got = leadMidiByMeasure[pt.measure] || [];
  const same = expMidi.length === got.length && expMidi.every((v, i) => v === got[i]);
  return { engMeasure: pt.measure, source: pt.source, expected: pt.notes.map((x) => x.pitch).join(' '), engPitches: (leadNameByMeasure[pt.measure] || []).join(' '), agreesByMidi: same };
});

fs.writeFileSync(path.join(__dirname, 'lock', 'lida-rose', 'measure-map.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), note: 'authoritative engraving-measure -> page + source provenance (replayed from the build). insert=true means a held/restored bar with no source coordinates.', map, printedManifestReconcile: reconcile, leadManifestReconcile: leadReconcile, independentlyCorroborated: { note: 'engraving measures where an INDEPENDENT human page-read manifest AGREES by MIDI (a second signal, not Audiveris)', Baritone: reconcile.filter((r) => r.agreesByMidi).map((r) => r.reconciledEngMeasure), Lead: leadReconcile.filter((r) => r.agreesByMidi).map((r) => r.engMeasure) } }, null, 2) + '\n');

console.log('=== ENGRAVING -> PAGE boundaries (authoritative) ===');
for (const part of ['Lead', 'Baritone']) {
  const byPage = {};
  for (const m of map[part]) (byPage[m.srcPage] = byPage[m.srcPage] || []).push(m.eng);
  console.log(part + ':', Object.entries(byPage).map(([pg, e]) => `p${pg}=eng[${e[0]}..${e[e.length - 1]}]`).join('  '),
    '| inserts at eng', map[part].filter((m) => m.insert).map((m) => m.eng).join(','));
}
console.log('\n=== printed-manifest reconcile (was the m9/m18/m31 FAIL a numbering artifact?) ===');
for (const r of reconcile) {
  console.log(`manifest m${r.manifestMeasure} (${r.source}) -> ${r.mappedTo}`);
  console.log(`   manifest expected: ${r.expected}`);
  console.log(`   naive same-number eng m${r.manifestMeasure}: ${r.naiveSameNumberEng}  <- what the broken audit compared`);
  console.log(`   RECONCILED -> eng m${r.reconciledEngMeasure}: ${r.engPitchesThere}   ==>  ${r.verdict}`);
}
console.log('\n=== Lead printed-manifest (engraving numbering, MIDI) ===');
const leadAgree = leadReconcile.filter((r) => r.agreesByMidi).length;
console.log(`Lead: ${leadAgree}/${leadReconcile.length} AGREE — eng measures ${leadReconcile.filter((r) => r.agreesByMidi).map((r) => r.engMeasure).join(',')}`);
leadReconcile.filter((r) => !r.agreesByMidi).forEach((r) => console.log(`  DIFFER eng m${r.engMeasure}: exp ${r.expected} vs eng ${r.engPitches} (${r.source})`));
console.log(`\nINDEPENDENTLY CORROBORATED (human page-read agrees, not Audiveris): Baritone eng[${reconcile.filter((r) => r.agreesByMidi).map((r) => r.reconciledEngMeasure).join(',')}] + Lead eng[${leadReconcile.filter((r) => r.agreesByMidi).map((r) => r.engMeasure).join(',')}]`);
console.log('\nwrote lock/lida-rose/measure-map.json');
