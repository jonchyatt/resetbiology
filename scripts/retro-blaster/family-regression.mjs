import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const protectedBase = process.env.RETRO_PROTECTED_BASE || '6f4c8da158b9773bbda90eef0cc51334e6fa636b'
const tsx = resolve(root, 'node_modules/tsx/dist/cli.mjs')
const cases = [
  ['R0 parity', ['scripts/retro-blaster/r0-parity.mjs']],
  ['E1 data purity', ['scripts/retro-blaster/e1-data-purity.mjs']],
  ['R1.5a parity', [tsx, 'scripts/retro-blaster/r15a-parity.ts']],
  ['R1.5a visual contract', ['scripts/retro-blaster/r15a-visual-contract.mjs']],
  ['R1.5b roster', [tsx, 'scripts/retro-blaster/r15b-roster-fixture.ts']],
  ['R2 sprite atlas', ['scripts/retro-blaster/r2-sprite-atlas-fixture.mjs']],
  ['R3b formation', [tsx, 'scripts/retro-blaster/r3b-formation-fixture.ts']],
  ['R3c authored dives', [tsx, 'scripts/retro-blaster/r3c-dive-fixture.ts']],
  ['R4 causal weapon VFX', [tsx, 'scripts/retro-blaster/r4-weapon-vfx-fixture.ts']],
  ['R7 FSRS soul-binding', [tsx, 'scripts/retro-blaster/r7-fsrs-soul-fixture.ts']],
  ['R8a radio check', [tsx, 'scripts/retro-blaster/r8a-readiness-fixture.ts']],
  ['R9a curriculum', [tsx, 'scripts/retro-blaster/r9a-curriculum-fixture.ts', '--green', 'data/retro-blaster-rework/runtime-logs/r9a-green-local/family-fixture-result.json']],
  ['R10 first-player mastery', [tsx, 'scripts/retro-blaster/r10-first-player-fixture.ts']],
  ['R8c signal check', [tsx, 'scripts/retro-blaster/r8c-signal-check-fixture.ts', '--green', 'data/retro-blaster-rework/runtime-logs/r8c-green-local/family-fixture-result.json']],
]

const rows = []
for (const [name, args] of cases) {
  const startedAt = Date.now()
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, RETRO_PROTECTED_BASE: protectedBase },
  })
  const stdout = result.stdout || ''
  const stderr = result.stderr || ''
  rows.push({
    name,
    status: result.status === 0 ? 'PASS' : 'FAIL',
    exitCode: result.status,
    durationMs: Date.now() - startedAt,
    stdoutSha256: createHash('sha256').update(stdout).digest('hex'),
    stderrSha256: createHash('sha256').update(stderr).digest('hex'),
    finalLine: stdout.trim().split(/\r?\n/).at(-1) || stderr.trim().split(/\r?\n/).at(-1) || '',
  })
  process.stdout.write(`[${rows.at(-1).status}] ${name}\n`)
  if (result.status !== 0) {
    process.stdout.write(stdout)
    process.stderr.write(stderr)
  }
}

const receipt = {
  status: rows.every(row => row.status === 'PASS') ? 'PASS' : 'FAIL',
  protectedBase,
  rows,
}
const receiptPath = resolve(
  root,
  'data/retro-blaster-rework/runtime-logs/family-regression/result.json',
)
mkdirSync(dirname(receiptPath), { recursive: true })
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)
console.log(JSON.stringify({ ...receipt, receiptPath }, null, 2))
if (receipt.status !== 'PASS') process.exitCode = 1
