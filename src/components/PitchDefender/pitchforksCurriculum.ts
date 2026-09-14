import { getVillageLessonCandidates } from './villageLessonSelector'
import { PITCHFORKS_RANGE_NOTES } from './pitchforksRange'
import {
  recordVillagePractice,
  type VillagePracticeReceipt,
} from './villagePractice'

export type TineCount = 1 | 2 | 3 | 4
export type CurriculumStage = 'showcase' | 'guided-pair' | 'recall-pair' | 'step-chain' | 'intervals'
export type CueSupportLevel = 'guided' | 'recall'
export type CueSupportOutcome = 'guided-success' | 'hinted-success' | 'recall-success' | 'miss'
export type FirstMinuteBeat = 'threat' | 'listen' | 'sing' | 'charge' | 'strike' | 'victory' | 'complete'

export interface CueSupportEvidence {
  guidedSuccesses: number
  independentRecalls: number
  needsGuidedRecovery: boolean
}

export interface CueSupportProfile {
  version: 1
  notes: Record<string, CueSupportEvidence>
}

export const PITCHFORKS_PRESENTATION_JOURNEY_KEY = 'pitchforks3_presentation_journey_v1'

export interface PitchforksDungeonClearReceipt {
  version: 1
  rangeAssessedAt: string
  startedAt: string
  admittedNotes: string[]
  clearedAt: number
}

export type PitchforksVillageBinding = Readonly<Pick<
  VillagePracticeReceipt, 'objective' | 'contextNote' | 'targetNote'
>>

export interface PitchforksVillageCurriculum {
  version: 1
  rangeAssessedAt: string
  startedAt: string
  bindings: readonly PitchforksVillageBinding[]
  boundAt: number
}

export interface PitchforksVillageClearReceipt {
  version: 1
  rangeAssessedAt: string
  startedAt: string
  bindings: readonly PitchforksVillageBinding[]
  clearedAt: number
}

export type PitchforksBellTowerClearReceipt = PitchforksDungeonClearReceipt
export type PitchforksCathedralClearReceipt = PitchforksDungeonClearReceipt

export interface PitchforksPresentationJourney {
  version: 1
  currentLevel: number
  rangeAssessedAt: string
  startedAt: string
  unlockedNotes: string[]
  guidedNotes: string[]
  dungeonClear?: PitchforksDungeonClearReceipt
  villageCurriculum?: PitchforksVillageCurriculum
  villageClear?: PitchforksVillageClearReceipt
  bellTowerClear?: PitchforksBellTowerClearReceipt
  cathedralClear?: PitchforksCathedralClearReceipt
  villagePractice?: readonly VillagePracticeReceipt[]
}

type CueMemory = Readonly<{
  phase: 'new' | 'learning' | 'review'
  lastReview: number
}>

export const EMPTY_CUE_SUPPORT_PROFILE: CueSupportProfile = { version: 1, notes: {} }

export function createPitchforksPresentationJourney(input: {
  rangeAssessedAt: string
  unlockedNotes: readonly string[]
  guidedNotes?: readonly string[]
  startedAt?: string
  dungeonClear?: PitchforksDungeonClearReceipt
  villageCurriculum?: PitchforksVillageCurriculum
  villageClear?: PitchforksVillageClearReceipt
  bellTowerClear?: PitchforksBellTowerClearReceipt
  cathedralClear?: PitchforksCathedralClearReceipt
  villagePractice?: readonly VillagePracticeReceipt[]
}): PitchforksPresentationJourney {
  const journey: PitchforksPresentationJourney = {
    version: 1,
    currentLevel: 1,
    rangeAssessedAt: input.rangeAssessedAt,
    startedAt: input.startedAt ?? new Date().toISOString(),
    unlockedNotes: [...input.unlockedNotes],
    guidedNotes: [...(input.guidedNotes ?? [])],
  }

  const dungeonClear = normalizePitchforksDungeonClear(input.dungeonClear, journey)
  const villagePractice = input.villagePractice ? [...input.villagePractice] : undefined
  return {
    ...journey,
    ...normalizeCampaignReceipts(input, journey, journey.unlockedNotes),
    ...(dungeonClear ? { dungeonClear } : {}),
    ...(villagePractice ? { villagePractice } : {}),
  }
}

function isValidPitchforksJourneyLevel(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isDenseArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value)) return false
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) return false
  }
  return true
}

function isDenseStringArray(value: unknown): value is string[] {
  return isDenseArray(value) && value.every(candidate => typeof candidate === 'string')
}

function isTrimmedIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

const VILLAGE_PRACTICE_RECEIPT_KEYS = new Set([
  'kind',
  'eventId',
  'journeyId',
  'sessionId',
  'encounterIndex',
  'introducedEncounterIndex',
  'timestampMs',
  'objective',
  'contextNote',
  'targetNote',
  'support',
  'cueFree',
])

function hasExactKeys(value: Record<string, unknown>, keys: ReadonlySet<string>): boolean {
  const ownKeys = Object.keys(value)
  return ownKeys.length === keys.size && ownKeys.every(key => keys.has(key))
}

function isVillagePracticeReceipt(value: unknown): value is VillagePracticeReceipt {
  if (!isRecord(value) || !hasExactKeys(value, VILLAGE_PRACTICE_RECEIPT_KEYS)) return false
  return value.kind === 'practice'
    && isTrimmedIdentifier(value.eventId)
    && isTrimmedIdentifier(value.journeyId)
    && isTrimmedIdentifier(value.sessionId)
    && isNonNegativeSafeInteger(value.encounterIndex)
    && isNonNegativeSafeInteger(value.introducedEncounterIndex)
    && isFiniteNonNegative(value.timestampMs)
    && (value.objective === 'minor-third'
      || value.objective === 'major-third'
      || value.objective === 'perfect-fifth')
    && isTrimmedIdentifier(value.contextNote)
    && isTrimmedIdentifier(value.targetNote)
    && (value.support === 'SUPPORTED' || value.support === 'UNAIDED_RETURN')
    && typeof value.cueFree === 'boolean'
}

function villagePracticeKey(value: Pick<
  VillagePracticeReceipt,
  'journeyId' | 'contextNote' | 'targetNote' | 'support'
>): string {
  return JSON.stringify([
    value.journeyId,
    value.contextNote,
    value.targetNote,
    value.support,
  ])
}

function comfortableRangeForPresentationOrder(
  presentationOrder: readonly string[],
): { lowNote: string; highNote: string } | null {
  let lowIndex = Number.POSITIVE_INFINITY
  let highIndex = -1
  for (const note of presentationOrder) {
    const index = PITCHFORKS_RANGE_NOTES.indexOf(note)
    if (index < 0) continue
    lowIndex = Math.min(lowIndex, index)
    highIndex = Math.max(highIndex, index)
  }
  if (highIndex <= lowIndex) return null
  return {
    lowNote: PITCHFORKS_RANGE_NOTES[lowIndex],
    highNote: PITCHFORKS_RANGE_NOTES[highIndex],
  }
}

function normalizePitchforksDungeonClear(
  value: unknown,
  journey: Pick<PitchforksPresentationJourney, 'rangeAssessedAt' | 'startedAt' | 'unlockedNotes'>,
  requirePrefix = true,
): PitchforksDungeonClearReceipt | undefined {
  if (!isRecord(value) || value.version !== 1) return undefined
  if (
    typeof value.rangeAssessedAt !== 'string' ||
    value.rangeAssessedAt.length === 0 ||
    value.rangeAssessedAt !== journey.rangeAssessedAt ||
    typeof value.startedAt !== 'string' ||
    value.startedAt.length === 0 ||
    value.startedAt !== journey.startedAt ||
    typeof value.clearedAt !== 'number' ||
    !Number.isFinite(value.clearedAt) ||
    value.clearedAt < 0 ||
    !isDenseArray(value.admittedNotes) ||
    value.admittedNotes.length < 2 ||
    value.admittedNotes.length > journey.unlockedNotes.length
  ) {
    return undefined
  }

  const admittedNotes: string[] = []
  const seen = new Set<string>()
  for (const candidate of value.admittedNotes) {
    if (
      typeof candidate !== 'string' ||
      candidate.length === 0 ||
      seen.has(candidate) ||
      !journey.unlockedNotes.includes(candidate) ||
      (requirePrefix && candidate !== journey.unlockedNotes[admittedNotes.length])
    ) {
      return undefined
    }
    seen.add(candidate)
    admittedNotes.push(candidate)
  }

  return {
    version: 1,
    rangeAssessedAt: value.rangeAssessedAt,
    startedAt: value.startedAt,
    admittedNotes,
    clearedAt: value.clearedAt,
  }
}

function normalizeVillageBindings(
  value: unknown,
  journey: PitchforksPresentationJourney,
  presentationOrder: readonly string[],
): PitchforksVillageBinding[] | undefined {
  if (!isDenseArray(value) || value.length === 0) return undefined
  const comfortableRange = comfortableRangeForPresentationOrder(presentationOrder)
  if (!comfortableRange) return undefined
  const candidates = getVillageLessonCandidates({
    admittedNotes: journey.unlockedNotes,
    introducedNotes: journey.unlockedNotes,
    comfortableRange,
  })
  const bindings: PitchforksVillageBinding[] = []
  const seen = new Set<string>()
  for (const binding of value) {
    if (!isRecord(binding)) return undefined
    const match = candidates.find(candidate => candidate.bothVoiceAdmitted
      && candidate.objective === binding.objective
      && candidate.contextNote === binding.contextNote
      && candidate.targetNote === binding.targetNote)
    if (!match || seen.has(match.objective)
      || !presentationOrder.includes(match.contextNote)
      || !presentationOrder.includes(match.targetNote)) return undefined
    seen.add(match.objective)
    bindings.push({ objective: match.objective, contextNote: match.contextNote, targetNote: match.targetNote })
  }
  return bindings
}

function normalizeCampaignReceipts(
  input: {
    villageCurriculum?: unknown
    villageClear?: unknown
    bellTowerClear?: unknown
    cathedralClear?: unknown
  },
  journey: PitchforksPresentationJourney,
  presentationOrder: readonly string[],
): Partial<Pick<PitchforksPresentationJourney,
  'villageCurriculum' | 'villageClear' | 'bellTowerClear' | 'cathedralClear'>> {
  const result: ReturnType<typeof normalizeCampaignReceipts> = {}
  for (const field of ['villageCurriculum', 'villageClear'] as const) {
    const value = input[field]
    const timestampKey = field === 'villageCurriculum' ? 'boundAt' : 'clearedAt'
    if (!isRecord(value) || value.version !== 1
      || !isTrimmedIdentifier(value.rangeAssessedAt) || value.rangeAssessedAt !== journey.rangeAssessedAt
      || !isTrimmedIdentifier(value.startedAt) || value.startedAt !== journey.startedAt) continue
    const timestamp = value[timestampKey]
    if (!isFiniteNonNegative(timestamp)) continue
    const bindings = normalizeVillageBindings(value.bindings, journey, presentationOrder)
    if (!bindings) continue
    const identity = { version: 1 as const, rangeAssessedAt: value.rangeAssessedAt, startedAt: value.startedAt, bindings }
    if (field === 'villageCurriculum') result.villageCurriculum = { ...identity, boundAt: timestamp }
    else result.villageClear = { ...identity, clearedAt: timestamp }
  }
  for (const field of ['bellTowerClear', 'cathedralClear'] as const) {
    const receipt = normalizePitchforksDungeonClear(input[field], journey, false)
    if (receipt) result[field] = receipt
  }
  return result
}

function normalizePitchforksVillagePractice(
  value: unknown,
  journey: Pick<PitchforksPresentationJourney, 'startedAt' | 'unlockedNotes' | 'guidedNotes'>,
  presentationOrder: readonly string[],
): VillagePracticeReceipt[] | undefined {
  if (!isDenseArray(value)) return undefined
  if (value.length === 0) return []

  const comfortableRange = comfortableRangeForPresentationOrder(presentationOrder)
  if (!comfortableRange) return undefined

  const assessedNotes = new Set(presentationOrder)
  const candidateEligibility = {
    admittedNotes: journey.unlockedNotes,
    introducedNotes: [...journey.guidedNotes, ...journey.unlockedNotes],
    comfortableRange,
  }
  let receipts: readonly VillagePracticeReceipt[] = []
  const seenKeys = new Set<string>()

  for (const candidate of value) {
    if (!isVillagePracticeReceipt(candidate)
      || candidate.journeyId !== journey.startedAt
      || !assessedNotes.has(candidate.contextNote)
      || !assessedNotes.has(candidate.targetNote)
    ) return undefined

    const key = villagePracticeKey(candidate)
    if (seenKeys.has(key)) return undefined
    seenKeys.add(key)

    const next = recordVillagePractice(receipts, {
      eventId: candidate.eventId,
      journeyId: candidate.journeyId,
      sessionId: candidate.sessionId,
      encounterIndex: candidate.encounterIndex,
      introducedEncounterIndex: candidate.introducedEncounterIndex,
      timestampMs: candidate.timestampMs,
      objective: candidate.objective,
      contextNote: candidate.contextNote,
      targetNote: candidate.targetNote,
      support: candidate.support,
      correct: true,
      normalVoice: true,
      demo: false,
      simulated: false,
      cueFree: candidate.cueFree,
      candidateEligibility,
    })
    if (next.length !== receipts.length + 1) return undefined
    receipts = next
  }

  return [...receipts]
}

export function parsePitchforksPresentationJourney(
  raw: string | null,
  rangeAssessedAt: string,
  presentationOrder: readonly string[],
): PitchforksPresentationJourney | null {
  if (!raw || presentationOrder.length < 2) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed)) return null
    if (parsed.version !== 1 || parsed.rangeAssessedAt !== rangeAssessedAt) return null
    if (typeof parsed.startedAt !== 'string' || !Number.isFinite(Date.parse(parsed.startedAt))) return null
    if (!isDenseStringArray(parsed.unlockedNotes) || parsed.unlockedNotes.length < 2) return null
    const unlockedNotes = parsed.unlockedNotes
    if (parsed.unlockedNotes.length > presentationOrder.length) return null
    if (parsed.unlockedNotes.some((note, index) => note !== presentationOrder[index])) return null
    if (!isDenseStringArray(parsed.guidedNotes)) return null
    if (new Set(parsed.guidedNotes).size !== parsed.guidedNotes.length) return null
    if (parsed.guidedNotes.some(note => !unlockedNotes.includes(note))) return null
    const currentLevel = parsed.currentLevel === undefined ? 1 : parsed.currentLevel
    if (!isValidPitchforksJourneyLevel(currentLevel)) return null
    const journey: PitchforksPresentationJourney = {
      version: 1,
      currentLevel,
      rangeAssessedAt,
      startedAt: parsed.startedAt,
      unlockedNotes: [...parsed.unlockedNotes],
      guidedNotes: [...parsed.guidedNotes],
    }
    const dungeonClear = normalizePitchforksDungeonClear(parsed.dungeonClear, journey)
    const withDungeonClear = {
      ...journey,
      ...normalizeCampaignReceipts(parsed, journey, presentationOrder),
      ...(dungeonClear ? { dungeonClear } : {}),
    }
    const villagePractice = normalizePitchforksVillagePractice(
      parsed.villagePractice,
      journey,
      presentationOrder,
    )
    return villagePractice === undefined
      ? withDungeonClear
      : { ...withDungeonClear, villagePractice }
  } catch {
    return null
  }
}

export function advancePitchforksJourneyLevel(
  journey: PitchforksPresentationJourney,
  completedLevel: number,
  passed: boolean,
): PitchforksPresentationJourney {
  if (passed !== true || completedLevel !== journey.currentLevel) return journey
  const nextLevel = journey.currentLevel + 1
  if (!isValidPitchforksJourneyLevel(nextLevel)) return journey
  return { ...journey, currentLevel: nextLevel }
}

/**
 * Tunable initial patient pacing, not a long-term mastery policy. Keep this
 * beginner runway deliberately free of the randomized 3/4-tine director.
 */
export const PATIENT_BEGINNER_LAST_WAVE = 12
export const PATIENT_ATTACK_TIME_FLOOR_SECONDS = 32

const PATIENT_WAVES: Readonly<Record<number, readonly TineCount[]>> = {
  1: [1, 1, 1, 1, 1, 1],
  2: [1, 1, 1, 1, 1, 1],
  3: [1, 1, 2, 2, 2],
  4: [1, 2, 1, 2, 2],
  5: [2, 1, 2, 1, 2],
  6: [1, 2, 2, 1, 2],
  7: [2, 1, 2, 2, 1],
  8: [1, 2, 1, 1, 2],
  9: [2, 2, 1, 2, 1],
  10: [1, 1, 2, 1, 2],
  11: [2, 1, 1, 2, 1],
  12: [1, 2, 2, 2, 1],
}

export function curriculumStageForWave(wave: number, demo: boolean): CurriculumStage {
  if (demo) return 'showcase'
  if (wave <= 1) return 'guided-pair'
  if (wave === 2) return 'recall-pair'
  if (wave <= PATIENT_BEGINNER_LAST_WAVE) return 'step-chain'
  return 'intervals'
}

export function patientTineCountsForWave(wave: number): readonly TineCount[] | null {
  return PATIENT_WAVES[wave] ?? null
}

export function cueSupportForNote(
  memory: CueMemory | undefined,
  evidence: CueSupportEvidence | undefined,
  firstEncounter: boolean,
  demo: boolean,
): CueSupportLevel {
  if (demo || firstEncounter) return 'guided'
  if (evidence?.needsGuidedRecovery) return 'guided'
  if ((evidence?.independentRecalls ?? 0) > 0 || (evidence?.guidedSuccesses ?? 0) >= 2) return 'recall'
  return memory?.phase === 'review' && memory.lastReview > 0 ? 'recall' : 'guided'
}

export function recordCueSupportOutcome(
  evidence: CueSupportEvidence | undefined,
  outcome: CueSupportOutcome,
): CueSupportEvidence {
  const current: CueSupportEvidence = evidence ?? { guidedSuccesses: 0, independentRecalls: 0, needsGuidedRecovery: false }
  if (outcome === 'recall-success') {
    return {
      guidedSuccesses: current.guidedSuccesses,
      independentRecalls: current.independentRecalls + 1,
      needsGuidedRecovery: false,
    }
  }
  if (outcome === 'guided-success') {
    return {
      ...current,
      guidedSuccesses: current.needsGuidedRecovery
        ? Math.max(2, current.guidedSuccesses)
        : Math.min(2, current.guidedSuccesses + 1),
      needsGuidedRecovery: false,
    }
  }
  return { ...current, needsGuidedRecovery: true }
}

export function parseCueSupportProfile(raw: string | null): CueSupportProfile {
  if (!raw) return { version: 1, notes: {} }
  try {
    const parsed = JSON.parse(raw) as { version?: unknown; notes?: unknown }
    if (parsed.version !== 1 || !parsed.notes || typeof parsed.notes !== 'object') {
      return { version: 1, notes: {} }
    }
    const notes: Record<string, CueSupportEvidence> = {}
    for (const [note, value] of Object.entries(parsed.notes)) {
      if (!value || typeof value !== 'object') continue
      const candidate = value as Partial<CueSupportEvidence>
      if (!Number.isInteger(candidate.guidedSuccesses) || (candidate.guidedSuccesses ?? -1) < 0) continue
      if (!Number.isInteger(candidate.independentRecalls) || (candidate.independentRecalls ?? -1) < 0) continue
      if (typeof candidate.needsGuidedRecovery !== 'boolean') continue
      notes[note] = {
        guidedSuccesses: Math.min(2, candidate.guidedSuccesses!),
        independentRecalls: candidate.independentRecalls!,
        needsGuidedRecovery: candidate.needsGuidedRecovery,
      }
    }
    return { version: 1, notes }
  } catch {
    return { version: 1, notes: {} }
  }
}

export function waitForClearBeforeSpawn(wave: number, demo: boolean): boolean {
  return demo || wave <= PATIENT_BEGINNER_LAST_WAVE
}

export function admissionAllowedForWave(wave: number, demo: boolean, debug: boolean): boolean {
  return demo || debug || wave >= 3
}

/**
 * A correct streak may open the admission ceremony, but it cannot prove that
 * the current arsenal is independently recallable. Normal voice progression
 * requires one unsupported recall for every unlocked note and fails closed
 * while any note still needs guided recovery.
 */
export function admissionRecallReady(
  unlockedNotes: readonly unknown[],
  profile: CueSupportProfile | null | undefined,
): boolean {
  if (!Array.isArray(unlockedNotes) || unlockedNotes.length === 0) return false
  if (!profile || profile.version !== 1 || !profile.notes || typeof profile.notes !== 'object') return false

  const notes = new Set<string>()
  for (const candidate of unlockedNotes) {
    if (typeof candidate !== 'string' || !/^[A-G]#?\d+$/.test(candidate) || notes.has(candidate)) return false
    notes.add(candidate)
  }

  for (const note of notes) {
    const evidence = profile.notes[note]
    if (
      !evidence ||
      !Number.isInteger(evidence.independentRecalls) ||
      evidence.independentRecalls < 1 ||
      evidence.needsGuidedRecovery !== false
    ) return false
  }
  return true
}

export function attackTimeForCurriculum(wave: number, encounterIndex: number): number {
  const base = wave <= 1
    ? 45
    : wave === 2
      ? 40
      : wave <= PATIENT_BEGINNER_LAST_WAVE
        ? PATIENT_ATTACK_TIME_FLOOR_SECONDS
        : 12
  const stagger = wave <= 3 ? 4 : 3
  return base + encounterIndex * stagger
}

export function villagerEntryX(
  stageWidth: number,
  spriteWidth: number,
  attackBarWidth = 58,
  safeInset = 18,
): number {
  const rightExtent = Math.max(spriteWidth, spriteWidth / 2 + attackBarWidth / 2)
  return Math.max(0, stageWidth - rightExtent - safeInset)
}

export function deterministicPairNotes(
  pool: readonly string[],
  wave: number,
  encounterIndex: number,
  totalTines: TineCount,
  demo: boolean,
): string[] | null {
  if (demo || wave > 3 || pool.length < 2) return null
  const pair = pool.slice(0, 2)
  const recallOffset = wave === 2 ? 1 : 0
  return Array.from({ length: totalTines }, (_, tineIndex) => (
    pair[(encounterIndex + recallOffset + tineIndex) % pair.length]
  ))
}

export function replayLabelForCueSupport(
  support: CueSupportLevel,
  noteCount: number,
  cuePlaying = false,
): string {
  if (support === 'recall' && cuePlaying) {
    return noteCount > 1 ? '🔊 HINT PLAYING · CHAIN' : '🔊 HINT PLAYING · NOTE'
  }
  if (support === 'recall') return noteCount > 1 ? '💡 HINT · HEAR CHAIN' : '💡 HINT · HEAR NOTE'
  return noteCount > 1 ? '🔊 REPLAY NOTES' : '🔊 REPLAY NOTE'
}

export function firstMinuteCoachCopy(beat: FirstMinuteBeat, note: string | null): string | null {
  if (beat === 'complete') return null
  if (beat === 'threat') return 'THE MOB IS COMING · YOUR VOICE WILL ARM THE LIGHTNING'
  if (beat === 'strike') return 'LIGHTNING RELEASED · WATCH THE FORK'
  if (beat === 'victory') return 'FIRST FORK STOPPED · THE DUNGEON EXHALES'
  const target = note ?? 'THE NOTE'
  if (beat === 'listen') return `LISTEN TO ${target} · THEN MATCH IT`
  if (beat === 'charge') return `HOLD ${target} · THE CLOUD IS CHARGING`
  return `SING ${target} · HUM TO ARM THE LIGHTNING`
}
