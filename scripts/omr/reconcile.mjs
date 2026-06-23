// reconcile.mjs
// Compatibility guard for the old Lead reconciliation command. The Lead sync
// builder now emits both lida-rose-lead-sync.json and
// lida-rose-lead-reconciled.json from the same score-conductor pass, so this
// script validates that state instead of overwriting it with dense audio timing.
import fs from 'fs';

const RBW = 'C:/Users/jonch/reset-biology-website';
const SYNC = `${RBW}/public/musicxml/lida-rose-lead-sync.json`;
const RECONCILED = `${RBW}/public/musicxml/lida-rose-lead-reconciled.json`;

const sync = JSON.parse(fs.readFileSync(SYNC, 'utf8'));
const reconciled = JSON.parse(fs.readFileSync(RECONCILED, 'utf8'));
const syncNotes = sync.notes || [];
const reconciledNotes = reconciled.notes || [];
const errors = [];

if (!/score-conductor/i.test(sync.source || '')) {
  errors.push(`Lead sync is not score-conductor: ${sync.source || 'missing source'}`);
}
if (!/score-conductor/i.test(reconciled.method || '')) {
  errors.push(`Lead reconciled method is not score-conductor: ${reconciled.method || 'missing method'}`);
}
if (syncNotes.length !== reconciledNotes.length) {
  errors.push(`sync/reconciled count mismatch: ${syncNotes.length} vs ${reconciledNotes.length}`);
}
if ((sync.audit?.conductorAnchors ?? 0) < 18) {
  errors.push(`Lead conductor anchors too sparse: ${sync.audit?.conductorAnchors ?? 'missing'}`);
}
if ((sync.audit?.tempoSmoothness?.scoreConductor?.p90RateJumpSecPerBeat ?? 99) > 0.5) {
  errors.push(`Lead conductor timing too jittery: ${JSON.stringify(sync.audit?.tempoSmoothness?.scoreConductor)}`);
}
if ((sync.audit?.tempoSmoothness?.scoreConductor?.maxRateJumpSecPerBeat ?? 99) > 0.45) {
  errors.push(`Lead conductor timing has a cliff: ${JSON.stringify(sync.audit?.tempoSmoothness?.scoreConductor)}`);
}

for (let i = 0; i < syncNotes.length; i++) {
  const a = syncNotes[i];
  const b = reconciledNotes[i];
  if (!b) break;
  if (
    a.pitchMidi !== b.pitchMidi ||
    a.startTimeSeconds !== b.startTimeSeconds ||
    a.durationSeconds !== b.durationSeconds
  ) {
    errors.push(`sync/reconciled mismatch at note ${i + 1}`);
    break;
  }
}

if (errors.length) {
  console.error('LEAD RECONCILE GUARD FAILED');
  for (const error of errors) console.error(`  ${error}`);
  console.error('Run: node scripts/omr/build-lead-sync.mjs');
  process.exit(1);
}

console.log('Lead reconcile guard PASS');
console.log(`score-conductor anchors=${sync.audit.rawConductorAnchors ?? sync.audit.conductorAnchors}->${sync.audit.conductorAnchors}; scoreConductor=${sync.audit.scoreConductorNotes}; p90/max=${sync.audit.tempoSmoothness.scoreConductor.p90RateJumpSecPerBeat}/${sync.audit.tempoSmoothness.scoreConductor.maxRateJumpSecPerBeat}`);
console.log('Rebuild source: node scripts/omr/build-lead-sync.mjs');
