import type { PitchforksMasteryProjection } from './pitchforksMasteryProjection'

export type WorldId = 'dungeon' | 'village-gate' | 'bell-tower' | 'cathedral'

export type WorldGateInput = Readonly<{
  bossClears: readonly WorldId[]
}>

export interface WorldDef {
  id: WorldId
  name: string           // "The Dungeon" etc.
  // NOTE (CW cw-consult-59): playable and isWorldUnlocked() encode the same truth for
  // 'dungeon' TODAY but are two different axes — playable = "content is built",
  // unlocked = "curriculum gate passed". They coincide now; Act II can diverge them
  // (a world mastery-unlocked but not yet content-built). Keep both, don't collapse.
  playable: boolean      // true ONLY for 'dungeon' today
  gateLabel: string       // generic copy, no invented thresholds, e.g. "Curriculum-gated — unlocks as this world's notes are mastered"
}

const WORLD_ORDER: readonly WorldId[] = [
  'dungeon',
  'village-gate',
  'bell-tower',
  'cathedral',
]

const EMPTY_WORLD_GATE_INPUT: WorldGateInput = { bossClears: [] }

type ValidatedBossClears = Readonly<{
  clears: readonly WorldId[]
  valid: boolean
}>

/**
 * Read a journey snapshot without allowing malformed history to skip a boss.
 * Invalid data is equivalent to no clears for the purpose of world unlocks.
 */
function readBossClears(input: unknown): ValidatedBossClears {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { clears: [], valid: false }
  }

  const candidate = (input as { bossClears?: unknown }).bossClears
  if (!Array.isArray(candidate) || candidate.length > WORLD_ORDER.length) {
    return { clears: [], valid: false }
  }

  for (let index = 0; index < candidate.length; index += 1) {
    // Checking own properties rejects sparse arrays rather than letting a hole
    // masquerade as a valid prefix through inherited values.
    if (!Object.prototype.hasOwnProperty.call(candidate, index)
      || candidate[index] !== WORLD_ORDER[index]) {
      return { clears: [], valid: false }
    }
  }

  return { clears: candidate as WorldId[], valid: true }
}

function worldIndex(id: unknown): number {
  return typeof id === 'string' ? WORLD_ORDER.indexOf(id as WorldId) : -1
}

// This is a pure candidate policy. The normal renderer still calls the
// backwards-compatible one-argument form until the journey policy is approved
// and wired to its caller-provided save snapshot.
export function isWorldUnlocked(
  id: WorldId,
  input: WorldGateInput = EMPTY_WORLD_GATE_INPUT,
): boolean {
  const index = worldIndex(id)
  if (index < 0) return false
  if (index === 0) return true

  const { clears } = readBossClears(input)
  return clears.length >= index
}

/**
 * A boss is available only for the first world not yet cleared and only after
 * the existing mastery projection has produced a true world-clear receipt.
 */
export function isBossAvailable(
  id: WorldId,
  projection: PitchforksMasteryProjection,
  input: WorldGateInput = EMPTY_WORLD_GATE_INPUT,
): boolean {
  const index = worldIndex(id)
  if (index < 0 || projection?.worldClear !== true) return false

  const { clears, valid } = readBossClears(input)
  return valid && WORLD_ORDER[clears.length] === id
}

export const WORLD_REGISTRY: WorldDef[] = [
  { id: 'dungeon',      name: 'The Dungeon',      playable: true,  gateLabel: '' },
  { id: 'village-gate', name: 'The Village Gate',  playable: false, gateLabel: 'Curriculum-gated — unlocks as this world\'s notes are mastered' },
  { id: 'bell-tower',   name: 'The Bell Tower',    playable: false, gateLabel: 'Curriculum-gated — unlocks as this world\'s notes are mastered' },
  { id: 'cathedral',    name: 'The Cathedral',     playable: false, gateLabel: 'Curriculum-gated — unlocks as this world\'s notes are mastered' },
]
