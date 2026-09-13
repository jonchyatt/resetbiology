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
    journey: { ...nextJourney, currentLevel: parsedJourney.currentLevel },
    changed: true,
    reason: 'dungeon-cleared',
  }
}
