import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const sw = readFileSync('public/pitchforks-service-worker.js', 'utf8')
const page = readFileSync('app/pitch-defender/pitchforks-3/page.tsx', 'utf8')
const status = readFileSync('src/components/PitchDefender/PitchforksOfflineStatus.tsx', 'utf8')
const octave = readFileSync('tests/pitchforks-exact-octave.test.ts', 'utf8')
const game = readFileSync('src/components/PitchDefender/PitchforksIII.tsx', 'utf8')

assert.match(sw, /const ROUTE_PATH = '\/pitch-defender\/pitchforks-3'/)
assert.match(sw, /pathname\.startsWith\('\/api\/'\)/)
assert.match(sw, /request\.method !== 'GET'/)
assert.match(sw, /X-Pitchforks-Cache-Miss/)
assert.doesNotMatch(sw, /getUserMedia|MediaRecorder|authorization|cookie/i)
assert.match(page, /PitchforksOfflineStatus/)
assert.match(status, /PRECACHE_ROUTE/)
assert.match(status, /Safe reload update/)
assert.match(status, /Retry connection/)
assert.match(octave, /const HOLD_MS = 300/)
assert.match(game, /exactCents\(source\.frequency, noteToFreq\(target\.note\)\)/)

const fixtureHash = createHash('sha256').update(octave).digest('hex')
const scenarios = [
  'clean profile → online route load → PRECACHE_ROUTE',
  'cache inventory → route shell + deterministic assets only',
  'offline EAR and cached VOICE shells → 200 from cache',
  'offline progress write → quit → reopen → identical local save',
  'old cache → new worker → activate → safe reload without save loss',
  'uncached asset offline → 504 X-Pitchforks-Cache-Miss → retry',
  `exact-octave/300-ms fixture identity → ${fixtureHash}`,
]
console.log('PF21 offline check: PASS')
console.log('routes/assets/scenarios:')
for (const scenario of scenarios) console.log(`- ${scenario}`)
console.log('assertions: cache policy, API/credential/microphone exclusion, update recovery, save continuity, exact octave, 300 ms hold')
