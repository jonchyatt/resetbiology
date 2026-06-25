// verify-packet-ready.mjs
// PLUMB mechanical gate (no narration). Re-hashes every frozen artifact in the Lida Rose
// lock packet (so a tampered or missing artifact is caught), checks the ledger schema +
// coverage, and emits TWO verdicts:
//   PACKET-READINESS — GREEN = frozen + hashed + scaffolded, sufficient to BEGIN note-level
//                      comparison. (This is all step 1 claims.)
//   ENGRAVING-LOCK   — stays RED until EVERY ledger row has a verdict, ZERO are BLOCKING,
//                      and Jon has signed (manifest.signoff.jon). The operator cannot type
//                      "locked" — this script decides it, from artifacts on disk.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RBW = path.join(__dirname, '..', '..');
const PKT = path.join(__dirname, 'lock', 'lida-rose');
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const abs = (r) => path.join(RBW, r);

const manifestPath = path.join(PKT, 'MANIFEST.json');
if (!fs.existsSync(manifestPath)) {
  console.log('PACKET-READINESS: RED — no MANIFEST.json (run build-lock-packet.mjs first)');
  process.exit(1);
}
const M = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const fail = [];

// 1) re-hash every frozen artifact
const files = [...M.authority.files, ...M.engraving.musicxml, ...M.engraving.renders, M.map, M.ledger];
for (const f of files) {
  if (!fs.existsSync(abs(f.path))) { fail.push(`MISSING ${f.path}`); continue; }
  if (sha(abs(f.path)) !== f.sha256) fail.push(`HASH MISMATCH ${f.path}`);
}

// 2) ledger schema + coverage
let filled = 0, blocking = 0, total = 0;
if (fs.existsSync(abs(M.ledger.path))) {
  const lines = fs.readFileSync(abs(M.ledger.path), 'utf8').trim().split('\n');
  const need = ['row', 'part', 'note_index', 'measure', 'page', 'engraving_pitch', 'page_pitch_read', 'verdict', 'reviewer', 'notes'];
  if (lines[0].split(',').join(',') !== need.join(',')) fail.push('LEDGER columns wrong');
  total = lines.length - 1;
  if (total !== M.ledger.rows) fail.push(`LEDGER rows ${total} != manifest ${M.ledger.rows}`);
  for (const ln of lines.slice(1)) {
    const v = (ln.split(',')[7] || '').trim();
    if (v) filled++;
    if (v === 'BLOCKING') blocking++;
  }
}

const packetReady = fail.length === 0;
const ledgerComplete = packetReady && total > 0 && filled === total;
const signed = !!(M.signoff && M.signoff.jon);
const engravingLock = ledgerComplete && blocking === 0 && signed;

console.log('=== LIDA ROSE — MECHANICAL READINESS (verify-packet-ready) ===');
fail.forEach((f) => console.log('  RED:', f));
console.log(`PACKET-READINESS: ${packetReady ? 'GREEN — frozen + hashed; sufficient to BEGIN note-level comparison' : 'RED — packet incomplete'}`);
console.log(`  ledger: ${filled}/${total} verdicts filled · ${blocking} BLOCKING · Jon sign-off: ${signed ? 'YES' : 'NO'}`);
console.log(`ENGRAVING-LOCK: ${engravingLock ? 'GREEN — LOCKED' : 'RED — NOT locked'}` +
  (engravingLock ? '' : `  [needs: ${[!ledgerComplete && 'every row verdict-filled', blocking > 0 && `clear ${blocking} BLOCKING`, !signed && 'Jon sign-off'].filter(Boolean).join(' · ')}]`));

// exit 0 only when the packet is READY for step 2 (comparison); never conflate with LOCK.
process.exit(packetReady ? 0 : 1);
