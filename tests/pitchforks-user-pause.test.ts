import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
require.extensions['.css'] = () => undefined

async function main() {
const {
  acceptsPitchforksPauseCallback,
  advancePitchforksLogicalClock,
  createPitchforksPauseGate,
  assessPitchforksBossEntry,
  pitchforksPracticeBossForWorld,
  schedulePitchforksBossCueCompletion,
  transitionPitchforksPauseGate,
} = await import('../src/components/PitchDefender/PitchforksIII')

let gate = createPitchforksPauseGate()
const beforePause = gate
gate = transitionPitchforksPauseGate(gate, 'pause')

assert.equal(gate.paused, true)
assert.equal(advancePitchforksLogicalClock(1200, 5000, gate.paused), 1200)
assert.equal(acceptsPitchforksPauseCallback(gate, beforePause.generation, beforePause.fence), false)

const pausedGeneration = gate.generation
const pausedFence = gate.fence
gate = transitionPitchforksPauseGate(gate, 'resume')
assert.equal(gate.paused, false)
assert.equal(gate.generation, pausedGeneration + 1)
assert.equal(advancePitchforksLogicalClock(1200, 5000, gate.paused), 6200)
assert.equal(acceptsPitchforksPauseCallback(gate, pausedGeneration, pausedFence), false)
assert.equal(acceptsPitchforksPauseCallback(gate, gate.generation, gate.fence), true)

// A receipt clock resumes from its exact logical position; wall-clock delay
// while the user is typing cannot create a next-wave handoff.
assert.equal(advancePitchforksLogicalClock(1900, 1900, true), 1900)
assert.equal(advancePitchforksLogicalClock(1900, 1900, false), 3800)

// Exercise the same callback entry contract used by delayed runtime work:
// stale callbacks are dropped during pause and after resume until a fresh
// callback is scheduled for the new generation/fence.
let callbackCalls = 0
const guardedCallback = (callbackGeneration: number, callbackFence: number) => {
  if (!acceptsPitchforksPauseCallback(gate, callbackGeneration, callbackFence)) return
  callbackCalls += 1
}
guardedCallback(pausedGeneration, pausedFence)
assert.equal(callbackCalls, 0)
guardedCallback(gate.generation, gate.fence)
assert.equal(callbackCalls, 1)

assert.equal(pitchforksPracticeBossForWorld('dungeon'), 'torchmaster')
assert.equal(pitchforksPracticeBossForWorld('village-gate'), 'choirmaster')
assert.equal(pitchforksPracticeBossForWorld('bell-tower'), 'bellringer')
assert.equal(pitchforksPracticeBossForWorld('cathedral'), 'bellringer')
const practiceEntry = assessPitchforksBossEntry('bellringer', true, {
  torchmasterChamberPlate: true,
  bellringerChamberPlate: true,
  bellringerRest: true,
}, ['C4', 'D4'])
assert.equal(practiceEntry.available, true)
assert.equal(assessPitchforksBossEntry('bellringer', false, {
  torchmasterChamberPlate: true,
  bellringerChamberPlate: true,
  bellringerRest: true,
}, ['C4', 'D4']).available, false)

let cuePaused = true
let cueCompleted = false
schedulePitchforksBossCueCompletion(
  (callback, delayMs) => setTimeout(callback, delayMs),
  () => true,
  () => cuePaused,
  () => { cueCompleted = true },
  5,
  5,
)
await new Promise(resolve => setTimeout(resolve, 12))
assert.equal(cueCompleted, false)
cuePaused = false
await new Promise(resolve => setTimeout(resolve, 12))
assert.equal(cueCompleted, true)

const source = readFileSync(new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url), 'utf8')
assert.match(source, /rafRef\.current = requestAnimationFrame\(nextTs => loopRef\.current\?\.\(nextTs, pauseGateRef\.current\.fence\)\)/)
assert.ok((source.match(/acceptsPitchforksPauseCallback\(pauseGateRef\.current/g) ?? []).length >= 6, 'delayed runtime callbacks use the pause fence')
assert.match(source, /staffYForContinuousMidi\(staffMidi\(targetNote\) \+ view\.tuner\.renderDeviation\)/)
assert.match(source, /className="pf3-play-root fixed inset-0/)
assert.match(source, /data-testid="pf3-action-toolbar"/)
assert.match(source, /data-testid="pf3-secondary-actions"/)
assert.match(source, /createPortal\([\s\S]*PitchforksCloseSmashGuide[\s\S]*document\.body/)
assert.match(source, /const practiceStore: Record<string, NoteMemory> = \{\}/)
assert.match(source, /const lane = inputMode === 'buttons' \? 'ear' : 'voice'/)
assert.match(source, /beginBossPreview\(lane, pitchforksPracticeBossForWorld\(world\), null, true, world\)/)
}

void main()
