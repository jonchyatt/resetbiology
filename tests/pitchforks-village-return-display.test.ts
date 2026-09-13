import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { projectVillageReturnDisplay } from '../src/components/PitchDefender/PitchforksIII'

let checks = 0
const check = (run: () => void) => {
  run()
  checks += 1
}

const lesson = (contextNote: string, targetNote: string, support: 'SUPPORTED' | 'UNAIDED_RETURN' = 'UNAIDED_RETURN') => ({
  objective: 'minor-third' as const,
  contextNote,
  targetNote,
  support,
})

const villager = (id: number, note: string, supportedLesson = lesson('C4', note)) => ({
  id,
  burned: 0,
  totalTines: 1 as const,
  notes: [note],
  supportedLesson,
})

const first = villager(11, 'E4')
const second = villager(12, 'G4', lesson('E4', 'G4'))

check(() => assert.deepEqual(
  projectVillageReturnDisplay(first, {}, new Set()),
  { targetKey: '11:0', answerVisible: false },
))
check(() => assert.deepEqual(
  projectVillageReturnDisplay(second, {}, new Set()),
  { targetKey: '12:0', answerVisible: false },
))
check(() => assert.equal(
  projectVillageReturnDisplay(second, { '11:0': { correct: true, lane: 'voice', credit: 'recall' } }, new Set()).answerVisible,
  false,
))
check(() => assert.equal(
  projectVillageReturnDisplay(first, { '11:0': { correct: false, lane: 'voice', credit: 'hinted' } }, new Set()).answerVisible,
  true,
))
check(() => assert.equal(
  projectVillageReturnDisplay(second, {}, new Set(['12:0'])).answerVisible,
  true,
))
check(() => assert.equal(
  projectVillageReturnDisplay(villager(13, 'E4', lesson('C4', 'E4', 'SUPPORTED')), {}, new Set()).answerVisible,
  true,
))
check(() => assert.equal(
  projectVillageReturnDisplay({ ...first, totalTines: 2 as const, notes: ['E4', 'G4'] }, {}, new Set()).answerVisible,
  true,
))

const component = readFileSync(new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url), 'utf8')
check(() => assert.match(component, /targetOutcomes: levelProgressRef\.current\.targetOutcomes/))
check(() => assert.match(component, /hintedTargetKeys: hintedTargetKeysRef\.current/))
check(() => assert.match(component, /type VillagerView = Readonly<[\s\S]*?active: boolean\s+answerVisible: boolean/))
check(() => assert.match(component, /answerVisible: projectVillageReturnDisplay\(v, targetOutcomes, hintedTargetKeys\)\.answerVisible/))
check(() => assert.match(component, /const concealedTarget = target && activeVillager\?\.answerVisible === false/))
check(() => assert.match(component, /if \(!concealedTarget\) drawStaffNoteHead\(ctx, note, x, spent, target\)/))
check(() => assert.ok((component.match(/drawStaffNotationView\(/g) ?? []).length >= 3))

console.log(`pitchforks Village return display: ${checks}/${checks} PASS`)
