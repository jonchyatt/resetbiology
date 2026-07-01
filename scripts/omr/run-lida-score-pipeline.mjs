// run-lida-score-pipeline.mjs
// Full score-first regeneration gate for Vocal Trainer III Lida Rose.
//
// The important invariant is order:
//   score MusicXML -> source gate -> timing/sync -> conductor-v2 -> plunk/UI gates.
// If the generated engraving does not match the corrected source pages, this
// script exits before any plunk/highlight timing artifact is regenerated.
import { spawnSync } from 'child_process';

const verifyOnly = process.argv.includes('--verify-only');
const visual = process.argv.includes('--visual');
const started = Date.now();

const phases = [
  {
    name: '1. Generate engraving MusicXML from corrected source pages',
    skip: verifyOnly,
    commands: [
      ['node', 'scripts/omr/build-tenor-musicxml.mjs'],
      ['node', 'scripts/omr/build-lead-musicxml.mjs'],
      ['node', 'scripts/omr/build-baritone-musicxml.mjs'],
      ['node', 'scripts/omr/build-bass-musicxml.mjs'],
      ['node', 'scripts/omr/build-lida-quartet-musicxml.mjs'],
    ],
  },
  {
    name: '2. Gate generated engraving against corrected printed-source measures',
    commands: [
      // Absolute notation-law gate FIRST: catches mistakes IN the corrections
      // (3-beat bars, cross-pitch ties, dropped/extra bars) that the source gate
      // below — which grades the corrections against themselves — structurally cannot.
      ['node', 'scripts/omr/verify-score-invariants.mjs', 'lida-rose'],
      ['node', 'scripts/omr/verify-lida-score-source-gate.mjs'],
    ],
  },
  {
    name: '2b. Build measure-level visual audit pack',
    skip: !visual,
    commands: [
      ['node', 'scripts/omr/build-lida-visual-audit.mjs'],
      ['node', 'scripts/omr/verify-lida-visual-audit.mjs'],
    ],
  },
  {
    name: '3. Derive timing only after the score gate passes',
    skip: verifyOnly,
    commands: [
      ['node', 'scripts/omr/build-tenor-sync.mjs'],
      ['node', 'scripts/omr/build-lead-sync.mjs'],
      ['node', 'scripts/omr/build-baritone-sync.mjs'],
      ['node', 'scripts/omr/build-bass-sync.mjs'],
      ['node', 'scripts/omr/build-tenor-score-health.mjs'],
      ['node', 'scripts/omr/build-lida-score-health.mjs'],
      ['node', 'scripts/omr/build-baritone-score-health.mjs'],
      ['node', 'scripts/omr/build-bass-score-health.mjs'],
      ['node', 'scripts/omr/build-lida-conductor-v2.mjs'],
    ],
  },
  {
    name: '4. Verify score, timing, conductor, plunk, and UI wiring',
    commands: [
      ['node', 'scripts/omr/verify-lida-lead-engraving.mjs'],
      ['node', 'scripts/omr/verify-lida-baritone-engraving.mjs'],
      ['node', 'scripts/omr/verify-lida-conductor-v2.mjs'],
      ['node', 'scripts/omr/verify-vt3-plunk-sync.mjs'],
    ],
  },
];

for (const phase of phases) {
  console.log(`\n=== ${phase.name}${phase.skip ? ' (verify-only: skipped)' : ''} ===`);
  if (phase.skip) continue;
  for (const command of phase.commands) run(command);
}

console.log(`\nLida score pipeline PASS (${((Date.now() - started) / 1000).toFixed(1)}s)`);
console.log(verifyOnly
  ? 'verify-only mode: no artifacts were regenerated'
  : 'regenerated artifacts are score-gated before timing/plunk output');
if (visual) {
  console.log('visual mode: measure-level printed-score crops were generated and verified before timing');
}

function run(command) {
  console.log(`$ ${command.join(' ')}`);
  const result = spawnSync(command[0], command.slice(1), {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
  if (result.error) {
    console.error(`command failed to launch: ${command.join(' ')}\n${result.error.stack || result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`command failed (${result.status}): ${command.join(' ')}`);
    process.exit(result.status || 1);
  }
}
