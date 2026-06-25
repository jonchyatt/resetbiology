// build-triage-layer2.mjs
// PLUMB deterministic judge — LAYER 2 (FLW-approved-with-corrections 2026-06-25, bw7ac7zmr.output).
// NOT a lock proof — a ledger-FILL + risk-TRIAGE method. Honors the FLW corrections:
//   [HIGH] the 213 raw-agreement rows are NOT written "match" (they get NO binding verdict —
//          they remain for the court). Provisional triage lives HERE (side artifact), never as
//          a fake verdict in the binding ledger.
//   [MED]  two independent eyes (Claude + Argus) on the concentrated-risk rows (vision-reads.json).
//   [MED]  confidence tiers are tied to evidence (corrections-diff + the page), not bare assertion.
// Output:
//   1) lock/lida-rose/triage-layer2.json — ALL 232 rows classified (auditable, reproducible).
//   2) writes BLOCKING into the binding discrepancy-ledger.csv for the page-read suspect rows only,
//      then re-hashes the ledger into MANIFEST.json. Gate stays RED (BLOCKING + no Jon sign-off).
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKT = path.join(__dirname, 'lock', 'lida-rose');
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

const ledgerPath = path.join(PKT, 'discrepancy-ledger.csv');
const manifestPath = path.join(PKT, 'MANIFEST.json');
const diff = JSON.parse(fs.readFileSync(path.join(PKT, 'corrections-diff.json'), 'utf8'));
const vision = JSON.parse(fs.readFileSync(path.join(PKT, 'vision-reads.json'), 'utf8'));
const M = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// ── confidence map (keyed part:measure) — WHY each intervention is what tier, from the
//    rationale committed in lida-lead-source-corrections.mjs (cited, not invented) ─────────
const TIER = {
  // Lead
  'Lead:4':  ['deterministic', 'key-normalization: 6-flat key flats raw D-natural to Db (=C#4); raw exported without <alter>. Algorithmic — the page carries no accidental, so Db is forced by the key signature.'],
  'Lead:9':  ['intervention', 'phrase-end held Cb4 (Audiveris dropped the whole-note bar; barbershop cadence).'],
  'Lead:13': ['intervention', 'phrase-end held Cb4 (dropped bar restored).'],
  'Lead:22': ['intervention', 'phrase-end held Cb4 (dropped bar restored).'],
  'Lead:30': ['intervention', 'phrase Eb4 held (dropped bar restored).'],
  'Lead:35': ['intervention', 'transition tie-stop B3 half + half-rest (printed on p199 Ewart staff).'],
  // Baritone
  'Baritone:4':  ['intervention', 'phrase-end Cb4 (cadence).'],
  'Baritone:5':  ['page-read', 'restored-from-SILENCE bar "sky"=F3; corrections file labels HIGH (same Cb4-Lead cadence as "shy") but it is a page-image read — and vision flags an m5(high)/m9(low) tension since BOTH are claimed F3.'],
  'Baritone:9':  ['page-read', 'held bar "shy"=F3 — corrections file explicitly "page-image read (flagged for review)". Vision: note sits LOW on staff, SUSPECTED below F3.'],
  'Baritone:13': ['intervention', 'held bar "chime"=Cb4 — the contract’s named value.'],
  'Baritone:19': ['deterministic', 'rhythm fix: homophony proved 8 eighths vs Audiveris’ 7; appended the symmetric closing Db4. Pitch follows the established run pattern.'],
  'Baritone:21': ['page-read', 'held bar "name"=Cb4 — corrections file "page-image read". Vision: page draws an editorial "(b)" flat => corroborates Cb4.'],
  'Baritone:25': ['split', 'restored-from-SILENCE bar: "hop"=Db4 (corrections file MODERATE, root-double) + "ing"=Bb3 (HIGH, completes the Eb triad).'],
  'Baritone:29': ['page-read', 'restored-from-SILENCE bar "fine"=Eb3 — corrections file MODERATE (octave-double of Lead Eb4). Vision: mid-staff, Eb3-vs-D3 ambiguous.'],
};

// the page-read suspect rows that go BLOCKING in the binding ledger (court = Jon).
// Hardcoded by ledger row + asserted against (part,measure) to catch any drift.
const BLOCKING_ROWS = [
  { row: 123, part: 'Baritone', measure: 5,  word: 'sky'  },
  { row: 140, part: 'Baritone', measure: 9,  word: 'shy'  },
  { row: 182, part: 'Baritone', measure: 21, word: 'name' },
  { row: 200, part: 'Baritone', measure: 25, word: 'hop'  },
  { row: 212, part: 'Baritone', measure: 29, word: 'fine' },
];

// suspect (part -> set of "measure:pitch") from the frozen corrections-diff
const suspectSet = {};
for (const [part, d] of Object.entries(diff.parts)) {
  suspectSet[part] = new Set((d.inserted || []).map((s) => s.replace(/^m/, '')));  // "9:B3"
}

// ── load ledger, classify every row ──────────────────────────────────────────
const lines = fs.readFileSync(ledgerPath, 'utf8').trim().split('\n');
const header = lines[0].split(',');
const COL = Object.fromEntries(header.map((h, i) => [h, i]));
const rows = lines.slice(1).map((l) => l.split(','));
if (rows.length !== M.ledger.rows) throw new Error(`ledger ${rows.length} != manifest ${M.ledger.rows}`);

const blockingByRow = new Map(BLOCKING_ROWS.map((b) => [b.row, b]));
const triage = { generatedAt: new Date().toISOString(), method: 'Layer-2 triage: corrections-diff classification + corrections-file confidence + independent vision (Claude+Argus). Provisional — NOT a lock; court of record = Jon (A4).', counts: {}, rows: [] };
const counts = { 'raw-agreement': 0, deterministic: 0, intervention: 0, 'page-read-BLOCKING': 0 };

for (const r of rows) {
  const rowNum = Number(r[COL.row]);
  const part = r[COL.part];
  const measure = Number(r[COL.measure]);
  const pitch = r[COL.engraving_pitch];
  const key = `${part}:${measure}`;
  const isSuspect = suspectSet[part] && suspectSet[part].has(`${measure}:${pitch}`);
  const block = blockingByRow.get(rowNum);

  let category, tier, why, vis = null;
  if (block) {
    // assert no drift
    if (block.part !== part || block.measure !== measure) throw new Error(`BLOCKING row ${rowNum} drift: expected ${block.part} m${block.measure}, ledger has ${part} m${measure}`);
    category = 'page-read-BLOCKING';
    [tier, why] = TIER[key] || ['page-read', '(page-read suspect)'];
    vis = (vision.reads[`${part}:${measure}`]) || null;
    counts['page-read-BLOCKING']++;
  } else if (isSuspect) {
    const t = TIER[key];
    if (t && t[0] === 'deterministic') { category = 'deterministic'; [tier, why] = t; counts.deterministic++; }
    else { category = 'intervention'; [tier, why] = t || ['intervention', '(intervention — see corrections file)']; counts.intervention++; }
  } else {
    category = 'raw-agreement';
    tier = 'raw-agreement';
    why = 'raw Audiveris read == engraving (untouched). Shared-Audiveris-error risk (Codex HIGH) — covered by the stratified sample log, court of record = Jon.';
    counts['raw-agreement']++;
  }
  triage.rows.push({ row: rowNum, part, measure, page: r[COL.page], engraving_pitch: pitch, category, tier, why, ...(vis ? { vision: vis } : {}) });
}
triage.counts = counts;

// ── write BLOCKING into the binding ledger (verdict col). NO other row gets a verdict. ──
for (const r of rows) {
  const rowNum = Number(r[COL.row]);
  const block = blockingByRow.get(rowNum);
  if (!block) continue;
  const vis = vision.reads[`${block.part}:${block.measure}`] || {};
  r[COL.verdict] = 'BLOCKING';
  r[COL.reviewer] = 'claude+argus(vision); court=Jon';
  // notes: NO commas (CSV). semicolons only.
  const claude = vis.claude ? `C:${vis.claude.read}` : '';
  const argus = vis.argus ? `A:${vis.argus.read}` : '';
  r[COL.notes] = `"${block.word}" eng=${r[COL.engraving_pitch]}; ${claude} ${argus}; ${vis.two_eye || vis.flag || ''}`.replace(/,/g, ';');
}
const newCsv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n') + '\n';
fs.writeFileSync(ledgerPath, newCsv);

// ── re-hash the ledger into the manifest (the only frozen artifact we changed) ──
M.ledger.sha256 = sha(ledgerPath);
fs.writeFileSync(manifestPath, JSON.stringify(M, null, 2) + '\n');

fs.writeFileSync(path.join(PKT, 'triage-layer2.json'), JSON.stringify(triage, null, 2) + '\n');

console.log('=== LIDA ROSE — LAYER 2 TRIAGE ===');
console.log(`rows classified: ${triage.rows.length}`);
for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);
console.log(`BLOCKING written to binding ledger: ${BLOCKING_ROWS.map((b) => `r${b.row}(${b.part} m${b.measure} "${b.word}")`).join(', ')}`);
console.log('ledger re-hashed into MANIFEST.json. Now run: node scripts/omr/verify-packet-ready.mjs');
console.log('triage -> scripts/omr/lock/lida-rose/triage-layer2.json (provisional; court of record = Jon A4)');
