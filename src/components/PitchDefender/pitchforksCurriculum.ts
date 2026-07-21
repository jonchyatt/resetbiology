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

type CueMemory = Readonly<{
  phase: 'new' | 'learning' | 'review'
  lastReview: number
}>

export const EMPTY_CUE_SUPPORT_PROFILE: CueSupportProfile = { version: 1, notes: {} }

const PATIENT_WAVES: Readonly<Record<number, readonly TineCount[]>> = {
  1: [1, 1, 1, 1, 1, 1],
  2: [1, 1, 1, 1, 1, 1],
  3: [1, 1, 2, 2, 2],
  4: [2, 2, 2, 2, 3],
  5: [2, 2, 3, 3, 3],
}

export function curriculumStageForWave(wave: number, demo: boolean): CurriculumStage {
  if (demo) return 'showcase'
  if (wave <= 1) return 'guided-pair'
  if (wave === 2) return 'recall-pair'
  if (wave === 3) return 'step-chain'
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
  return demo || wave <= 3
}

export function admissionAllowedForWave(wave: number, demo: boolean, debug: boolean): boolean {
  return demo || debug || wave >= 3
}

export function attackTimeForCurriculum(wave: number, encounterIndex: number): number {
  const base = wave <= 1 ? 45 : wave === 2 ? 40 : wave === 3 ? 32 : wave === 4 ? 24 : wave === 5 ? 18 : 12
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
