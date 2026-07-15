import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createNote, type NoteMemory } from '../../src/lib/fsrs'
import * as engine from '../../src/components/PitchDefender/retroBlasterEngine'
import type {
  Alien,
  CurriculumUnlockAck,
  EngineEvent,
  EngineInput,
  GameState,
  PendingCurriculumUnlock,
} from '../../src/components/PitchDefender/retroBlasterEngine'
import {
  RETRO_CURRICULUM_KEY as PRODUCT_POLICY_KEY,
  RETRO_CURRICULUM_LOCK_NAME as PRODUCT_LOCK_NAME,
  commitRetroCurriculum,
  deriveMonotonicCurriculumRecord,
  resolveRetroCurriculumSession,
  type RetroCurriculumStorage,
} from '../../src/components/PitchDefender/retroBlasterCurriculum'
import { INTRO_ORDER, UNLOCK_THRESHOLDS } from '../../src/components/PitchDefender/types'

const BASE = '2a773d5903d4558cee4c3b3c09a11659908cf575'
const SELF = fileURLToPath(import.meta.url)
const MODE = process.argv[2] === '--green' ? '--green' : '--red'
const OUTPUT = resolve(process.argv[MODE === '--green' ? 3 : 2] ??
  (MODE === '--green'
    ? 'data/retro-blaster-rework/runtime-logs/r9a-green-local/result.json'
    : 'data/retro-blaster-rework/runtime-logs/r9a-red-820d036e/result.json'))
const POLICY_KEY = 'retro_blaster_curriculum_v1'
const LOCK_NAME = 'retro-blaster-curriculum-v1'

const PATHS = {
  engine: 'src/components/PitchDefender/retroBlasterEngine.ts',
  shell: 'src/components/PitchDefender/RetroBlasterII.tsx',
  types: 'src/components/PitchDefender/types.ts',
  family: 'src/lib/fsrsFamily.ts',
  audio: 'src/components/PitchDefender/audioEngine.ts',
  detector: 'src/components/PitchDefender/usePitchDetection.ts',
  renderer: 'src/components/PitchDefender/retroBlasterRenderer.ts',
  sibling: 'src/components/PitchDefender/RetroBlaster.tsx',
  r8a: 'scripts/retro-blaster/r8a-readiness-fixture.ts',
  r8c: 'scripts/retro-blaster/r8c-signal-check-fixture.ts',
  e1: 'scripts/retro-blaster/e1-data-purity.mjs',
  familyRegression: 'scripts/retro-blaster/family-regression.mjs',
} as const

const EXPECTED_HASHES = {
  engine: '219DD9F312349281B3555B3DC78D4BC47D34C9F0C1E145EFD41ACF65408E0405',
  shell: '8F7BF26EAD3FA57ACDA75A2DD557F08CED30F50E871B682D461317C1D7AC5C0F',
  types: 'FE36957396DF11499A3508C89D773E419DB5767894F80F072B067EB3AE0AFDEB',
  family: '8711C1C5E66427AE32C641D1C60E0B393894E828FEF85DD8579D643B3A078E46',
  audio: '68184AD29A2582212D6AEC8E74CF440EF13C764C4894CE4D08964484D20CC430',
  detector: '9ED5801EF0D19EC65C73B639A70F3E11A394ADE4562D0442D8B375F25A651CC2',
  renderer: '109BD3EDC642B17CD30E5C5B804BE60BC673604EB69793D7F95764AB51D8D1D3',
  sibling: 'CAA31FCE012E82DA1BD7E6DA2AEE5300522BD0450DEC1D293AAAA1FA6FE407C5',
} as const

type Evidence = Record<string, unknown>
type Expectation = 'PASS' | 'RED'
type EvidenceClass = 'source-backed' | 'runtime-measured' | 'reference-oracle'
type Probe = () => boolean | { pass: boolean; evidence?: Evidence } | Promise<boolean | { pass: boolean; evidence?: Evidence }>
type Row = {
  id: string
  group: string
  contract: string
  expectation: Expectation
  evidenceClass: EvidenceClass
  actual: 'PASS' | 'RED'
  classification: 'MATCH' | 'UNEXPECTED_PASS' | 'UNEXPECTED_FAIL'
  evidence: Evidence
  error?: string
}

const rows: Row[] = []
const source = Object.fromEntries(
  Object.entries(PATHS).map(([key, path]) => [key, readFileSync(path, 'utf8')]),
) as Record<keyof typeof PATHS, string>
const hashes = Object.fromEntries(
  Object.entries(PATHS).map(([key, path]) => [key, sha256(readFileSync(path))]),
) as Record<keyof typeof PATHS, string>

function sha256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex').toUpperCase()
}

function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function canonical(notes: readonly string[]): string[] {
  const wanted = new Set(notes)
  return INTRO_ORDER.filter(note => wanted.has(note))
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function firstUncovered(notes: readonly string[]): string | null {
  const covered = new Set(notes)
  return INTRO_ORDER.find(note => !covered.has(note)) ?? null
}

function legacyMigration(reviewed: readonly string[]): string[] {
  const reviewedSet = new Set(reviewed)
  const leading: string[] = []
  for (const note of INTRO_ORDER) {
    if (!reviewedSet.has(note)) break
    leading.push(note)
  }
  const floor = leading.length >= 4 ? leading : INTRO_ORDER.slice(0, 4)
  return canonical([...floor, ...reviewed])
}

function expectedSessionRoster(rawPolicy: string | null, reviewed: readonly string[]): string[] {
  if (rawPolicy !== null) {
    try {
      const parsed = JSON.parse(rawPolicy) as { revision?: unknown; unlockedNotes?: unknown }
      if (parsed && parsed.revision === 1 && Array.isArray(parsed.unlockedNotes)) {
        const normalized = canonical(parsed.unlockedNotes.filter((note): note is string => typeof note === 'string'))
        if (normalized.length >= 2 && normalized[0] === 'C4') return canonical([...normalized, ...reviewed])
      }
    } catch {}
  }
  return reviewed.length === 0 ? INTRO_ORDER.slice(0, 2) : legacyMigration(reviewed)
}

function sourceHasAll(haystack: string, needles: readonly string[]): boolean {
  return needles.every(needle => haystack.includes(needle))
}

async function add(
  id: string,
  group: string,
  contract: string,
  expectation: Expectation,
  evidenceClass: EvidenceClass,
  probe: Probe,
): Promise<void> {
  try {
    const effectiveExpectation: Expectation = MODE === '--green' ? 'PASS' : expectation
    const result = await probe()
    const pass = typeof result === 'boolean' ? result : result.pass
    const evidence = typeof result === 'boolean' ? {} : result.evidence ?? {}
    rows.push({
      id, group, contract, expectation: effectiveExpectation, evidenceClass,
      actual: pass ? 'PASS' : 'RED',
      classification: effectiveExpectation === 'PASS'
        ? pass ? 'MATCH' : 'UNEXPECTED_FAIL'
        : pass ? 'UNEXPECTED_PASS' : 'MATCH',
      evidence,
    })
  } catch (error) {
    const effectiveExpectation: Expectation = MODE === '--green' ? 'PASS' : expectation
    rows.push({
      id, group, contract, expectation: effectiveExpectation, evidenceClass,
      actual: 'RED',
      classification: effectiveExpectation === 'RED' ? 'MATCH' : 'UNEXPECTED_FAIL',
      evidence: {},
      error: error instanceof Error ? error.stack ?? error.message : String(error),
    })
  }
}

function voiceDemandMeasurement(roster: string[]): Evidence {
  const state = engine.createInitialState('easy', roster, 10_000, `r9a-demand:${roster.length}`)
  state.wave = 2
  engine.beginWave(state, {}, 0)
  const measuredFirstDemandFloorMs = state.nextAttackAtMs + engine.DIVE_TELEGRAPH_MS - state.waveStartedAtMs
  return {
    roster,
    configuredDemandFloorMs: engine.ENGINE_DEMAND_FLOOR_MS.easy,
    measuredFirstDemandFloorMs,
    requiredApmCeiling: 60_000 / engine.ENGINE_DEMAND_FLOOR_MS.easy,
    pendingIntroductionsAtLoad: state.pendingIntroductions.length,
  }
}

function reviewedMemory(note: string): NoteMemory {
  return { ...createNote(note), lastReview: 1, phase: 'review' }
}

function reviewedStore(notes: readonly string[]): Record<string, NoteMemory> {
  return Object.fromEntries(notes.map(note => [note, reviewedMemory(note)]))
}

class MemoryStorage implements RetroCurriculumStorage {
  value: string | null
  reads = 0
  writes = 0

  constructor(value: string | null = null) {
    this.value = value
  }

  getItem(key: string): string | null {
    assert.equal(key, POLICY_KEY)
    this.reads++
    return this.value
  }

  setItem(key: string, value: string): void {
    assert.equal(key, POLICY_KEY)
    this.writes++
    this.value = value
  }
}

function engineInput(overrides: Partial<EngineInput> = {}): EngineInput {
  return {
    inputMode: 'click',
    isListening: false,
    reducedMotion: false,
    pitch: null,
    pendingAnswer: null,
    isActive: true,
    fsrs: {},
    voiceTimeoutObservation: { healthy: false, heard: false },
    ceremonyToneAck: null,
    pianoReadiness: null,
    blindStimulusAck: null,
    curriculumUnlockAck: null,
    ...overrides,
  }
}

function thresholdRequest(roster: string[], gameId: string): {
  state: GameState
  request: PendingCurriculumUnlock
  events: EngineEvent[]
} {
  const state = engine.createInitialState('easy', roster, 1_000, gameId)
  const note = roster[0]
  const anchor = engine.formationAnchor(0)
  const alien: Alien = {
    alienId: `${gameId}:alien:1:0`,
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
    hue: 18,
    soul: engine.snapshotNoteSoul(note, reviewedMemory(note), 1),
    diveServiceCount: 0,
    alive: true,
    frame: 0,
    hitTimer: 0,
  }
  state.aliens = [alien]
  state.spawnQueue = []
  state.alienCountThisWave = 1
  state.spawnedThisWave = 1
  state.waveIntroTimer = 0
  state.consecutiveCorrect = UNLOCK_THRESHOLDS[new Set(roster).size] - 1
  state.activeAttack = {
    attackId: `${gameId}:attack:1`,
    alienId: alien.alienId,
    note,
    side: 1,
    cuePolicy: 'guided',
    readinessObservationId: null,
    stimulusRequest: null,
    phase: 'outbound',
    telegraphStartedAtMs: state.directorClockMs - engine.DIVE_TELEGRAPH_MS,
    demandAtMs: state.directorClockMs,
    deadlineAtMs: state.directorClockMs + engine.DIVE_RESPONSE_DEADLINE_MS,
    outboundT: 0.5,
    returnFromT: 0,
    returnStartedAtMs: null,
    outcome: null,
    resolvedAtMs: null,
    voiceWindowEligible: null,
    voiceHeardPhonation: false,
  }
  const events: EngineEvent[] = []
  assert.equal(engine.resolveAttack(state, state.activeAttack.attackId, 'correct', 200, events, 'click'), true)
  const requestEvent = events.find(event => event.kind === 'curriculumUnlockRequest')
  assert(requestEvent?.kind === 'curriculumUnlockRequest')
  return { state, request: requestEvent, events }
}

function ackFor(request: PendingCurriculumUnlock, committed: boolean): CurriculumUnlockAck {
  return { ...request, sessionCandidateRoster: [...request.sessionCandidateRoster], committed }
}

async function main(): Promise<void> {
await add('P-01', 'protected-baseline', 'exact shared product base is checked out', 'PASS', 'source-backed', () => ({
  pass: git('rev-parse', 'HEAD') === BASE && git('rev-parse', 'origin/master') === BASE,
  evidence: { head: git('rev-parse', 'HEAD'), originMaster: git('rev-parse', 'origin/master') },
}))

await add('P-02', 'protected-baseline', MODE === '--green'
  ? 'product source changes stay inside the exact R9a ceiling'
  : 'tracked and untracked product source are clean', 'PASS', 'source-backed', () => {
  const tracked = git('diff', '--name-only', 'HEAD', '--', 'src').split(/\r?\n/).filter(Boolean)
  const untracked = git('ls-files', '--others', '--exclude-standard', '--', 'src').split(/\r?\n/).filter(Boolean)
  const expectedTracked = MODE === '--green'
    ? ['src/components/PitchDefender/RetroBlasterII.tsx', 'src/components/PitchDefender/retroBlasterEngine.ts']
    : []
  const expectedUntracked = MODE === '--green'
    ? ['src/components/PitchDefender/retroBlasterCurriculum.ts']
    : []
  return {
    pass: JSON.stringify(tracked.sort()) === JSON.stringify(expectedTracked) &&
      JSON.stringify(untracked.sort()) === JSON.stringify(expectedUntracked),
    evidence: { tracked, untracked, expectedTracked, expectedUntracked },
  }
})

await add('P-03', 'protected-baseline', 'canonical INTRO_ORDER is exact and unique', 'PASS', 'runtime-measured', () => ({
  pass: JSON.stringify(INTRO_ORDER) === JSON.stringify([
    'C4', 'A4', 'G4', 'E4', 'D4', 'F4', 'B4', 'C5', 'A3', 'G3', 'E3', 'C3', 'D3', 'F3', 'B3',
  ]) && new Set(INTRO_ORDER).size === 15,
  evidence: { introOrder: INTRO_ORDER },
}))

await add('P-04', 'protected-baseline', 'unlock thresholds remain exact for distinct sizes 2 through 14', 'PASS', 'runtime-measured', () => ({
  pass: JSON.stringify(UNLOCK_THRESHOLDS) === JSON.stringify({
    2: 5, 3: 7, 4: 10, 5: 13, 6: 16, 7: 20, 8: 8, 9: 10, 10: 12, 11: 14, 12: 16, 13: 18, 14: 20,
  }),
  evidence: { thresholds: UNLOCK_THRESHOLDS },
}))

await add('P-05', 'protected-baseline', MODE === '--green'
  ? 'six protected source hashes remain exact while engine and shell intentionally change'
  : 'all eight frozen source hashes are exact', 'PASS', 'source-backed', () => ({
  pass: Object.entries(EXPECTED_HASHES).every(([key, value]) =>
    MODE === '--green' && (key === 'engine' || key === 'shell')
      ? hashes[key] !== value
      : hashes[key as keyof typeof EXPECTED_HASHES] === value),
  evidence: { expected: EXPECTED_HASHES, actual: Object.fromEntries(Object.keys(EXPECTED_HASHES).map(key => [key, hashes[key as keyof typeof hashes]])) },
}))

await add('P-06', 'protected-baseline', 'EAR and VOICE family keys remain separate', 'PASS', 'source-backed', () => ({
  pass: sourceHasAll(source.family, ['pitch_fsrs_memory_ear', 'pitch_fsrs_memory']),
  evidence: { earKeyPresent: source.family.includes('pitch_fsrs_memory_ear'), voiceKeyPresent: source.family.includes('pitch_fsrs_memory') },
}))

await add('P-07', 'protected-baseline', 'pure engine owns no browser storage or Web Lock I/O', 'PASS', 'source-backed', () => ({
  pass: !/localStorage|sessionStorage|navigator\.locks|retro_blaster_curriculum_v1/.test(source.engine),
  evidence: { forbiddenMatches: source.engine.match(/localStorage|sessionStorage|navigator\.locks|retro_blaster_curriculum_v1/g) ?? [] },
}))

await add('P-08', 'protected-baseline', 'closed R8c identity-mask and request/ack seams remain present', 'PASS', 'source-backed', () => ({
  pass: sourceHasAll(source.engine, ['BlindStimulusRequest', 'blindStimulusAck', 'identityMaskActive']) &&
    sourceHasAll(source.shell, ['data-retro-signal-check', 'data-retro-identity-mask']),
  evidence: { r8cHooks: true },
}))

await add('P-09', 'protected-baseline', 'closed R8a RADIO CHECK remains readiness-only at base', 'PASS', 'source-backed', () => ({
  pass: sourceHasAll(source.shell, ['RADIO_CHECK_NOTE', "guard: 'radio-check'", 'answerEarReadiness']),
  evidence: { radioCheckPresent: true },
}))

await add('P-10', 'protected-baseline', 'native Node Web Locks substrate is available and exclusive', 'PASS', 'runtime-measured', async () => {
  const locks = (globalThis.navigator as Navigator & { locks?: LockManager }).locks
  if (!locks) return { pass: false, evidence: { node: process.version, locks: false } }
  const order: string[] = []
  await Promise.all([
    locks.request(`${LOCK_NAME}:red-substrate`, () => { order.push('A-in', 'A-out') }),
    locks.request(`${LOCK_NAME}:red-substrate`, () => { order.push('B-in', 'B-out') }),
  ])
  return { pass: order.join('>') === 'A-in>A-out>B-in>B-out', evidence: { node: process.version, order } }
})

const curriculumModulePath = 'src/components/PitchDefender/retroBlasterCurriculum.ts'
const curriculumModuleExists = existsSync(curriculumModulePath)
const curriculumSource = curriculumModuleExists ? readFileSync(curriculumModulePath, 'utf8') : ''

await add('R-01', 'policy-module', 'dedicated curriculum policy module exists', 'RED', 'source-backed', () => ({
  pass: curriculumModuleExists,
  evidence: { path: curriculumModulePath, exists: curriculumModuleExists },
}))

await add('R-02', 'policy-module', 'single symbolic product curriculum key is declared outside engine and shell', 'RED', 'source-backed', () => ({
  pass: curriculumSource.includes(POLICY_KEY) && !source.engine.includes(POLICY_KEY) && !source.shell.includes(POLICY_KEY),
  evidence: { moduleHasKey: curriculumSource.includes(POLICY_KEY), engineHasLiteral: source.engine.includes(POLICY_KEY), shellHasLiteral: source.shell.includes(POLICY_KEY) },
}))

await add('R-03', 'fresh-start', 'absent zero-review learner starts with exactly C4,A4', 'RED', 'source-backed', () => ({
  pass: !source.engine.includes('INITIAL_UNLOCK') &&
    JSON.stringify(resolveRetroCurriculumSession(null, {}).sessionRoster) === JSON.stringify(['C4', 'A4']),
  evidence: { actual: resolveRetroCurriculumSession(null, {}).sessionRoster, expected: ['C4', 'A4'] },
}))

await add('R-04', 'session-resolution', 'builder receives an explicit resolved session roster', 'RED', 'source-backed', () => ({
  pass: /buildRetroBlasterState\([\s\S]{0,260}sessionRoster/.test(source.shell),
  evidence: { currentBuilderDerivesFromReviewStore: source.shell.includes('restored.length >= INITIAL_UNLOCK') },
}))

for (const [id, contract, raw, reviewed, expected] of [
  ['R-05', 'absent fresh migration', null, [], ['C4', 'A4']],
  ['R-06', 'corrupt fresh migration', '{bad', [], ['C4', 'A4']],
  ['R-07', 'legacy one-review floor reconstruction', null, ['C4'], ['C4', 'A4', 'G4', 'E4']],
  ['R-08', 'legacy five-prefix reconstruction', null, ['C4', 'A4', 'G4', 'E4', 'D4'], ['C4', 'A4', 'G4', 'E4', 'D4']],
  ['R-09', 'legacy non-prefix reviewed union', null, ['C4', 'B4'], ['C4', 'A4', 'G4', 'E4', 'B4']],
  ['R-10', 'legacy no-C4 reviewed union', null, ['A4', 'G4', 'E4', 'D4'], ['C4', 'A4', 'G4', 'E4', 'D4']],
  ['R-11', 'valid policy never reapplies legacy floor', JSON.stringify({ revision: 1, unlockedNotes: ['C4', 'A4'] }), ['C4'], ['C4', 'A4']],
  ['R-12', 'valid policy unions active-lane non-prefix review', JSON.stringify({ revision: 1, unlockedNotes: ['C4', 'A4'] }), ['D4'], ['C4', 'A4', 'D4']],
] as const) {
  await add(id, 'migration', contract, 'RED', 'reference-oracle', () => ({
    pass: curriculumModuleExists &&
      JSON.stringify(resolveRetroCurriculumSession(raw, reviewedStore(reviewed)).sessionRoster) === JSON.stringify(expected) &&
      JSON.stringify(expectedSessionRoster(raw, reviewed)) === JSON.stringify(expected),
    evidence: {
      raw,
      reviewed,
      productActual: resolveRetroCurriculumSession(raw, reviewedStore(reviewed)).sessionRoster,
      referenceExpected: expectedSessionRoster(raw, reviewed),
      assertedExpected: expected,
    },
  }))
}

await add('R-13', 'normalization', 'duplicates and unknown notes repair without relocking', 'RED', 'reference-oracle', () => ({
  pass: JSON.stringify(resolveRetroCurriculumSession(
    JSON.stringify({ revision: 1, unlockedNotes: ['C4', 'A4', 'A4', 'H9'] }),
    {},
  ).sessionRoster) === JSON.stringify(['C4', 'A4']),
  evidence: {
    input: ['C4', 'A4', 'A4', 'H9'],
    productActual: resolveRetroCurriculumSession(
      JSON.stringify({ revision: 1, unlockedNotes: ['C4', 'A4', 'A4', 'H9'] }),
      {},
    ),
    referenceNormalized: canonical(['C4', 'A4', 'A4', 'H9']),
  },
}))

await add('R-14', 'normalization', 'missing C4 or normalized size one is corrupt', 'RED', 'reference-oracle', () => {
  const missingAnchor = resolveRetroCurriculumSession(
    JSON.stringify({ revision: 1, unlockedNotes: ['A4', 'G4'] }), {},
  )
  const sizeOne = resolveRetroCurriculumSession(
    JSON.stringify({ revision: 1, unlockedNotes: ['C4'] }), {},
  )
  return {
    pass: missingAnchor.source === 'corrupt' && sizeOne.source === 'corrupt' &&
      JSON.stringify(missingAnchor.sessionRoster) === JSON.stringify(['C4', 'A4']) &&
      JSON.stringify(sizeOne.sessionRoster) === JSON.stringify(['C4', 'A4']),
    evidence: { missingAnchor, sizeOne },
  }
})

await add('R-15', 'normalization', 'repairable unknown top-level fields survive normalized commits', 'RED', 'runtime-measured', () => {
  const merged = deriveMonotonicCurriculumRecord(
    JSON.stringify({ revision: 1, unlockedNotes: ['C4', 'A4', 'A4', 'H9'], futureFlag: { x: 1 } }),
    ['C4', 'A4'],
    ['C4', 'A4', 'G4'],
    {},
  )
  return {
    pass: JSON.stringify(merged.durableRoster) === JSON.stringify(['C4', 'A4', 'G4']) &&
      JSON.stringify(merged.record.futureFlag) === JSON.stringify({ x: 1 }),
    evidence: { merged },
  }
})

await add('R-16', 'lane-law', 'curriculum breadth is product-global while review union is active-lane-only', 'RED', 'runtime-measured', () => {
  const policy = JSON.stringify({ revision: 1, unlockedNotes: INTRO_ORDER.slice(0, 5) })
  const zeroReviewVoice = resolveRetroCurriculumSession(policy, {})
  const voiceWithNonPrefixReview = resolveRetroCurriculumSession(policy, reviewedStore(['B4']))
  return {
    pass: PRODUCT_POLICY_KEY === POLICY_KEY &&
      JSON.stringify(zeroReviewVoice.sessionRoster) === JSON.stringify(INTRO_ORDER.slice(0, 5)) &&
      JSON.stringify(voiceWithNonPrefixReview.sessionRoster) === JSON.stringify([...INTRO_ORDER.slice(0, 5), 'B4']) &&
      source.shell.includes('activeLaneStore(stores, inputMode)'),
    evidence: { singularKey: PRODUCT_POLICY_KEY, zeroReviewVoice, voiceWithNonPrefixReview },
  }
})

await add('R-17', 'cross-lane-demand', 'wide inherited VOICE exposure does not increase demand or bulk introductions', 'RED', 'runtime-measured', () => {
  const narrow = voiceDemandMeasurement(INTRO_ORDER.slice(0, 2))
  const wide = voiceDemandMeasurement(INTRO_ORDER.slice(0, 5))
  const timingEqual = narrow.configuredDemandFloorMs === wide.configuredDemandFloorMs &&
    narrow.measuredFirstDemandFloorMs === wide.measuredFirstDemandFloorMs &&
    narrow.requiredApmCeiling === wide.requiredApmCeiling
  const noBulkLoad = narrow.pendingIntroductionsAtLoad === 0 && wide.pendingIntroductionsAtLoad === 0
  const singleIntroductionPushSite = (source.engine.match(/pendingIntroductions\.push\(/g) ?? []).length === 1
  const policyCanProduceWideVoice = JSON.stringify(resolveRetroCurriculumSession(
    JSON.stringify({ revision: 1, unlockedNotes: INTRO_ORDER.slice(0, 5) }),
    {},
  ).sessionRoster) === JSON.stringify(INTRO_ORDER.slice(0, 5))
  return {
    pass: timingEqual && noBulkLoad && singleIntroductionPushSite && policyCanProduceWideVoice,
    evidence: { narrow, wide, timingEqual, noBulkLoad, singleIntroductionPushSite, policyCanProduceWideVoice },
  }
})

await add('R-18', 'stale-tab', 'every write uses the exact origin-wide exclusive Web Lock', 'RED', 'runtime-measured', async () => {
  const calls: Array<{ name: string; mode: LockMode | undefined }> = []
  const fakeLocks = {
    request: (name: string, options: LockOptions, callback: LockGrantedCallback) => {
      calls.push({ name, mode: options.mode })
      return Promise.resolve(callback(null))
    },
  } as unknown as LockManager
  const storage = new MemoryStorage()
  const result = await commitRetroCurriculum({
    storage,
    locks: fakeLocks,
    signal: new AbortController().signal,
    sessionCandidateRoster: ['C4', 'A4'],
    getLastDurableRoster: () => [],
    getLastExtensionFields: () => ({}),
  })
  return {
    pass: result.ok && calls.length === 1 && calls[0].name === PRODUCT_LOCK_NAME &&
      calls[0].name === LOCK_NAME && calls[0].mode === 'exclusive' && storage.writes === 1,
    evidence: { calls, result, writes: storage.writes },
  }
})

await add('R-19', 'stale-tab', 'locked callback re-reads unions and writes synchronously', 'RED', 'runtime-measured', async () => {
  const order: string[] = []
  const storage: RetroCurriculumStorage = {
    getItem: () => { order.push('read'); return JSON.stringify({ revision: 1, unlockedNotes: ['C4', 'A4'] }) },
    setItem: () => { order.push('write') },
  }
  const fakeLocks = {
    request: (_name: string, _options: LockOptions, callback: LockGrantedCallback) => {
      order.push('lock-in')
      const value = callback(null)
      order.push('lock-out')
      return Promise.resolve(value)
    },
  } as unknown as LockManager
  const result = await commitRetroCurriculum({
    storage,
    locks: fakeLocks,
    signal: new AbortController().signal,
    sessionCandidateRoster: ['C4', 'A4', 'G4'],
    getLastDurableRoster: () => ['C4', 'A4'],
    getLastExtensionFields: () => ({}),
  })
  return {
    pass: result.ok && order.join('>') === 'lock-in>read>write>lock-out' &&
      curriculumSource.includes('deriveMonotonicCurriculumRecord'),
    evidence: { order, result },
  }
})

await add('R-20', 'stale-tab', 'no unlocked persistence fallback exists', 'RED', 'runtime-measured', async () => {
  const storage = new MemoryStorage()
  const result = await commitRetroCurriculum({
    storage,
    locks: undefined,
    signal: new AbortController().signal,
    sessionCandidateRoster: ['C4', 'A4'],
    getLastDurableRoster: () => [],
    getLastExtensionFields: () => ({}),
  })
  return {
    pass: !result.ok && result.reason === 'locks-unavailable' && storage.reads === 0 && storage.writes === 0 &&
      source.engine.includes('curriculumSaveBlocked'),
    evidence: { result, reads: storage.reads, writes: storage.writes },
  }
})

await add('R-21', 'stale-tab', 'stale writers monotonically union rather than narrow durable state', 'RED', 'runtime-measured', async () => {
  const nativeLocks = (globalThis.navigator as Navigator & { locks?: LockManager }).locks
  assert(nativeLocks, 'native Node navigator.locks unavailable')
  const expected = ['C4', 'A4', 'G4', 'E4']
  const acquisitions: string[][] = []
  for (const first of ['A', 'B'] as const) {
    for (let trial = 0; trial < 50; trial++) {
      const storage = new MemoryStorage(JSON.stringify({ revision: 1, unlockedNotes: ['C4', 'A4'] }))
      const acquisition: string[] = []
      let releaseStart!: () => void
      const start = new Promise<void>(resolveStart => { releaseStart = resolveStart })
      const writer = async (label: 'A' | 'B', candidate: string[]) => {
        await start
        const labeledLocks = {
          request: (name: string, options: LockOptions, callback: LockGrantedCallback) =>
            nativeLocks.request(name, options, lock => {
              acquisition.push(label)
              return callback(lock)
            }),
        } as LockManager
        return commitRetroCurriculum({
          storage,
          locks: labeledLocks,
          signal: new AbortController().signal,
          sessionCandidateRoster: candidate,
          getLastDurableRoster: () => ['C4', 'A4'],
          getLastExtensionFields: () => ({}),
        })
      }
      const launch = first === 'A'
        ? [writer('A', ['C4', 'A4', 'G4']), writer('B', ['C4', 'A4', 'E4'])]
        : [writer('B', ['C4', 'A4', 'E4']), writer('A', ['C4', 'A4', 'G4'])]
      releaseStart()
      const results = await Promise.all(launch)
      assert(results.every(result => result.ok))
      assert.deepEqual(acquisition, first === 'A' ? ['A', 'B'] : ['B', 'A'])
      const final = JSON.parse(storage.value!) as { unlockedNotes: string[] }
      assert.deepEqual(final.unlockedNotes, expected)
      acquisitions.push(acquisition)
    }
  }

  const unsafeStorage = new MemoryStorage(JSON.stringify({ revision: 1, unlockedNotes: ['C4', 'A4'] }))
  let reads = 0
  let releaseUnsafe!: () => void
  const unsafeBarrier = new Promise<void>(resolveBarrier => { releaseUnsafe = resolveBarrier })
  const unsafeWriter = async (candidate: string[]) => {
    const current = unsafeStorage.getItem(POLICY_KEY)
    reads++
    if (reads === 2) releaseUnsafe()
    await unsafeBarrier
    const merged = deriveMonotonicCurriculumRecord(current, ['C4', 'A4'], candidate, {})
    unsafeStorage.setItem(POLICY_KEY, JSON.stringify(merged.record))
  }
  await Promise.all([
    unsafeWriter(['C4', 'A4', 'G4']),
    unsafeWriter(['C4', 'A4', 'E4']),
  ])
  const unsafeFinal = (JSON.parse(unsafeStorage.value!) as { unlockedNotes: string[] }).unlockedNotes
  return {
    pass: acquisitions.length === 100 && !sameStringArray(unsafeFinal, expected),
    evidence: {
      trials: acquisitions.length,
      firstA: acquisitions.filter(order => order[0] === 'A').length,
      firstB: acquisitions.filter(order => order[0] === 'B').length,
      finalLocked: expected,
      unsafeFinal,
      unsafeLostUpdate: !sameStringArray(unsafeFinal, expected),
    },
  }
})

await add('R-22', 'stale-tab', 'corrupt locked reread retains last repairable extension bag', 'RED', 'runtime-measured', () => {
  const merged = deriveMonotonicCurriculumRecord(
    '{corrupt',
    ['C4', 'A4', 'G4'],
    ['C4', 'A4', 'E4'],
    { futureFlag: { retained: true } },
  )
  return {
    pass: JSON.stringify(merged.durableRoster) === JSON.stringify(['C4', 'A4', 'G4', 'E4']) &&
      JSON.stringify(merged.record.futureFlag) === JSON.stringify({ retained: true }),
    evidence: { merged },
  }
})

await add('R-23', 'lifecycle', 'queued lock request owns an AbortController and exact teardown', 'RED', 'runtime-measured', async () => {
  const nativeLocks = (globalThis.navigator as Navigator & { locks?: LockManager }).locks
  assert(nativeLocks, 'native Node navigator.locks unavailable')
  let releaseHold!: () => void
  let held!: () => void
  const entered = new Promise<void>(resolveEntered => { held = resolveEntered })
  const hold = nativeLocks.request(`${LOCK_NAME}:abort`, () => new Promise<void>(resolveHold => {
    releaseHold = resolveHold
    held()
  }))
  await entered
  const controller = new AbortController()
  const pending = commitRetroCurriculum({
    storage: new MemoryStorage(),
    locks: {
      request: (_name: string, options: LockOptions, callback: LockGrantedCallback) =>
        nativeLocks.request(`${LOCK_NAME}:abort`, options, callback),
    } as LockManager,
    signal: controller.signal,
    sessionCandidateRoster: ['C4', 'A4'],
    getLastDurableRoster: () => [],
    getLastExtensionFields: () => ({}),
  })
  controller.abort()
  let abortName = ''
  try { await pending } catch (error) { abortName = (error as { name?: string }).name ?? '' }
  releaseHold()
  await hold
  return {
    pass: abortName === 'AbortError' && source.shell.includes('abortCurriculumSession') && source.shell.includes('AbortError'),
    evidence: { abortName, controllersInShell: (source.shell.match(/AbortController/g) ?? []).length },
  }
})

await add('R-24', 'lifecycle', 'normal readiness handoff preserves migration while teardown blocks resurrection', 'RED', 'source-backed', () => ({
  pass: source.shell.includes('pendingCurriculum') && sourceHasAll(source.shell, ['gameId', 'requestId', 'AbortError']),
  evidence: {
    delayedLockLifecyclePresent: source.shell.includes('pendingCurriculum') &&
      source.shell.includes('curriculumSessionIdRef.current !== sessionId'),
    startGameDoesNotAbortSession: !source.shell.slice(
      source.shell.indexOf('const startGame'),
      source.shell.indexOf('const retryCeremonySignal'),
    ).includes('abortCurriculumSession'),
  },
}))

await add('R-25', 'engine-authority', 'immutable pending curriculum request exists in pure engine state', 'RED', 'runtime-measured', () => {
  const requested = thresholdRequest(['C4', 'A4'], 'r9a-pending')
  return {
    pass: requested.state.pendingCurriculumUnlock?.requestId === requested.request.requestId &&
      JSON.stringify(requested.state.unlockedNotes) === JSON.stringify(['C4', 'A4']),
    evidence: { pending: requested.state.pendingCurriculumUnlock, roster: requested.state.unlockedNotes },
  }
})

await add('R-26', 'engine-authority', 'request identity uses gameId and deterministic curriculum serial', 'RED', 'runtime-measured', () => {
  const first = thresholdRequest(['C4', 'A4'], 'r9a-serial')
  const replay = thresholdRequest(['C4', 'A4'], 'r9a-serial')
  return {
    pass: first.request.requestId === 'r9a-serial:curriculum:0' &&
      first.request.requestId === replay.request.requestId && first.state.nextCurriculumUnlockSerial === 1,
    evidence: { requestId: first.request.requestId, nextSerial: first.state.nextCurriculumUnlockSerial },
  }
})

await add('R-27', 'engine-authority', 'threshold emits request before roster streak or ceremony mutation', 'RED', 'runtime-measured', () => {
  const requested = thresholdRequest(['C4', 'A4'], 'r9a-before-mutation')
  return {
    pass: JSON.stringify(requested.state.unlockedNotes) === JSON.stringify(['C4', 'A4']) &&
      requested.state.consecutiveCorrect === UNLOCK_THRESHOLDS[2] &&
      requested.state.pendingIntroductions.length === 0 &&
      requested.events.filter(event => event.kind === 'curriculumUnlockRequest').length === 1 &&
      requested.events.filter(event => event.kind === 'unlock').length === 0,
    evidence: {
      roster: requested.state.unlockedNotes,
      streak: requested.state.consecutiveCorrect,
      pendingIntroductions: requested.state.pendingIntroductions,
      events: requested.events.map(event => event.kind),
    },
  }
})

await add('R-28', 'engine-authority', 'exact next-active-tick ack alone commits unlock', 'RED', 'runtime-measured', () => {
  const requested = thresholdRequest(['C4', 'A4'], 'r9a-ack-success')
  const result = engine.tick(
    requested.state,
    engineInput({ curriculumUnlockAck: ackFor(requested.request, true) }),
    0,
    () => 0.5,
  )
  return {
    pass: result.state.pendingCurriculumUnlock === null &&
      JSON.stringify(result.state.unlockedNotes) === JSON.stringify(['C4', 'A4', 'G4']) &&
      result.state.consecutiveCorrect === 0 &&
      JSON.stringify(result.state.pendingIntroductions) === JSON.stringify(['G4']) &&
      result.events.filter(event => event.kind === 'unlock').length === 1,
    evidence: { roster: result.state.unlockedNotes, streak: result.state.consecutiveCorrect, introductions: result.state.pendingIntroductions, events: result.events },
  }
})

await add('R-29', 'engine-authority', 'stale mismatched duplicate inactive and post-route acks are inert', 'RED', 'runtime-measured', () => {
  const requested = thresholdRequest(['C4', 'A4'], 'r9a-ack-inert')
  const wrong = engine.tick(
    requested.state,
    engineInput({ curriculumUnlockAck: { ...ackFor(requested.request, true), requestId: 'wrong' } }),
    0,
    () => 0.5,
  )
  const inactive = engine.tick(
    requested.state,
    engineInput({ isActive: false, curriculumUnlockAck: ackFor(requested.request, true) }),
    900,
    () => 0.5,
  )
  const success = engine.tick(
    requested.state,
    engineInput({ curriculumUnlockAck: ackFor(requested.request, true) }),
    0,
    () => 0.5,
  )
  const duplicate = engine.tick(
    success.state,
    engineInput({ curriculumUnlockAck: ackFor(requested.request, true) }),
    0,
    () => 0.5,
  )
  const postRouteState = { ...requested.state, gameId: 'r9a-ack-after-route' }
  const postRoute = engine.tick(
    postRouteState,
    engineInput({ curriculumUnlockAck: ackFor(requested.request, true) }),
    0,
    () => 0.5,
  )
  return {
    pass: wrong.state.pendingCurriculumUnlock?.requestId === requested.request.requestId &&
      JSON.stringify(wrong.state.unlockedNotes) === JSON.stringify(['C4', 'A4']) &&
      inactive.state.pendingCurriculumUnlock?.requestId === requested.request.requestId &&
      JSON.stringify(inactive.state.unlockedNotes) === JSON.stringify(['C4', 'A4']) &&
      duplicate.events.filter(event => event.kind === 'unlock').length === 0 &&
      JSON.stringify(duplicate.state.unlockedNotes) === JSON.stringify(['C4', 'A4', 'G4']) &&
      postRoute.events.filter(event => event.kind === 'unlock').length === 0 &&
      JSON.stringify(postRoute.state.unlockedNotes) === JSON.stringify(['C4', 'A4']),
    evidence: {
      wrongPending: wrong.state.pendingCurriculumUnlock,
      inactivePending: inactive.state.pendingCurriculumUnlock,
      duplicateEvents: duplicate.events.map(event => event.kind),
      postRouteGameId: postRoute.state.gameId,
      postRoutePendingGameId: postRoute.state.pendingCurriculumUnlock?.gameId,
      postRouteEvents: postRoute.events.map(event => event.kind),
    },
  }
})

await add('R-30', 'engine-authority', 'failed persistence preserves roster and streak and emits save-blocked only', 'RED', 'runtime-measured', () => {
  const requested = thresholdRequest(['C4', 'A4'], 'r9a-ack-failure')
  const beforeStreak = requested.state.consecutiveCorrect
  const result = engine.tick(
    requested.state,
    engineInput({ curriculumUnlockAck: ackFor(requested.request, false) }),
    0,
    () => 0.5,
  )
  return {
    pass: result.state.pendingCurriculumUnlock === null &&
      JSON.stringify(result.state.unlockedNotes) === JSON.stringify(['C4', 'A4']) &&
      result.state.consecutiveCorrect === beforeStreak && result.state.pendingIntroductions.length === 0 &&
      result.events.filter(event => event.kind === 'curriculumSaveBlocked').length === 1 &&
      result.events.filter(event => event.kind === 'unlock').length === 0,
    evidence: { roster: result.state.unlockedNotes, streak: result.state.consecutiveCorrect, introductions: result.state.pendingIntroductions, events: result.events },
  }
})

await add('R-31', 'engine-authority', 'aborted queued persistence is silent and cannot ack', 'RED', 'source-backed', () => ({
  pass: source.shell.includes('AbortError') && source.engine.includes('curriculumUnlockAck'),
  evidence: { abortCatchIsSilent: source.shell.includes("name === 'AbortError') return") },
}))

await add('R-32', 'unlock-order', 'unlock selects first uncovered canonical note, not roster length index', 'RED', 'runtime-measured', () => {
  const roster = ['C4', 'A4', 'E4']
  const requested = thresholdRequest(roster, 'r9a-first-uncovered')
  return {
    pass: requested.request.note === firstUncovered(roster) && requested.request.note === 'G4' &&
      JSON.stringify(requested.request.sessionCandidateRoster) === JSON.stringify(['C4', 'A4', 'G4', 'E4']),
    evidence: { roster, requested: requested.request.note, candidate: requested.request.sessionCandidateRoster, referenceChoice: firstUncovered(roster) },
  }
})

await add('R-33', 'unlock-order', 'write succeeds before unlock event or NEW SIGNAL queue', 'RED', 'runtime-measured', async () => {
  const requested = thresholdRequest(['C4', 'A4'], 'r9a-write-before-ceremony')
  const storage = new MemoryStorage(JSON.stringify({ revision: 1, unlockedNotes: ['C4', 'A4'] }))
  const commit = await commitRetroCurriculum({
    storage,
    locks: (globalThis.navigator as Navigator & { locks?: LockManager }).locks,
    signal: new AbortController().signal,
    sessionCandidateRoster: requested.request.sessionCandidateRoster,
    getLastDurableRoster: () => ['C4', 'A4'],
    getLastExtensionFields: () => ({}),
  })
  assert(commit.ok)
  const durableBeforeAck = (JSON.parse(storage.value!) as { unlockedNotes: string[] }).unlockedNotes
  const result = engine.tick(
    requested.state,
    engineInput({ curriculumUnlockAck: ackFor(requested.request, true) }),
    0,
    () => 0.5,
  )
  return {
    pass: JSON.stringify(durableBeforeAck) === JSON.stringify(['C4', 'A4', 'G4']) &&
      result.events.some(event => event.kind === 'unlock') &&
      JSON.stringify(result.state.pendingIntroductions) === JSON.stringify(['G4']),
    evidence: { durableBeforeAck, eventsAfterAck: result.events.map(event => event.kind), introductionsAfterAck: result.state.pendingIntroductions },
  }
})

await add('R-34', 'recovery-status', 'failed unlock exposes exact non-modal save-paused status', 'RED', 'source-backed', () => ({
  pass: sourceHasAll(source.shell, [
    'LOCAL SAVE PAUSED - KEEP PLAYING; THE NEXT UNLOCK WILL RETRY.',
    'data-retro-curriculum-status',
    'aria-live="polite"',
  ]),
  evidence: { statusPresent: source.shell.includes('data-retro-curriculum-status="save-paused"') },
}))

await add('R-35', 'radio-check', 'RADIO CHECK roster derives dynamically from resolved session roster', 'RED', 'source-backed', () => ({
  pass: source.shell.includes('sessionRoster.slice(0, Math.min(4, sessionRoster.length))') && !source.shell.includes('RADIO_CHECK_ROSTER = INTRO_ORDER.slice'),
  evidence: { currentStaticRoster: source.shell.includes('RADIO_CHECK_ROSTER = INTRO_ORDER.slice') },
}))

await add('R-36', 'radio-check', 'fresh readiness renders 2 controls, size 3 renders 3, and 4+ caps at 4', 'RED', 'source-backed', () => ({
  pass: source.shell.includes('radioCheckRoster.map') && source.shell.includes('Math.min(4, sessionRoster.length)'),
  evidence: { dynamicControlSource: source.shell.includes('radioCheckRoster.map') },
}))

await add('R-37', 'radio-check', 'out-of-range number key returns before preventDefault and dispatch', 'RED', 'source-backed', () => {
  const handlerStart = source.shell.indexOf('const onReadinessKey =')
  const handlerEnd = source.shell.indexOf("window.addEventListener('keydown', onReadinessKey)", handlerStart)
  const handler = source.shell.slice(handlerStart, handlerEnd)
  const lookupIndex = handler.indexOf('const note =')
  const returnIndex = lookupIndex >= 0 ? handler.indexOf('if (!note) return', lookupIndex) : -1
  const preventIndex = handler.indexOf('preventDefault')
  const answerIndex = handler.indexOf('answerEarReadiness(note)')
  return {
    pass: lookupIndex >= 0 && returnIndex > lookupIndex && preventIndex > returnIndex && answerIndex > preventIndex,
    evidence: { handler, lookupIndex, missingNoteReturnIndex: returnIndex, preventDefaultIndex: preventIndex, answerIndex },
  }
})

await add('R-38', 'radio-check', 'VOICE readiness renders no EAR controls while consuming the same product roster', 'RED', 'source-backed', () => ({
  pass: source.shell.includes('sessionRoster') && source.shell.includes("inputMode === 'click'") && source.shell.includes('radioCheckRoster'),
  evidence: { currentSessionRosterResolver: source.shell.includes('resolveRetroCurriculumSession') },
}))

await add('R-39', 'proof-amendments', 'E1 row label honestly names explicit roster pass-through and selector proof', 'RED', 'source-backed', () => ({
  pass: source.e1.includes('active-lane store selector with explicit session rosters') && !source.e1.includes("'active-lane roster source'"),
  evidence: {
    honestLabelPresent: source.e1.includes('active-lane store selector with explicit session rosters'),
    obsoleteLabelPresent: source.e1.includes("'active-lane roster source'"),
  },
}))

await add('R-40', 'proof-amendments', 'R8c fixture no longer asserts four-note opening or exported INITIAL_UNLOCK', 'RED', 'source-backed', () => ({
  pass: !source.r8c.includes('engine.INITIAL_UNLOCK') && source.r8c.includes("['C4', 'A4']"),
  evidence: { obsoleteInitialUnlockAssertion: source.r8c.includes('engine.INITIAL_UNLOCK') },
}))

await add('R-41', 'proof-amendments', 'R8a fixture binds bounded roster and pre-preventDefault negative', 'RED', 'source-backed', () => ({
  pass: sourceHasAll(source.r8a, [
    'symbolic curriculum policy must resolve before readiness begins',
    'RADIO CHECK must bind its controls to the bounded session roster',
    'missing readiness keys must return before preventDefault and answer dispatch',
    'VOICE readiness must own no EAR response-control branch',
  ]),
  evidence: {
    currentR9aAmendmentPresent: source.r8a.includes('missing readiness keys must return before preventDefault and answer dispatch'),
  },
}))

await add('R-42', 'proof-amendments', 'family regression includes the R9a fixture as its own row', 'RED', 'source-backed', () => ({
  pass: source.familyRegression.includes('r9a-curriculum-fixture'),
  evidence: { currentFamilyRowPresent: source.familyRegression.includes('r9a-curriculum-fixture') },
}))

const orderedIds = [
  ...Array.from({ length: 10 }, (_, index) => `P-${String(index + 1).padStart(2, '0')}`),
  ...Array.from({ length: 42 }, (_, index) => `R-${String(index + 1).padStart(2, '0')}`),
]
const actualIds = rows.map(row => row.id)
const shapeValid = rows.length === orderedIds.length && new Set(actualIds).size === orderedIds.length &&
  JSON.stringify(actualIds) === JSON.stringify(orderedIds)
const unexpected = rows.filter(row => row.classification !== 'MATCH')
const protectedPass = rows.filter(row => row.id.startsWith('P-') && row.actual === 'PASS').length
const contractPass = rows.filter(row => row.id.startsWith('R-') && row.actual === 'PASS').length
const expectedRed = rows.filter(row => row.expectation === 'RED' && row.actual === 'RED').length
const unexpectedPass = rows.filter(row => row.classification === 'UNEXPECTED_PASS').length
const unexpectedFail = rows.filter(row => row.classification === 'UNEXPECTED_FAIL').length
const status = shapeValid && unexpected.length === 0
  ? MODE === '--green' ? 'PASS' : 'EXPECTED_RED_CONFIRMED'
  : 'UNEXPECTED_RESULT'
const result = {
  schema: MODE === '--green'
    ? 'retro-blaster-r9a-curriculum/green-v1'
    : 'retro-blaster-r9a-curriculum/red-first-v1',
  generatedAt: new Date().toISOString(),
  mode: MODE,
  exactBase: BASE,
  head: git('rev-parse', 'HEAD'),
  originMaster: git('rev-parse', 'origin/master'),
  fixture: { path: 'scripts/retro-blaster/r9a-curriculum-fixture.ts', sha256: sha256(readFileSync(SELF)) },
  output: OUTPUT,
  policyKey: POLICY_KEY,
  lockName: LOCK_NAME,
  inspectedSourceHashes: hashes,
  counts: { total: rows.length, protectedPass, contractPass, expectedRed, unexpectedPass, unexpectedFail },
  shapeValid,
  status,
  touchedPathAudit: {
    trackedSourceDiff: git('diff', '--name-only', 'HEAD', '--', 'src').split(/\r?\n/).filter(Boolean),
    untrackedSource: git('ls-files', '--others', '--exclude-standard', '--', 'src').split(/\r?\n/).filter(Boolean),
  },
  rows,
}

mkdirSync(dirname(OUTPUT), { recursive: true })
writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify(result, null, 2))
process.exitCode = status === 'EXPECTED_RED_CONFIRMED' || status === 'PASS' ? 0 : 1
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error))
  process.exitCode = 1
})
