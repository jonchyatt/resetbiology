import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  advancePitchforksJourneyLevel,
  createPitchforksPresentationJourney,
  parsePitchforksPresentationJourney,
} from '../src/components/PitchDefender/pitchforksCurriculum'
import {
  persistPitchforksPresentationJourney,
  persistPitchforksMasteryStore,
  type PitchforksJourneySaveStorage,
  type PitchforksMasterySaveStorage,
} from '../src/components/PitchDefender/PitchforksIII'
import { createNote, type NoteMemory } from '../src/lib/fsrs'

let checks = 0
const check = (run: () => void) => {
  run()
  checks += 1
}

const order = ['D4', 'E4', 'C4', 'F4']
const rangeAssessedAt = '2026-07-20T18:00:00.000Z'
const startedAt = '2026-07-20T19:00:00.000Z'
const journey = createPitchforksPresentationJourney({
  rangeAssessedAt,
  unlockedNotes: order.slice(0, 3),
  guidedNotes: order.slice(0, 2),
  startedAt,
})

check(() => assert.equal(journey.currentLevel, 1))
check(() => assert.deepEqual(journey, {
  version: 1,
  currentLevel: 1,
  rangeAssessedAt,
  startedAt,
  unlockedNotes: ['D4', 'E4', 'C4'],
  guidedNotes: ['D4', 'E4'],
}))

const { currentLevel: _legacyCurrentLevel, ...legacyJourney } = journey
check(() => assert.deepEqual(
  parsePitchforksPresentationJourney(JSON.stringify(legacyJourney), rangeAssessedAt, order),
  journey,
))
check(() => assert.equal(parsePitchforksPresentationJourney('{bad json', rangeAssessedAt, order), null))

for (const currentLevel of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN, '2', null, {}, true]) {
  check(() => assert.equal(
    parsePitchforksPresentationJourney(
      JSON.stringify({ ...legacyJourney, currentLevel }),
      rangeAssessedAt,
      order,
    ),
    null,
    `invalid currentLevel should be rejected: ${String(currentLevel)}`,
  ))
}

const levelTwo = advancePitchforksJourneyLevel(journey, 1, true)
check(() => assert.notStrictEqual(levelTwo, journey))
check(() => assert.deepEqual(levelTwo, { ...journey, currentLevel: 2 }))
check(() => assert.equal(levelTwo.rangeAssessedAt, rangeAssessedAt))
check(() => assert.equal(levelTwo.startedAt, startedAt))
check(() => assert.deepEqual(levelTwo.unlockedNotes, journey.unlockedNotes))
check(() => assert.deepEqual(levelTwo.guidedNotes, journey.guidedNotes))
check(() => assert.equal(journey.currentLevel, 1))

check(() => assert.strictEqual(advancePitchforksJourneyLevel(journey, 1, false), journey))
check(() => assert.strictEqual(advancePitchforksJourneyLevel(journey, 2, true), journey))
check(() => assert.strictEqual(advancePitchforksJourneyLevel(journey, 1, 1 as unknown as boolean), journey))
check(() => assert.strictEqual(advancePitchforksJourneyLevel(levelTwo, 1, true), levelTwo))
check(() => assert.strictEqual(advancePitchforksJourneyLevel(levelTwo, 3, true), levelTwo))
const maxSafeLevelJourney = { ...journey, currentLevel: Number.MAX_SAFE_INTEGER }
check(() => assert.strictEqual(advancePitchforksJourneyLevel(maxSafeLevelJourney, Number.MAX_SAFE_INTEGER, true), maxSafeLevelJourney))

const levelThree = advancePitchforksJourneyLevel(levelTwo, 2, true)
check(() => assert.deepEqual(levelThree, { ...journey, currentLevel: 3 }))
check(() => assert.deepEqual(levelThree.unlockedNotes, journey.unlockedNotes))
check(() => assert.deepEqual(levelThree.guidedNotes, journey.guidedNotes))

class JourneyStorage implements PitchforksJourneySaveStorage {
  value: string | null = null
  failWrites = 0
  readbackMismatch = false

  setItem(_key: string, value: string): void {
    if (this.failWrites > 0) {
      this.failWrites -= 1
      throw new Error('quota exceeded')
    }
    this.value = value
  }

  getItem(_key: string): string | null {
    if (this.readbackMismatch) return '{"stale":true}'
    return this.value
  }
}

check(() => {
  const storage = new JourneyStorage()
  const result = persistPitchforksPresentationJourney(storage, journey)
  assert.equal(result.status, 'confirmed')
  assert.equal(result.reason, undefined)
  assert.deepEqual(JSON.parse(storage.value!), journey)
})

check(() => {
  const storage = new JourneyStorage()
  storage.failWrites = 1
  const result = persistPitchforksPresentationJourney(storage, journey)
  assert.equal(result.status, 'not-confirmed')
  assert.equal(result.reason, 'write-failed')
  assert.strictEqual(result.journey, journey, 'write failure keeps the in-memory journey for retry')
  assert.equal(storage.value, null)
})

check(() => {
  const storage = new JourneyStorage()
  storage.readbackMismatch = true
  const result = persistPitchforksPresentationJourney(storage, journey)
  assert.equal(result.status, 'not-confirmed')
  assert.equal(result.reason, 'readback-mismatch')
  assert.strictEqual(result.journey, journey, 'readback mismatch keeps the in-memory journey for retry')

  storage.readbackMismatch = false
  const retry = persistPitchforksPresentationJourney(storage, result.journey)
  assert.equal(retry.status, 'confirmed', 'retry confirms after readback recovers')
  assert.deepEqual(JSON.parse(storage.value!), journey)
})

check(() => {
  const result = persistPitchforksPresentationJourney(() => {
    throw new Error('window.localStorage getter blocked')
  }, journey)
  assert.equal(result.status, 'not-confirmed')
  assert.equal(result.reason, 'write-failed')
  assert.strictEqual(result.journey, journey, 'a storage getter failure keeps the in-memory journey for retry')
})

check(() => {
  const storage = new JourneyStorage()
  const demo = persistPitchforksPresentationJourney(storage, journey, { demo: true })
  const debug = persistPitchforksPresentationJourney(storage, journey, { fsrsDebug: true })
  assert.equal(demo.status, 'skipped')
  assert.equal(demo.reason, 'demo')
  assert.equal(debug.status, 'skipped')
  assert.equal(debug.reason, 'fsrs-debug')
  assert.equal(storage.value, null, 'demo and FSRS debug never write the normal journey key')
})

class MasteryStorage implements PitchforksMasterySaveStorage {
  value: string | null = null
  failReads = 0
  readbackMismatch = false

  getItem(_key: string): string | null {
    if (this.failReads > 0) {
      this.failReads -= 1
      throw new Error('storage read blocked')
    }
    if (this.readbackMismatch) return '{"stale":true}'
    return this.value
  }
}

const masteryKey = 'pitch_fsrs_memory'
const masteryStore: Record<string, NoteMemory> = { C4: createNote('C4') }
const writeMastery = (storage: MasteryStorage, store: Record<string, NoteMemory>) => () => {
  storage.value = JSON.stringify(store)
  return true
}

check(() => {
  const storage = new MasteryStorage()
  const result = persistPitchforksMasteryStore(() => storage, masteryKey, masteryStore, writeMastery(storage, masteryStore))
  assert.equal(result.status, 'confirmed')
  assert.equal(result.reason, undefined)
  assert.deepEqual(JSON.parse(storage.value!), masteryStore)
})

check(() => {
  const result = persistPitchforksMasteryStore(
    () => { throw new Error('window.localStorage getter blocked') },
    masteryKey,
    masteryStore,
    () => { throw new Error('window.localStorage getter blocked') },
  )
  assert.equal(result.status, 'not-confirmed')
  assert.equal(result.reason, 'write-failed')
  assert.strictEqual(result.store, masteryStore, 'blocked storage keeps the live mastery store for retry')
})

check(() => {
  const storage = new MasteryStorage()
  const result = persistPitchforksMasteryStore(() => storage, masteryKey, masteryStore, () => false)
  assert.equal(result.status, 'not-confirmed')
  assert.equal(result.reason, 'write-failed', 'saveStore false is a failed mastery write')
  assert.strictEqual(result.store, masteryStore)
  assert.equal(storage.value, null)
})

check(() => {
  const storage = new MasteryStorage()
  storage.failReads = 1
  const result = persistPitchforksMasteryStore(() => storage, masteryKey, masteryStore, writeMastery(storage, masteryStore))
  assert.equal(result.status, 'not-confirmed')
  assert.equal(result.reason, 'readback-failed')
  assert.strictEqual(result.store, masteryStore)
  assert.deepEqual(JSON.parse(storage.value!), masteryStore, 'a read failure does not erase the in-memory or written store')
})

check(() => {
  const storage = new MasteryStorage()
  storage.readbackMismatch = true
  const result = persistPitchforksMasteryStore(() => storage, masteryKey, masteryStore, writeMastery(storage, masteryStore))
  assert.equal(result.status, 'not-confirmed')
  assert.equal(result.reason, 'readback-mismatch')
  assert.strictEqual(result.store, masteryStore)

  storage.readbackMismatch = false
  const retry = persistPitchforksMasteryStore(() => storage, masteryKey, result.store, writeMastery(storage, result.store))
  assert.equal(retry.status, 'confirmed', 'retry confirms after readback recovers')
  assert.deepEqual(JSON.parse(storage.value!), masteryStore)
})

check(() => {
  const storage = new MasteryStorage()
  const latestStore: Record<string, NoteMemory> = { C4: createNote('C4') }
  let writeAllowed = false
  const writeLatest = () => {
    if (!writeAllowed) return false
    storage.value = JSON.stringify(latestStore)
    return true
  }
  const failed = persistPitchforksMasteryStore(() => storage, masteryKey, latestStore, writeLatest)
  assert.equal(failed.status, 'not-confirmed')
  latestStore.C4 = { ...latestStore.C4, S: 42 }
  writeAllowed = true
  const retry = persistPitchforksMasteryStore(() => storage, masteryKey, latestStore, writeLatest)
  assert.equal(retry.status, 'confirmed', 'retry writes the latest changed in-memory mastery state')
  assert.equal(JSON.parse(storage.value!).C4.S, 42)
  assert.strictEqual(retry.store, latestStore)
})

const component = readFileSync(new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url), 'utf8')
check(() => assert.match(component, /advancePitchforksJourneyLevel\(presentationJourneyRef\.current, rt\.wave, result\.cleared\)/))
check(() => assert.match(component, /savePresentationJourney\(nextJourney\)/))
check(() => assert.match(component, /try \{[\s\S]*persistPitchforksPresentationJourney\(\(\) => localStorage, journey\)/))
check(() => assert.match(component, /data-testid="pf3-journey-save-status"/))
check(() => assert.match(component, /Saving not confirmed\. Progress remains in memory; retry saving\./))
check(() => assert.match(component, /data-testid="pf3-journey-save-retry"/))
check(() => assert.match(component, /onClick=\{retryPresentationJourneySave\}/))
check(() => assert.match(component, /!demoMode && !fsrsDebugMode && journeySaveStatus === 'not-confirmed'/))
check(() => assert.match(component, /if \(result\.status === 'confirmed'\) setJourneySaveStatus\('idle'\)/))
check(() => assert.match(component, /if \(!journey \|\| demoRef\.current \|\| fsrsDebugRef\.current\) return/))
check(() => assert.match(component, /try \{ savePitchforksSettings\(localStorage, settings\) \} catch \{\}/))
check(() => assert.match(component, /try \{ return loadPitchforksSettings\(localStorage\) \}/))
check(() => assert.match(component, /try \{\s*fsrsRef\.current = loadStore\(/))
check(() => assert.match(component, /persistPitchforksMasteryStore\(\s*\(\) => localStorage,\s*key,\s*store,\s*\(\) => saveStore\(key, store\)/))
check(() => assert.match(component, /data-testid="pf3-mastery-save-status"/))
check(() => assert.match(component, /Mastery saving not confirmed\. Latest practice remains in memory; retry saving\./))
check(() => assert.match(component, /data-testid="pf3-mastery-save-retry"/))
check(() => assert.match(component, /onClick=\{retryMasterySave\}/))
check(() => assert.match(component, /for \(const lane of \[\.\.\.masterySavePendingLanesRef\.current\]\) saveFsrs\(lane\)/))
check(() => assert.match(component, /if \(result\.status === 'confirmed'\) masterySavePendingLanesRef\.current\.delete\(lane\)/))
check(() => assert.match(component, /if \(demoRef\.current \|\| fsrsDebugRef\.current\) \{\s*try \{ saveStore\(key, store\) \} catch \{\}\s*return/))
check(() => assert.match(component, /const resumeLevel = !demoRef\.current && !fsrsDebugRef\.current && inputModeRef\.current === 'voice'/))
check(() => assert.match(component, /startWave\(resumeLevel\)/))
check(() => assert.match(component, /setPortraitDockPanel\(staffNotationRef\.current \? 'staff' : null\)/))
console.log(`pitchforks journey-checkpoint contract: ${checks}/${checks} PASS (harness and source wiring only)`)
