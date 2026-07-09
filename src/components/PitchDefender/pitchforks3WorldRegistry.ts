export type WorldId = 'dungeon' | 'village-gate' | 'bell-tower' | 'cathedral'

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

// unlocked() is a STUB PREDICATE — explicitly throwaway, wired to nothing real yet.
// Act II W1 (dual-track FSRS keystone) is the source of truth this must be rewired
// to once it lands (world-level mastery aggregation does not exist anywhere in the
// codebase today — verified: grep of src/lib/fsrs.ts has no world/level concept).
// DO NOT invent a mastery threshold here. DO NOT read/write a new localStorage key.
export function isWorldUnlocked(id: WorldId): boolean {
  return id === 'dungeon'
}

export const WORLD_REGISTRY: WorldDef[] = [
  { id: 'dungeon',      name: 'The Dungeon',      playable: true,  gateLabel: '' },
  { id: 'village-gate', name: 'The Village Gate',  playable: false, gateLabel: 'Curriculum-gated — unlocks as this world\'s notes are mastered' },
  { id: 'bell-tower',   name: 'The Bell Tower',    playable: false, gateLabel: 'Curriculum-gated — unlocks as this world\'s notes are mastered' },
  { id: 'cathedral',    name: 'The Cathedral',     playable: false, gateLabel: 'Curriculum-gated — unlocks as this world\'s notes are mastered' },
]
