import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  admissionAllowedForWave,
  admissionRecallReady,
  attackTimeForCurriculum,
  cueSupportForNote,
  curriculumStageForWave,
  deterministicPairNotes,
  PATIENT_BEGINNER_LAST_WAVE,
  PATIENT_ATTACK_TIME_FLOOR_SECONDS,
  patientTineCountsForWave,
  replayLabelForCueSupport,
  villagerEntryX,
  waitForClearBeforeSpawn,
} from '../src/components/PitchDefender/pitchforksCurriculum'

assert.equal(curriculumStageForWave(1, false), 'guided-pair')
assert.equal(curriculumStageForWave(2, false), 'recall-pair')
assert.equal(curriculumStageForWave(3, false), 'step-chain')
assert.equal(curriculumStageForWave(4, false), 'step-chain')
assert.equal(curriculumStageForWave(12, false), 'step-chain')
assert.equal(curriculumStageForWave(13, false), 'intervals')
assert.equal(curriculumStageForWave(1, true), 'showcase')

assert.deepEqual(patientTineCountsForWave(1), [1, 1, 1, 1, 1, 1])
assert.deepEqual(patientTineCountsForWave(2), [1, 1, 1, 1, 1, 1])
assert.deepEqual(patientTineCountsForWave(3), [1, 1, 2, 2, 2])
assert.deepEqual(patientTineCountsForWave(4), [1, 2, 1, 2, 2])
assert.deepEqual(patientTineCountsForWave(5), [2, 1, 2, 1, 2])
assert.equal(PATIENT_BEGINNER_LAST_WAVE, 12)
assert.equal(PATIENT_ATTACK_TIME_FLOOR_SECONDS, 32)
for (let wave = 1; wave <= PATIENT_BEGINNER_LAST_WAVE; wave += 1) {
  const plan = patientTineCountsForWave(wave)
  assert.ok(plan, `patient plan missing for wave ${wave}`)
  assert.ok(plan!.every(tineCount => tineCount === 1 || tineCount === 2), `wave ${wave} has a 3/4-tine encounter`)
}
for (const wave of [4, 6, 12]) {
  const plan = patientTineCountsForWave(wave)
  assert.ok(plan)
  assert.ok(plan!.includes(1), `wave ${wave} should retain one-tine encounters`)
  assert.ok(plan!.includes(2), `wave ${wave} should introduce two-tine encounters`)
}
assert.equal(patientTineCountsForWave(13), null)

assert.equal(cueSupportForNote({ phase: 'new', lastReview: 0 }, undefined, false, false), 'guided')
assert.equal(cueSupportForNote({ phase: 'review', lastReview: 1 }, undefined, false, false), 'recall')
assert.equal(cueSupportForNote({ phase: 'review', lastReview: 1 }, undefined, true, false), 'guided')
assert.equal(cueSupportForNote({ phase: 'review', lastReview: 1 }, undefined, false, true), 'guided')

assert.equal(waitForClearBeforeSpawn(1, false), true)
assert.equal(waitForClearBeforeSpawn(2, false), true)
assert.equal(waitForClearBeforeSpawn(3, false), true)
assert.equal(waitForClearBeforeSpawn(4, false), true)
assert.equal(waitForClearBeforeSpawn(6, false), true)
assert.equal(waitForClearBeforeSpawn(12, false), true)
assert.equal(waitForClearBeforeSpawn(13, false), false)
assert.equal(waitForClearBeforeSpawn(8, true), true)

assert.equal(admissionAllowedForWave(1, false, false), false)
assert.equal(admissionAllowedForWave(2, false, false), false)
assert.equal(admissionAllowedForWave(3, false, false), true)
assert.equal(admissionAllowedForWave(1, true, false), true)
assert.equal(admissionAllowedForWave(1, false, true), true)

const independentlyRecalled = {
  version: 1 as const,
  notes: {
    D4: { guidedSuccesses: 2, independentRecalls: 1, needsGuidedRecovery: false },
    E4: { guidedSuccesses: 0, independentRecalls: 2, needsGuidedRecovery: false },
  },
}
assert.equal(admissionRecallReady(['D4', 'E4'], independentlyRecalled), true)
assert.equal(admissionRecallReady(['D4', 'E4'], {
  version: 1,
  notes: { D4: independentlyRecalled.notes.D4 },
}), false)
assert.equal(admissionRecallReady(['D4'], {
  version: 1,
  notes: { D4: { guidedSuccesses: 2, independentRecalls: 0, needsGuidedRecovery: false } },
}), false)
assert.equal(admissionRecallReady(['D4'], {
  version: 1,
  notes: { D4: { guidedSuccesses: 2, independentRecalls: 1, needsGuidedRecovery: true } },
}), false)
assert.equal(admissionRecallReady([], independentlyRecalled), false)
assert.equal(admissionRecallReady([''], independentlyRecalled), false)
assert.equal(admissionRecallReady(['D4', 'D4'], independentlyRecalled), false)
assert.equal(admissionRecallReady(['D4', 4], independentlyRecalled), false)
assert.equal(admissionRecallReady(['D4'], null), false)
assert.equal(admissionRecallReady(['D4'], {
  version: 1,
  notes: { D4: { guidedSuccesses: 0, independentRecalls: Number.NaN, needsGuidedRecovery: false } },
}), false)

assert.equal(attackTimeForCurriculum(1, 0), 45)
assert.equal(attackTimeForCurriculum(2, 0), 40)
assert.equal(attackTimeForCurriculum(3, 0), 32)
assert.equal(attackTimeForCurriculum(4, 0), 32)
assert.equal(attackTimeForCurriculum(6, 0), 32)
assert.equal(attackTimeForCurriculum(12, 0), 32)
assert.equal(attackTimeForCurriculum(13, 0), 12)
assert.ok(attackTimeForCurriculum(1, 0) > attackTimeForCurriculum(13, 0))
assert.equal(attackTimeForCurriculum(1, 1), 49)

const entryX = villagerEntryX(720, 48)
assert.equal(entryX, 649)
assert.ok(entryX + 48 <= 720 - 18, 'sprite must begin inside the safe inset')
assert.ok(entryX + 48 / 2 + 58 / 2 <= 720 - 18, 'attack bar must begin inside the safe inset')
assert.equal(villagerEntryX(720, 96), 606)
assert.equal(villagerEntryX(80, 96), 0)

const pair = ['D4', 'E4', 'F4']
assert.deepEqual(deterministicPairNotes(pair, 1, 0, 1, false), ['D4'])
assert.deepEqual(deterministicPairNotes(pair, 1, 1, 1, false), ['E4'])
assert.deepEqual(deterministicPairNotes(pair, 2, 0, 1, false), ['E4'])
assert.deepEqual(deterministicPairNotes(pair, 2, 1, 1, false), ['D4'])
assert.deepEqual(deterministicPairNotes(pair, 3, 0, 2, false), ['D4', 'E4'])
assert.deepEqual(deterministicPairNotes(pair, 3, 1, 2, false), ['E4', 'D4'])
assert.equal(deterministicPairNotes(pair, 4, 0, 2, false), null)
assert.equal(deterministicPairNotes(pair, 6, 0, 2, false), null)
assert.equal(deterministicPairNotes(pair, 12, 0, 2, false), null)
assert.equal(deterministicPairNotes(pair, 1, 0, 1, true), null)
assert.equal(deterministicPairNotes(['D4'], 1, 0, 1, false), null)

assert.equal(replayLabelForCueSupport('guided', 2), '🔊 REPLAY NOTES')
assert.equal(replayLabelForCueSupport('recall', 1), '💡 HINT · HEAR NOTE')
assert.equal(replayLabelForCueSupport('recall', 2), '💡 HINT · HEAR CHAIN')

const source = readFileSync(new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url), 'utf8')
// Admission now follows measured accuracy plus independent arsenal recall,
// not an additional arbitrary wave-number delay (Jon's 95% advancement rule).
assert.doesNotMatch(source, /if \(!admissionAllowedForWave\(runtimeRef\.current\.wave, demoRef\.current, fsrsDebugRef\.current\)\) return/)
assert.match(source, /pitchforksNewNoteAccuracyEligible\(levelProgressRef\.current, inputModeRef\.current\)/)
assert.match(source, /admissionRecallReady\(currentPool, cueSupportProfileRef\.current\)/)
assert.match(source, /cueSupportForNote\(/)
assert.doesNotMatch(source, /automaticCueForWave\(/)
assert.match(source, /const waitForClear = waitForClearBeforeSpawn\(rt\.wave, demoRef\.current\)/)
assert.match(source, /pickVillagerNotes\(totalTines, rt\.wave, spawnIndex\)/)
// The isolated sweep fixture has its own spawn positions; ordinary play must
// still enter through the same patient-curriculum boundary.
assert.match(source, /x: galvanicProofRef\.current && rt\.wave === 1\s*\? GALVANIC_PROOF_X\[spawnIndex\] \?\? W - 150\s*: demoRef\.current \? W - 150 : villagerEntryX\(W, spriteWidth\)/)
assert.match(source, /galvanicProofRef\.current = isDemo && params\.get\('galvanicProof'\) === '1'/)
assert.doesNotMatch(source, /W \+ 60/)
assert.match(source, /\{replayLabel\}/)
assert.doesNotMatch(source, /while \(rt\.spawned < rt\.plan\.count\) spawnVillager\(\)/)

console.log('pitchforks patient curriculum: PASS')
