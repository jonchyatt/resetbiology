// ─── masteryQueue — queue-based ordinal reinsertion scheduler ──────────────
//
// Core idea (per Jon's spec): item reappears after N *other items* pass, not
// after X minutes. Wrong/new/weak = shallow depth. Mastered = deep depth but
// never removed. Pool expansion gated by stable active-pool accuracy AND
// per-item mastery floor AND minimum total attempts.
//
// Generic over the item payload type. Currently used for single notes in
// NoteTutor, sequences in the same, and lines/transitions in LyricsTrainer.

import {
  MasteryItem, ItemKind, QueueConfig, ActivePool, DEFAULT_QUEUE_CONFIG,
} from './types'

export interface EngineState {
  items: Record<string, MasteryItem>  // id → item
  queue: string[]                      // upcoming ids; head = next to present
  config: QueueConfig
  totalAttempts: number
}

export function createItem(id: string, kind: ItemKind, payload: unknown): MasteryItem {
  return {
    id, kind, payload,
    attempts: 0, correct: 0, recent: [], mastery: 0,
  }
}

export function createEngine(config: Partial<QueueConfig> = {}): EngineState {
  return {
    items: {},
    queue: [],
    config: { ...DEFAULT_QUEUE_CONFIG, ...config },
    totalAttempts: 0,
  }
}

/** Score a result and update per-item stats. Returns the updated item. */
export function recordResult(
  engine: EngineState,
  id: string,
  correct: boolean,
): MasteryItem {
  const item = engine.items[id]
  if (!item) throw new Error(`masteryQueue: unknown item "${id}"`)
  const { masteryAlpha, recentWindow } = engine.config
  const prior = item.mastery
  item.attempts += 1
  if (correct) item.correct += 1
  item.recent.push(correct ? 1 : 0)
  if (item.recent.length > recentWindow) item.recent.shift()
  // EMA — successful-but-effortful recall bumps more than easy success.
  item.mastery = prior + masteryAlpha * ((correct ? 1 : 0) - prior)
  engine.totalAttempts += 1
  return item
}

/** Pick an insertion depth based on correctness + mastery. */
export function pickDepth(
  engine: EngineState,
  item: MasteryItem,
  correct: boolean,
): number {
  const { newItemThreshold, weaknessThreshold, midThreshold,
    shallowDepth, midDepth, deepDepth } = engine.config
  const isNew = item.attempts <= newItemThreshold
  const isWeak = item.mastery < weaknessThreshold
  let band: [number, number] = shallowDepth
  if (!correct || isNew || isWeak) band = shallowDepth
  else if (item.mastery < midThreshold) band = midDepth
  else band = deepDepth
  const [lo, hi] = band
  return lo + Math.floor(Math.random() * (hi - lo + 1))
}

/** Insert id back into the queue at the given ordinal depth. */
export function reinsert(engine: EngineState, id: string, depth: number) {
  const target = Math.min(depth, engine.queue.length)
  engine.queue.splice(target, 0, id)
}

/**
 * Pop the next item id to present. If queue is empty, refill it from the
 * given active pool using weighted-weakest selection. Excludes `avoidId`
 * when possible to avoid showing the same item back-to-back (ordinal spacing
 * implies something else runs in between).
 */
export function pickNext(
  engine: EngineState,
  activeIds: string[],
  avoidId: string | null,
): string | null {
  if (activeIds.length === 0) return null
  if (engine.queue.length === 0) refill(engine, activeIds)
  // Prefer first id that isn't avoidId. If only avoidId is available, fine.
  let idx = 0
  if (avoidId) {
    const found = engine.queue.findIndex(q => q !== avoidId && activeIds.includes(q))
    if (found >= 0) idx = found
  }
  const id = engine.queue.splice(idx, 1)[0]
  if (!activeIds.includes(id)) {
    // Item no longer active (e.g. pool shrank) — try again.
    return pickNext(engine, activeIds, avoidId)
  }
  return id
}

/** Seed queue with a weighted shuffle of active ids. Weaker items first. */
function refill(engine: EngineState, activeIds: string[]) {
  // Weight = (1 - mastery) + small bias for fewer attempts.
  const weighted = activeIds.map(id => {
    const it = engine.items[id]
    const m = it?.mastery ?? 0
    const attemptsBias = it ? Math.max(0, 1 - it.attempts / 20) : 1
    const weight = (1 - m) * 0.7 + attemptsBias * 0.3 + Math.random() * 0.05
    return { id, weight }
  })
  weighted.sort((a, b) => b.weight - a.weight)
  // Weakest come first (shallow depth) — that's the engine's whole point.
  engine.queue = weighted.map(w => w.id)
}

/** Whether the active pool is mastery-stable enough to expand. */
export function canExpandPool(
  engine: EngineState,
  pool: ActivePool<string>,
): boolean {
  if (pool.items.length === 0) return true
  if (pool.candidates.length === 0) return false
  const {
    poolStabilityAttempts, poolStabilityPerItem,
    poolAccuracyThreshold, perItemMasteryFloor, perItemMinAttempts,
  } = engine.config
  // Stability threshold scales with pool size so a 2-note max-separation pool
  // can't unlock on 12 easy hits, and a 6-note pool has to prove wider stability.
  const extra = Math.max(0, pool.items.length - 2)
  const requiredAttempts = poolStabilityAttempts + poolStabilityPerItem * extra
  if (pool.attemptsSinceExpansion < requiredAttempts) return false
  let total = 0, correct = 0
  for (const id of pool.items) {
    const it = engine.items[id]
    if (!it) return false
    if (it.attempts < perItemMinAttempts) return false
    if (it.mastery < perItemMasteryFloor) return false
    total += it.attempts
    correct += it.correct
  }
  if (total === 0) return false
  const acc = correct / total
  return acc >= poolAccuracyThreshold
}

/**
 * Pick the next id to add to the pool. Alternates strategies by cycle:
 *   even cycle → maximum distance from currently-weakest item (discrimination)
 *   odd cycle  → nearest neighbor to newest item (climb training)
 *
 * `distance` is caller-provided so this works for any ordered-ish payload.
 */
export function pickExpansionItem(
  engine: EngineState,
  pool: ActivePool<string>,
  distance: (a: string, b: string) => number,
): string | null {
  if (pool.candidates.length === 0) return null
  if (pool.items.length === 0) return pool.candidates[0]

  if (pool.expansionCycle % 2 === 0) {
    // Far from weakest
    let weakestId = pool.items[0]
    let weakestMastery = Infinity
    for (const id of pool.items) {
      const m = engine.items[id]?.mastery ?? 1
      if (m < weakestMastery) { weakestMastery = m; weakestId = id }
    }
    let best = pool.candidates[0]
    let bestDist = -Infinity
    for (const c of pool.candidates) {
      const d = distance(c, weakestId)
      if (d > bestDist) { bestDist = d; best = c }
    }
    return best
  } else {
    // Neighbor of newest
    const newest = pool.items[pool.items.length - 1]
    let best = pool.candidates[0]
    let bestDist = Infinity
    for (const c of pool.candidates) {
      const d = distance(c, newest)
      if (d > 0 && d < bestDist) { bestDist = d; best = c }
    }
    return best
  }
}

/** Expand pool with one item. Mutates pool. */
export function expandPool(
  engine: EngineState,
  pool: ActivePool<string>,
  kind: ItemKind,
  payloadFor: (id: string) => unknown,
  distance: (a: string, b: string) => number,
): string | null {
  const addId = pickExpansionItem(engine, pool, distance)
  if (!addId) return null
  pool.items.push(addId)
  pool.candidates = pool.candidates.filter(c => c !== addId)
  pool.attemptsSinceExpansion = 0
  pool.expansionCycle += 1
  if (!engine.items[addId]) {
    engine.items[addId] = createItem(addId, kind, payloadFor(addId))
  }
  return addId
}

// ─── Serialization ─────────────────────────────────────────────────────────
// Queue + active pool live in localStorage. Keeps sessions across tabs/reloads.

export interface PersistedState {
  engine: EngineState
  pool: ActivePool<string>
}

export function loadState(
  key: string,
  defaults: () => PersistedState,
): PersistedState {
  if (typeof window === 'undefined') return defaults()
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return defaults()
    const parsed = JSON.parse(raw) as PersistedState
    // Merge config defaults for forward-compat when we tune knobs later.
    parsed.engine.config = { ...DEFAULT_QUEUE_CONFIG, ...parsed.engine.config }
    return parsed
  } catch {
    return defaults()
  }
}

export function saveState(key: string, state: PersistedState) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(state))
  } catch { /* quota or private mode — silently drop */ }
}
