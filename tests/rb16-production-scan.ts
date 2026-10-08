import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const buildDir = join(process.cwd(), '.next', 'server')
assert.ok(existsSync(buildDir), 'production build output must exist before the adapter scan')

const forbiddenMarkers = [
  'EphemeralJourneyStore',
  'rb16-local-free-journey',
  'fixture-a-session',
  'FixtureSessionAdapter',
]
let files = 0
let assertions = 0
function check(condition: unknown, message: string): void {
  assertions += 1
  assert.ok(condition, message)
}
function walk(directory: string): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) walk(path)
    else if (entry.isFile() && /\.(js|json|mjs|cjs)$/.test(entry.name)) {
      files += 1
      const content = readFileSync(path, 'utf8')
      for (const marker of forbiddenMarkers) check(!content.includes(marker), `production output excludes ${marker}`)
    }
  }
}
walk(buildDir)
check(files > 0, 'production build scan inspected emitted files')
console.log(`RB-16 production adapter absence: PASS (${assertions} assertions; ${files} files scanned)`)
