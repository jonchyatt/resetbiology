export type TineCount = 1 | 2 | 3 | 4
export type CurriculumStage = 'showcase' | 'guided-pair' | 'recall-pair' | 'step-chain' | 'intervals'

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

export function automaticCueForWave(wave: number, demo: boolean): boolean {
  return demo || curriculumStageForWave(wave, false) === 'guided-pair'
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

export function replayLabelForStage(stage: CurriculumStage): string {
  if (stage === 'recall-pair') return '💡 HINT · HEAR NOTE'
  if (stage === 'step-chain') return '💡 HINT · HEAR CHAIN'
  return '🔊 REPLAY NOTES'
}
