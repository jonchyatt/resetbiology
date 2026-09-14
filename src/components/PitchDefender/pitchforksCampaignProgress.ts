import type { NoteMemory } from '../../lib/fsrs'
import {
  createPitchforksPresentationJourney,
  parsePitchforksPresentationJourney,
  type PitchforksPresentationJourney,
} from './pitchforksCurriculum'
import {
  projectPitchforksMastery,
  type PitchforksMasteryRecord,
} from './pitchforksMasteryProjection'
import { getVillageLessonCandidates } from './villageLessonSelector'
import { projectVillageClearEligibility } from './villageClearEligibility'
import { isBossAvailable, type WorldGateInput, type WorldId } from './pitchforks3WorldRegistry'

export type PitchforksCampaignProgressInput = Readonly<{
  journey: PitchforksPresentationJourney
  rangeAssessedAt: string
  startedAt: string
  demo: boolean
  simulated: boolean
  voiceMemory?: Readonly<Record<string, NoteMemory>>
  masteryRecords?: Readonly<Record<string, PitchforksMasteryRecord>>
  nowMs: number
}>

export type PitchforksCampaignProgressReason =
  | 'dungeon-cleared'
  | 'already-cleared'
  | 'not-world-clear'
  | 'demo'
  | 'simulated'
  | 'invalid-time'
  | 'identity-mismatch'
  | 'invalid-unlocked-notes'
  | 'invalid-journey'
  | 'village-cleared'
  | 'bell-tower-cleared'
  | 'cathedral-cleared'
  | 'not-normal-voice'
  | 'missing-dungeon-clear'
  | 'missing-village-curriculum'
  | 'not-village-clear'
  | 'world-unavailable'
  | 'examination-not-passed'
  | 'invalid-admitted-notes'

export type PitchforksCampaignProgressResult = Readonly<{
  journey: PitchforksPresentationJourney
  changed: boolean
  reason: PitchforksCampaignProgressReason
}>

function unchanged(
  journey: PitchforksPresentationJourney,
  reason: Exclude<PitchforksCampaignProgressReason, 'dungeon-cleared'>,
): PitchforksCampaignProgressResult {
  return { journey, changed: false, reason }
}

function hasDenseUniqueUnlockedNotes(value: unknown): value is string[] {
  if (!Array.isArray(value) || value.length < 2) return false

  const seen = new Set<string>()
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) return false
    const note = value[index]
    if (typeof note !== 'string' || note.length === 0 || seen.has(note)) return false
    seen.add(note)
  }
  return true
}

/**
 * Record the first earned Dungeon entitlement in the existing journey.
 * This is a pure read/transform boundary: the caller owns persistence and
 * must pass a changed journey through the existing confirmed save path.
 */
export function advancePitchforksCampaignProgress(
  input: PitchforksCampaignProgressInput,
): PitchforksCampaignProgressResult {
  const journey = input?.journey
  if (!journey) return unchanged(journey, 'invalid-journey')
  if (input.demo !== false) return unchanged(journey, 'demo')
  if (input.simulated !== false) return unchanged(journey, 'simulated')
  if (typeof input.nowMs !== 'number' || !Number.isFinite(input.nowMs) || input.nowMs < 0) {
    return unchanged(journey, 'invalid-time')
  }
  if (
    typeof input.rangeAssessedAt !== 'string' ||
    typeof input.startedAt !== 'string' ||
    journey.rangeAssessedAt !== input.rangeAssessedAt ||
    journey.startedAt !== input.startedAt
  ) {
    return unchanged(journey, 'identity-mismatch')
  }
  if (!hasDenseUniqueUnlockedNotes(journey.unlockedNotes)) {
    return unchanged(journey, 'invalid-unlocked-notes')
  }

  // Let the existing journey parser validate and clone any optional receipt;
  // this transition does not maintain a second receipt validator.
  let parsedJourney: PitchforksPresentationJourney | null
  try {
    parsedJourney = parsePitchforksPresentationJourney(
      JSON.stringify(journey),
      input.rangeAssessedAt,
      journey.unlockedNotes,
    )
  } catch {
    parsedJourney = null
  }
  if (!parsedJourney) return unchanged(journey, 'invalid-journey')

  if (parsedJourney.dungeonClear) return unchanged(journey, 'already-cleared')

  const projection = projectPitchforksMastery({
    admittedNotes: parsedJourney.unlockedNotes,
    voiceMemory: input.voiceMemory,
    masteryRecords: input.masteryRecords,
    nowMs: input.nowMs,
  })
  if (!projection.worldClear) return unchanged(journey, 'not-world-clear')

  const nextJourney = createPitchforksPresentationJourney({
    ...parsedJourney,
    rangeAssessedAt: parsedJourney.rangeAssessedAt,
    startedAt: parsedJourney.startedAt,
    unlockedNotes: parsedJourney.unlockedNotes,
    guidedNotes: parsedJourney.guidedNotes,
    dungeonClear: {
      version: 1,
      rangeAssessedAt: parsedJourney.rangeAssessedAt,
      startedAt: parsedJourney.startedAt,
      admittedNotes: [...parsedJourney.unlockedNotes],
      clearedAt: input.nowMs,
    },
  })

  return {
    journey: { ...journey, ...nextJourney, currentLevel: parsedJourney.currentLevel },
    changed: true,
    reason: 'dungeon-cleared',
  }
}

type ComfortableRange = Readonly<{ lowNote: string; highNote: string }>

export type PitchforksVillageProgressInput = PitchforksCampaignProgressInput & Readonly<{
  comfortableRange: ComfortableRange
  normalVoice: boolean
}>

export type PitchforksExaminationProgressInput = PitchforksCampaignProgressInput & Readonly<{
  world: 'bell-tower' | 'cathedral'
  normalVoice: boolean
  passed: boolean
  admittedNotes: readonly string[]
}>

function parseJourney(journey: PitchforksPresentationJourney): PitchforksPresentationJourney | null {
  if (!journey || !hasDenseUniqueUnlockedNotes(journey.unlockedNotes)) return null
  try {
    return parsePitchforksPresentationJourney(JSON.stringify(journey), journey.rangeAssessedAt, journey.unlockedNotes)
  } catch {
    return null
  }
}

/** Freeze the first canonical admitted pair; expansion only appends missing objectives. */
export function bindPitchforksVillageCurriculum(
  journey: PitchforksPresentationJourney,
  comfortableRange: ComfortableRange,
  nowMs: number,
): PitchforksPresentationJourney {
  if (!Number.isFinite(nowMs) || nowMs < 0) return journey
  const parsed = parseJourney(journey)
  if (!parsed) return journey
  // Never silently replace a supplied, invalid curriculum with different bindings.
  if (journey.villageCurriculum && !parsed.villageCurriculum) return journey
  const bindings = [...(parsed.villageCurriculum?.bindings ?? [])]
  const objectives = new Set(bindings.map(binding => binding.objective))
  for (const candidate of getVillageLessonCandidates({
    admittedNotes: parsed.unlockedNotes,
    introducedNotes: parsed.unlockedNotes,
    comfortableRange,
  })) {
    if (!candidate.bothVoiceAdmitted || objectives.has(candidate.objective)) continue
    const { objective, contextNote, targetNote } = candidate
    bindings.push({ objective, contextNote, targetNote })
    objectives.add(objective)
  }
  if (bindings.length === (parsed.villageCurriculum?.bindings.length ?? 0)) return journey
  return {
    ...journey,
    villageCurriculum: {
      version: 1, rangeAssessedAt: parsed.rangeAssessedAt, startedAt: parsed.startedAt,
      bindings, boundAt: parsed.villageCurriculum?.boundAt ?? nowMs,
    },
  }
}

/** Preserve gaps in the projection so the registry rejects the entire forged prefix. */
export function projectPitchforksWorldGates(journey: PitchforksPresentationJourney): WorldGateInput {
  const parsed = parseJourney(journey)
  if (!parsed) return { bossClears: [] }
  const bossClears: WorldId[] = []
  if (parsed.dungeonClear) bossClears.push('dungeon')
  if (parsed.villageClear) bossClears.push('village-gate')
  if (parsed.bellTowerClear) bossClears.push('bell-tower')
  if (parsed.cathedralClear) bossClears.push('cathedral')
  return { bossClears }
}

function validateConnectedInput(
  input: PitchforksCampaignProgressInput & { normalVoice: boolean },
): PitchforksPresentationJourney | PitchforksCampaignProgressReason {
  if (!input?.journey) return 'invalid-journey'
  if (input.demo !== false) return 'demo'
  if (input.simulated !== false) return 'simulated'
  if (input.normalVoice !== true) return 'not-normal-voice'
  if (!Number.isFinite(input.nowMs) || input.nowMs < 0) return 'invalid-time'
  if (input.rangeAssessedAt !== input.journey.rangeAssessedAt
    || input.startedAt !== input.journey.startedAt) return 'identity-mismatch'
  if (!hasDenseUniqueUnlockedNotes(input.journey.unlockedNotes)) return 'invalid-unlocked-notes'
  return parseJourney(input.journey) ?? 'invalid-journey'
}

export function advancePitchforksVillageProgress(
  input: PitchforksVillageProgressInput,
): PitchforksCampaignProgressResult {
  const parsed = validateConnectedInput(input)
  if (typeof parsed === 'string') return { journey: input?.journey, changed: false, reason: parsed }
  if (parsed.villageClear) return unchanged(input.journey, 'already-cleared')
  if (!parsed.dungeonClear) return unchanged(input.journey, 'missing-dungeon-clear')
  if (!parsed.villageCurriculum) return unchanged(input.journey, 'missing-village-curriculum')
  const eligibility = projectVillageClearEligibility({
    ...input,
    voiceMemory: input.voiceMemory,
    masteryRecords: input.masteryRecords,
    journeyId: parsed.startedAt,
    bindings: parsed.villageCurriculum.bindings,
    admittedNotes: parsed.unlockedNotes,
    practiceReceipts: parsed.villagePractice ?? [],
  })
  if (!eligibility.eligible) return unchanged(input.journey, 'not-village-clear')
  const { boundAt: _boundAt, ...curriculum } = parsed.villageCurriculum
  const next = createPitchforksPresentationJourney({
    ...parsed, villageClear: { ...curriculum, clearedAt: input.nowMs },
  })
  return {
    journey: { ...input.journey, ...next, currentLevel: parsed.currentLevel },
    changed: true, reason: 'village-cleared',
  }
}

export function advancePitchforksExaminationProgress(
  input: PitchforksExaminationProgressInput,
): PitchforksCampaignProgressResult {
  const parsed = validateConnectedInput(input)
  if (typeof parsed === 'string') return { journey: input?.journey, changed: false, reason: parsed }
  if (input.world !== 'bell-tower' && input.world !== 'cathedral') {
    return unchanged(input.journey, 'world-unavailable')
  }
  const field = input.world === 'bell-tower' ? 'bellTowerClear' : 'cathedralClear'
  if (parsed[field]) return unchanged(input.journey, 'already-cleared')
  // Match the parent's recital: frozen Village endpoints for Bell Tower,
  // full admitted arsenal for Cathedral (its return leg adds no new notes).
  const expectedNotes = input.world === 'bell-tower'
    ? [...new Set(parsed.villageClear?.bindings.flatMap(binding => [binding.contextNote, binding.targetNote]) ?? [])]
    : parsed.unlockedNotes
  if (!hasDenseUniqueUnlockedNotes(input.admittedNotes)
    || input.admittedNotes.length !== expectedNotes.length
    || !input.admittedNotes.every((note, index) => note === expectedNotes[index])) {
    return unchanged(input.journey, 'invalid-admitted-notes')
  }
  const projection = projectPitchforksMastery({ ...input, admittedNotes: input.admittedNotes })
  if (!isBossAvailable(input.world, projection, projectPitchforksWorldGates(parsed))) {
    return unchanged(input.journey, 'world-unavailable')
  }
  if (input.passed !== true) return unchanged(input.journey, 'examination-not-passed')
  const next = createPitchforksPresentationJourney({
    ...parsed,
    [field]: {
      version: 1, rangeAssessedAt: parsed.rangeAssessedAt, startedAt: parsed.startedAt,
      admittedNotes: [...input.admittedNotes], clearedAt: input.nowMs,
    },
  })
  return {
    journey: { ...input.journey, ...next, currentLevel: parsed.currentLevel },
    changed: true, reason: input.world === 'bell-tower' ? 'bell-tower-cleared' : 'cathedral-cleared',
  }
}
