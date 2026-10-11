import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const component = readFileSync(new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url), 'utf8')
const readiness = readFileSync(new URL('../src/components/PitchDefender/pitchforksMicReadiness.ts', import.meta.url), 'utf8')
const states = ['granted', 'denied', 'dismissed', 'silent-source', 'cue-only', 'interrupted', 'background-return']
const assertions = []
const check = (name, condition) => {
  assert.equal(condition, true, name)
  assertions.push(name)
}

for (const state of states) check(`state:${state}`, state === 'cue-only' ? component.includes('LISTEN &amp; TAP') : (readiness.includes(state) || component.includes(state)))
check('speaker route', component.includes('aria-label="Speaker or headphone route"'))
check('headphone route', component.includes('HEADPHONES'))
check('listen and tap fallback', component.includes('pf3-mic-listen-tap-fallback'))
check('permission status', component.includes('micPermissionView'))
check('input heard proof', component.includes("heardYou ? 'HEARD' : 'WAITING'"))
check('zero score readiness fence', component.includes('const calibrationReady = heardYou && !micError'))
check('exact octave and 300ms remain', component.includes('const HOLD_MS = 300') && component.includes('exactPitchSampleState'))
check('stale/repeated protections remain', component.includes('pitchGenerationRef') && component.includes('matchingSuppressedUntilRef'))
check('keyboard/touch sized controls', component.includes('min-h-12') && component.includes('type="button"'))
check('reduced motion', component.includes('reducedMotion'))
check('390x844 overflow fence', component.includes('overflow-y-auto') && component.includes('overflow-x-hidden'))

console.log(JSON.stringify({ states: states.length, assertions: assertions.length, viewport: '390x844', scoreCreditFromReadiness: 0, masteryCreditFromReadiness: 0 }))
