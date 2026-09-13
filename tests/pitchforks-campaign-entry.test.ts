import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import type { NoteMemory } from '../src/lib/fsrs'
import {
  persistPitchforksPresentationJourney,
  type PitchforksJourneySaveStorage,
} from '../src/components/PitchDefender/PitchforksIII'
import {
  advancePitchforksCampaignProgress,
  type PitchforksCampaignProgressInput,
} from '../src/components/PitchDefender/pitchforksCampaignProgress'
import { createPitchforksPresentationJourney } from '../src/components/PitchDefender/pitchforksCurriculum'

let checks = 0
const check = (run: () => void) => {
  run()
  checks += 1
}

const rangeAssessedAt = '2026-09-12T20:00:00.000Z'
const startedAt = '2026-09-12T20:01:00.000Z'
const nowMs = 2_100_000
const admittedNotes = ['D4', 'E4']

function voiceMemory(note: string): NoteMemory {
  return {
    note,
    S: 21,
    D: 5,
    due: nowMs + 1_000,
    lastReview: nowMs - 1_000,
    lapses: 0,
    phase: 'review',
    learningReps: 3,
  }
}

const journey = createPitchforksPresentationJourney({
  rangeAssessedAt,
  startedAt,
  unlockedNotes: admittedNotes,
  guidedNotes: [],
})

const input: PitchforksCampaignProgressInput = {
  journey,
  rangeAssessedAt,
  startedAt,
  demo: false,
  simulated: false,
  voiceMemory: {
    D4: voiceMemory('D4'),
    E4: voiceMemory('E4'),
  },
  masteryRecords: {
    D4: { sessionIds: ['d4-a', 'd4-b', 'd4-c'], masteredAt: nowMs - 2 },
    E4: { sessionIds: ['e4-a', 'e4-b', 'e4-c'], masteredAt: nowMs - 1 },
  },
  nowMs,
}

const advanced = advancePitchforksCampaignProgress(input)
check(() => assert.equal(advanced.changed, true))
check(() => assert.equal(advanced.reason, 'dungeon-cleared'))
check(() => assert.deepEqual(advanced.journey.dungeonClear, {
  version: 1,
  rangeAssessedAt,
  startedAt,
  admittedNotes,
  clearedAt: nowMs,
}))
check(() => assert.notStrictEqual(advanced.journey, journey))
check(() => assert.notStrictEqual(advanced.journey.dungeonClear?.admittedNotes, admittedNotes))

class JourneyStorage implements PitchforksJourneySaveStorage {
  value: string | null = null
  failWrites = 0
  readbackMismatch = false

  setItem(_key: string, value: string): void {
    if (this.failWrites > 0) {
      this.failWrites -= 1
      throw new Error('write blocked')
    }
    this.value = value
  }

  getItem(_key: string): string | null {
    return this.readbackMismatch ? '{"stale":true}' : this.value
  }
}

check(() => {
  const storage = new JourneyStorage()
  const result = persistPitchforksPresentationJourney(storage, advanced.journey)
  assert.equal(result.status, 'confirmed')
  assert.deepEqual(JSON.parse(storage.value!), advanced.journey)
})

check(() => {
  const storage = new JourneyStorage()
  storage.failWrites = 1
  const failed = persistPitchforksPresentationJourney(storage, advanced.journey)
  assert.equal(failed.status, 'not-confirmed')
  assert.equal(failed.reason, 'write-failed')
  assert.strictEqual(failed.journey, advanced.journey)
  const retry = persistPitchforksPresentationJourney(storage, failed.journey)
  assert.equal(retry.status, 'confirmed')
  assert.deepEqual(JSON.parse(storage.value!), advanced.journey)
})

const source = readFileSync(
  new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url),
  'utf8',
)

check(() => assert.match(source, /advancePitchforksCampaignProgress/))
check(() => assert.match(source, /rangeAssessedAt: rangeProfile\.assessedAt/))
check(() => assert.match(source, /startedAt: journey\.startedAt/))
check(() => assert.match(source, /demo: demoRef\.current \|\| fsrsDebugRef\.current/))
check(() => assert.match(source, /simulated: bossSimulatingRef\.current/))
check(() => assert.match(source, /voiceMemory: fsrsRef\.current/))
check(() => assert.match(source, /masteryRecords: masteryProgressRef\.current/))
check(() => assert.match(source, /lane === 'voice'/))
check(() => assert.match(source, /savePresentationJourney\(result\.journey\)/))
check(() => assert.match(source, /setPresentationJourney\(storedJourney\)/))
check(() => assert.match(source, /selectedWorldRef/))
check(() => assert.match(source, /data-testid="pf3-selected-world"/))
check(() => assert.match(source, /data-testid=\{`pf3-world-\$\{world\.id\}`\}/))
check(() => assert.match(source, /data-testid="pf3-village-gate-retry"/))
check(() => assert.match(source, /min-h-12/))
check(() => assert.match(source, /focus-visible:outline/))
check(() => assert.match(source, /villageGateAssetStatus/))
check(() => assert.match(source, /villageGatePlate/))
check(() => assert.match(source, /normalWorld: selectedWorldRef\.current/))
check(() => assert.match(source, /view\.normalWorld === 'village-gate'/))
check(() => assert.match(source, /assets\.privatePlate/))
check(() => assert.doesNotMatch(source, /bossClears/))

const menuShellStart = source.indexOf('<div data-testid="pf3-menu"')
const menuShellEnd = source.indexOf('{newNoteCeremonyBanner}', menuShellStart)
const menuShellSegment = menuShellStart >= 0 && menuShellEnd > menuShellStart
  ? source.slice(menuShellStart, menuShellEnd)
  : ''

const worldMapStart = source.indexOf('<div className="mb-5" aria-label="World Map">')
const worldMapEnd = source.indexOf('          <div className="mb-5">', worldMapStart + 1)
const worldMapSegment = worldMapStart >= 0 && worldMapEnd > worldMapStart
  ? source.slice(worldMapStart, worldMapEnd)
  : ''

const boundedGuard = (condition: boolean, message: string) =>
  check(() => assert.equal(condition, true, message))

boundedGuard(menuShellSegment.length > 0, 'menu shell source segment missing')
boundedGuard(menuShellSegment.includes('items-start'), 'menu shell must remain top-aligned')
boundedGuard(!menuShellSegment.includes('sm:items-center'), 'menu shell must not center at sm breakpoint')
boundedGuard(worldMapSegment.length > 0, 'World Map source segment missing')
boundedGuard(!/\btext-(?:xs|\[(?:[0-9]|1[0-3])px\])/.test(worldMapSegment), 'World Map contains text below 14px')
boundedGuard(worldMapSegment.includes('text-sm'), 'World Map labels must use at least text-sm')
boundedGuard(worldMapSegment.includes('min-h-12'), 'World Map retry target must remain 48px')
boundedGuard(worldMapSegment.includes('focus-visible:outline'), 'World Map focus affordance must remain')
boundedGuard(worldMapSegment.includes('grid grid-cols-2 gap-1.5 sm:grid-cols-4'), 'World Map responsive grid must remain')
boundedGuard(worldMapSegment.includes('onClick={() =>'), 'World Map selection handler must remain')
boundedGuard(worldMapSegment.includes('disabled={!selectable}'), 'World Map disabled condition must remain')
boundedGuard(worldMapSegment.includes("? selected ? 'Ready to play.' : 'Choose this world.'"), 'selected and available World Map copy must remain concise')
boundedGuard(worldMapSegment.includes("'Master your current notes to unlock.'"), 'Village Gate locked copy must remain concise')
boundedGuard(worldMapSegment.includes("'Opens later in your adventure.'"), 'future-world copy must remain concise')
boundedGuard(worldMapSegment.includes('villageGateAssetStatus === \'missing\''), 'Village Gate missing distinction must remain')
boundedGuard(worldMapSegment.includes("'Earned · Village Gate scene loading.'"), 'Village Gate loading distinction must remain')
boundedGuard(worldMapSegment.includes('className="min-h-28 flex flex-col"'), 'World Map wrappers must align cards in a column')
boundedGuard(worldMapSegment.includes("'min-h-28 flex-1 w-full border"), 'World Map card buttons must fill their row')
boundedGuard(worldMapSegment.includes('className="min-h-28 flex-1 border'), 'Locked World Map cards must fill their row')

console.log(`pitchforks-campaign-entry: ${checks}/${checks} passed`)
