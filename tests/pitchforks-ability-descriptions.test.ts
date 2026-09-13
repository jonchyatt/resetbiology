import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/PitchDefender/PitchforksIII.tsx', 'utf8')
const statusIDs = ['close-smash', 'bell', 'galvanic', 'thunderhead'].map(name => `pf3-${name}-status`)
for (const id of statusIDs) {
  assert.equal(source.match(new RegExp(`\\sid="${id}"`, 'g'))?.length, 1,
    `${id} must have exactly one real id, not just a test selector`)
  assert.ok(source.includes(`aria-describedby="${id}"`), `${id} remains connected to its action`)
  assert.match(source, new RegExp(`data-testid="${id}"\\s+id="${id}"[\\s\\S]*?role="status"`))
}
console.log('pitchforks ability descriptions: 4/4 status associations PASS (source check, not screen-reader acceptance)')
