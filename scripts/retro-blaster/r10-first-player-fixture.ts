import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import {
  commitRetroCurriculumExtension,
  deriveCurriculumExtensionRecord,
  RETRO_CURRICULUM_KEY,
  type RetroCurriculumStorage,
} from '../../src/components/PitchDefender/retroBlasterCurriculum'
import {
  RETRO_PACES,
  manualRetroPlacement,
  parseRetroPlacementExtension,
  placeRetroPace,
  placementExtensionPatch,
  placementForLane,
  resolveRetroPlayPace,
  retroMinimumDemandIntervalMs,
  retroPaceConfig,
  retroRequiredApmCeiling,
  type RetroPace,
  type RetroPlacementSummary,
  type RetroPlacementTrial,
} from '../../src/components/PitchDefender/retroBlasterPlacement'
import {
  STARTING_SHIELDS,
  beginWave,
  createInitialState,
  formationAnchor,
  resolveAttack,
  responseWindowMs,
  snapshotNoteSoul,
  toViewState,
  type ActiveAttack,
  type Alien,
  type EngineEvent,
  type GameState,
} from '../../src/components/PitchDefender/retroBlasterEngine'

const SHELL_PATH = 'src/components/PitchDefender/RetroBlasterII.tsx'
// R9b re-freeze: audio/detector are the accepted R9a bytes; renderer changes
// only for the target-invariant answer-mask branch and is proved separately.
const protectedHashes = {
  audio: 'B513FFAC628518A936C140BC0D6C9BC30B18C263DC6672C12ED120AD0CD23744',
  detector: '8515917A3F0B4066D23D85C4D7E4B0B9553F25FF332332604BE0412CCA5EA9F5',
  renderer: 'AD6452B3A0C9265A047F3EC3B87484978C33E96C75F9F1FCE8907DC638A552FB',
} as const

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex').toUpperCase()
}

function trials(firstAttemptCorrect: number, latencies: readonly number[]): RetroPlacementTrial[] {
  return ['C4', 'A4', 'A4', 'C4'].map((note, index) => ({
    note: note as 'C4' | 'A4',
    firstAttemptCorrect: index < firstAttemptCorrect,
    latencyMs: latencies[index] ?? 0,
  }))
}

function makeAlien(state: GameState, note = 'C4'): Alien {
  const anchor = formationAnchor(0)
  return {
    alienId: `${state.gameId}:alien:1:0`,
    visualId: '1:0',
    visualKind: 0,
    x: anchor.x,
    y: anchor.y,
    entering: false,
    entryT: 1,
    entryTargetX: anchor.x,
    formationSlot: 0,
    formationX: anchor.x,
    formationY: anchor.y,
    note,
    hue: 174,
    soul: snapshotNoteSoul(note, undefined, 0),
    diveServiceCount: 0,
    alive: true,
    frame: 0,
    hitTimer: 0,
  }
}

function armAttack(state: GameState, serial: number, demandAtMs: number): ActiveAttack {
  const target = state.aliens[0] ?? makeAlien(state)
  state.aliens = [target]
  const attack: ActiveAttack = {
    attackId: `${state.gameId}:attack:${serial}`,
    alienId: target.alienId,
    note: target.note,
    side: 1,
    cuePolicy: 'guided',
    readinessObservationId: null,
    stimulusRequest: null,
    phase: 'outbound',
    telegraphStartedAtMs: demandAtMs - 350,
    demandAtMs,
    deadlineAtMs: demandAtMs + responseWindowMs(state),
    outboundT: 0.35,
    returnFromT: 0,
    returnStartedAtMs: null,
    outcome: null,
    resolvedAtMs: null,
    voiceWindowEligible: null,
    voiceHeardPhonation: false,
  }
  state.activeAttack = attack
  return attack
}

class MemoryStorage implements RetroCurriculumStorage {
  private readonly values = new Map<string, string>()

  constructor(raw: string) { this.values.set(RETRO_CURRICULUM_KEY, raw) }
  getItem(key: string): string | null { return this.values.get(key) ?? null }
  setItem(key: string, value: string): void { this.values.set(key, value) }
  restore(raw: string): void { this.values.set(RETRO_CURRICULUM_KEY, raw) }
}

async function main() {
  assert.equal(sha256('src/components/PitchDefender/audioEngine.ts'), protectedHashes.audio)
  assert.equal(sha256('src/components/PitchDefender/usePitchDetection.ts'), protectedHashes.detector)
  assert.equal(sha256('src/components/PitchDefender/retroBlasterRenderer.ts'), protectedHashes.renderer)

  const thresholdCases: Array<[RetroPace, RetroPlacementTrial[]]> = [
    ['commander', trials(4, [900, 1100, 1300, 1500])],
    ['ace', trials(4, [1800, 2000, 2400, 2500])],
    ['pilot', trials(3, [3000, 3600, 4200, 4500])],
    ['cadet', trials(2, [800, 900, 1000, 1100])],
  ]
  for (const [expected, samples] of thresholdCases) {
    assert.equal(placeRetroPace(samples, 123).pace, expected)
  }
  assert.equal(placeRetroPace(trials(4, [900, 900, 900, 900]).slice(0, 3), 123).pace, 'cadet')
  assert.equal(manualRetroPlacement('pilot', 456).source, 'manual')
  assert.equal(resolveRetroPlayPace('ace', 'true'), 'commander')
  assert.equal(resolveRetroPlayPace('commander', 'true'), 'commander')

  const expectedTiming: Record<RetroPace, [number, number, number, number]> = {
    cadet: [8000, 2000, 1, 1],
    pilot: [5500, 1500, 2, 1],
    ace: [3500, 1200, 2, 2],
    commander: [2400, 900, 3, 2],
  }
  for (const pace of RETRO_PACES) {
    const config = retroPaceConfig(pace)
    assert.deepEqual(
      [config.responseWindowMs, config.interAttackRestMs, config.waveOneAlienCount, config.waveOneMaxConcurrent],
      expectedTiming[pace],
    )
    assert.equal(retroMinimumDemandIntervalMs(pace), config.responseWindowMs + config.interAttackRestMs)
    assert.equal(retroRequiredApmCeiling(pace), 60000 / retroMinimumDemandIntervalMs(pace))
    const state = createInitialState('easy', ['C4', 'A4'], 1000, `pace:${pace}`, pace)
    beginWave(state, {}, 0)
    assert.equal(state.alienCountThisWave, config.waveOneAlienCount)
  }

  const ear = placeRetroPace(trials(4, [1800, 1900, 2000, 2100]), 1000)
  const voice = manualRetroPlacement('pilot', 2000)
  const invalid = { version: 99, lanes: { ear: { pace: 'warp' } } }
  const repairedPatch = placementExtensionPatch({ retroPlacement: invalid }, 'ear', ear)
  assert.deepEqual(repairedPatch.retroPlacementLegacy, invalid)
  assert.equal(parseRetroPlacementExtension(repairedPatch.retroPlacement)?.lanes.ear?.pace, 'ace')
  assert.equal(parseRetroPlacementExtension({ version: 1, lanes: { ear: { ...ear, pace: 'warp' } } }), null)

  const currentRaw = JSON.stringify({
    revision: 1,
    unlockedNotes: ['C4', 'A4', 'G4'],
    futureFlag: { retained: true },
    retroPlacement: { version: 1, lanes: { ear } },
  })
  const laneMerged = deriveCurriculumExtensionRecord(
    currentRaw,
    ['C4', 'A4'],
    {},
    placementExtensionPatch({}, 'voice', voice),
  )
  assert.deepEqual(laneMerged.durableRoster, ['C4', 'A4', 'G4'])
  assert.deepEqual(laneMerged.extensionFields.futureFlag, { retained: true })
  assert.equal(placementForLane(laneMerged.extensionFields, 'ear')?.pace, 'ace')
  assert.equal(placementForLane(laneMerged.extensionFields, 'voice')?.pace, 'pilot')

  const protectedState = createInitialState('easy', ['C4', 'A4'], 1000, 'protected-pace', 'pilot')
  protectedState.aliens = [makeAlien(protectedState)]
  const firstAttack = armAttack(protectedState, 1, 1200)
  const firstEvents: EngineEvent[] = []
  assert(resolveAttack(protectedState, firstAttack.attackId, 'wrong', 900, firstEvents, 'click'))
  assert.equal(protectedState.cityHealth, STARTING_SHIELDS)
  assert.equal(protectedState.paceProtection.protectedCount, 1)
  assert.equal(firstEvents.some(event => event.kind === 'grade'), false)
  assert(firstEvents.some(event => event.kind === 'coachingFailure'))

  const secondAttack = armAttack(protectedState, 2, 3000)
  const secondEvents: EngineEvent[] = []
  assert(resolveAttack(protectedState, secondAttack.attackId, 'timeout', 5500, secondEvents, 'click'))
  assert.equal(protectedState.cityHealth, STARTING_SHIELDS)
  assert.equal(protectedState.pace, 'cadet')
  assert.equal(protectedState.paceProtection.protectedCount, 2)
  assert.equal(protectedState.paceProtection.demotions, 1)
  assert.equal(protectedState.activeAttack?.attackId, secondAttack.attackId)
  assert.equal(protectedState.activeAttack?.outcome, null)
  assert.equal(protectedState.activeAttack?.deadlineAtMs, secondAttack.demandAtMs! + retroPaceConfig('cadet').responseWindowMs)
  assert.equal(secondEvents.some(event => event.kind === 'grade'), false)
  assert(secondEvents.some(event => event.kind === 'paceAdjusted'))

  const thirdEvents: EngineEvent[] = []
  assert(resolveAttack(protectedState, secondAttack.attackId, 'wrong', 6000, thirdEvents, 'click'))
  assert.equal(protectedState.cityHealth, STARTING_SHIELDS - 1)
  assert(thirdEvents.some(event => event.kind === 'grade' && !event.correct))

  const blindState = createInitialState('easy', ['C4', 'A4'], 1000, 'identity-silence', 'cadet')
  blindState.aliens = [makeAlien(blindState)]
  blindState.wave = 2
  blindState.blindProbePending = true
  const blindAttack = armAttack(blindState, 1, 1200)
  blindState.activeAttack = { ...blindAttack, cuePolicy: 'blind' }
  const blindView = toViewState(blindState, 'click', false)
  assert.equal(blindView.activeAttack?.note, '?')
  assert(blindView.noteButtons.every(button => !button.active))

  const originalStorageRaw = JSON.stringify({
    revision: 1,
    unlockedNotes: ['C4', 'A4', 'G4'],
    futureFlag: { exact: 'preserve-me' },
  })
  const storage = new MemoryStorage(originalStorageRaw)
  try {
    const locks = globalThis.navigator?.locks
    assert(locks, 'Node Web Locks are required for the first-player concurrency proof')
    const writes = Array.from({ length: 100 }, (_, index) => {
      const lane = index % 2 === 0 ? 'ear' : 'voice'
      const summary = lane === 'ear' ? manualRetroPlacement('cadet', index) : manualRetroPlacement('pilot', index)
      return commitRetroCurriculumExtension({
        storage,
        locks,
        signal: new AbortController().signal,
        extensionPatch: placementExtensionPatch({}, lane, summary),
        getLastDurableRoster: () => ['C4', 'A4'],
        getLastExtensionFields: () => ({}),
      })
    })
    const results = await Promise.all(writes)
    assert(results.every(result => result.ok))
    const finalRaw = storage.getItem(RETRO_CURRICULUM_KEY)
    assert(finalRaw)
    const finalRecord = JSON.parse(finalRaw)
    assert.deepEqual(finalRecord.unlockedNotes, ['C4', 'A4', 'G4'])
    assert.deepEqual(finalRecord.futureFlag, { exact: 'preserve-me' })
    assert.equal(placementForLane(finalRecord, 'ear')?.pace, 'cadet')
    assert.equal(placementForLane(finalRecord, 'voice')?.pace, 'pilot')
  } finally {
    storage.restore(originalStorageRaw)
  }
  assert.equal(storage.getItem(RETRO_CURRICULUM_KEY), originalStorageRaw)

  const shell = readFileSync(SHELL_PATH, 'utf8')
  assert(shell.includes("type ShellPhase = Phase | 'readiness' | 'practice' | 'placement'"))
  assert(shell.includes('SAFE PRACTICE - NO TIMER - NO SHIELDS'))
  assert(shell.includes('FIND YOUR PACE - NOT A TALENT SCORE'))
  assert(shell.includes('Listen first. The target stays hidden until you answer. Wrong answers simply replay the same trial.'))
  assert(shell.includes('sessionRosterRef.current = [...FIRST_SESSION_ROSTER]'))
  assert(shell.includes('LAUNCH FIRST C/A WAVE'))
  assert(shell.includes('two protected early misses'))
  const coachingStart = shell.indexOf('  const advanceFromReadiness')
  const coachingEnd = shell.indexOf('  useEffect(() => {', shell.indexOf('const onCoachKey =', coachingStart))
  const coaching = shell.slice(coachingStart, coachingEnd)
  assert.doesNotMatch(coaching, /gradeEar|gradeVoice|applyRetroBlasterFamilyEvent|setFinalStats|setScore|setShields/)

  console.log(JSON.stringify({
    status: 'PASS',
    fixture: 'R10 first-player mastery',
    rows: [
      'four-threshold pace placement and manual override',
      'versioned invalid-schema recovery and lane merge',
      'exact pace windows demand ceilings and wave-one counts',
      'two protected failures then normal third-failure consequence',
      'identity and color-hint silence',
      '100 locked concurrent extension commits with exact mock restoration',
      'explicit pre-flight safe practice placement and C/A launch source contract',
      'protected audio detector and renderer hashes',
    ],
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
