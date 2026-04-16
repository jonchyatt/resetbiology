// ─── NoteTutor / LyricsTrainer shared engine types ─────────────────────────
//
// Queue-based ordinal spacing. NOT time-based. Scheduling depends on queue
// position + item mastery + pool stability. See masteryQueue.ts for the
// scheduler, backwardChain.ts for the monologue variant.

export type ItemKind = 'note' | 'sequence' | 'line' | 'transition'

export interface MasteryItem {
  id: string
  kind: ItemKind
  payload: unknown        // e.g. 'C4', ['C4','G4'], "To be or not to be"
  attempts: number
  correct: number
  recent: number[]        // last N results, 0 = wrong, 1 = right
  mastery: number         // EMA 0-1
}

export interface QueueConfig {
  masteryAlpha: number         // EMA weight for new result, e.g. 0.25
  recentWindow: number         // rolling window for rollingAcc, e.g. 10
  newItemThreshold: number     // attempts below this = "new", short depth
  weaknessThreshold: number    // mastery below this = weak, short depth
  midThreshold: number         // mastery below this = mid, medium depth
  // Reinsertion depths as [min, max] inclusive. Picked uniformly.
  shallowDepth: [number, number]   // new or wrong or weak
  midDepth: [number, number]       // medium mastery
  deepDepth: [number, number]      // strong, mastered
  // Pool expansion gate
  poolStabilityAttempts: number    // attempts across pool before adding
  poolAccuracyThreshold: number    // required active-pool accuracy
  perItemMasteryFloor: number      // every item must be at/above this
}

export const DEFAULT_QUEUE_CONFIG: QueueConfig = {
  masteryAlpha: 0.25,
  recentWindow: 10,
  newItemThreshold: 3,
  weaknessThreshold: 0.55,
  midThreshold: 0.8,
  shallowDepth: [1, 3],
  midDepth: [4, 7],
  deepDepth: [8, 14],
  poolStabilityAttempts: 12,
  poolAccuracyThreshold: 0.85,
  perItemMasteryFloor: 0.7,
}

export interface ActivePool<T = string> {
  items: T[]                  // e.g. ['C4', 'D5']
  candidates: T[]             // everything we could add next
  attemptsSinceExpansion: number
  createdAt: number
  // Additions alternate strategies (far-from-weak vs neighbor-of-newest)
  expansionCycle: number
}
