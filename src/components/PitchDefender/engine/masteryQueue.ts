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

/** Default queue id. NoteTutor uses 'notes' and 'sequences' for its two pools. */
export const DEFAULT_QUEUE = 'main'

export interface EngineState {
  items: Record<string, MasteryItem>  // id → item
  queues: Record<string, string[]>    // queue id → upcoming item ids; head = next to present
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
    queues: { [DEFAULT_QUEUE]: [] },
    config: { ...DEFAULT_QUEUE_CONFIG, ...config },
    totalAttempts: 0,
  }
}

function getQueue(engine: EngineState, queueName: string): string[] {
  if (!engine.queues[queueName]) engine.queues[queueName] = []
  return engine.queues[queueName]
}

/**
 * Reconcile a queue with its pool. Purges stale entries (items in the queue
 * that are no longer in the pool — typical after an octave shift) and
 * injects missing entries (items in the pool that aren't in the queue —
 * typical from legacy state saved before the expandPool queue-injection
 * fix landed). Run on load and on octave change.
 *
 * Without this, a pool can grow but the queue stays stale at 1-2 items.
 * Because `reinsert` caps depth at queue.length, a single-item queue stays
 * single-item forever and `refill` never runs — the same note cycles
 * indefinitely. Jon observed this as "only plays middle C over and over."
 */
export function syncQueueWithPool(
  engine: EngineState, queueName: string, poolItems: string[],
): void {
  const q = getQueue(engine, queueName)
  const poolSet = new Set(poolItems)
  // Purge stale
  const filtered = q.filter(id => poolSet.has(id))
  engine.queues[queueName] = filtered
  // Inject missing at shallow depth
  const have = new Set(filtered)
  for (const id of poolItems) {
    if (have.has(id)) continue
    const depth = 1 + Math.floor(Math.random() * 3)  // [1,3]
    reinsert(engine, id, depth, queueName)
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

/** Insert id back into the given queue at the chosen ordinal depth. */
export function reinsert(
  engine: EngineState, id: string, depth: number, queueName: string = DEFAULT_QUEUE,
) {
  const q = getQueue(engine, queueName)
  const target = Math.min(depth, q.length)
  q.splice(target, 0, id)
}

/**
 * Pop the next item id to present. If the queue is empty, refill it from
 * the given active pool using weighted-weakest selection. Excludes `avoidId`
 * when possible so the same item doesn't appear back-to-back (ordinal
 * spacing implies something else runs in between). Callers can maintain
 * separate queues per pool via `queueName` — e.g. notes vs. sequences.
 */
export function pickNext(
  engine: EngineState,
  activeIds: string[],
  avoidId: string | null,
  queueName: string = DEFAULT_QUEUE,
): string | null {
  if (activeIds.length === 0) return null
  const q = getQueue(engine, queueName)
  if (q.length === 0) refill(engine, activeIds, queueName)
  let idx = 0
  if (avoidId) {
    const found = q.findIndex(qId => qId !== avoidId && activeIds.includes(qId))
    if (found >= 0) idx = found
  }
  const id = q.splice(idx, 1)[0]
  if (!activeIds.includes(id)) {
    // Item no longer active (e.g. pool shrank) — try again.
    return pickNext(engine, activeIds, avoidId, queueName)
  }
  return id
}

/** Seed a named queue with a weighted shuffle of active ids. Weaker first. */
function refill(engine: EngineState, activeIds: string[], queueName: string = DEFAULT_QUEUE) {
  const weighted = activeIds.map(id => {
    const it = engine.items[id]
    const m = it?.mastery ?? 0
    const attemptsBias = it ? Math.max(0, 1 - it.attempts / 20) : 1
    const weight = (1 - m) * 0.7 + attemptsBias * 0.3 + Math.random() * 0.05
    return { id, weight }
  })
  weighted.sort((a, b) => b.weight - a.weight)
  engine.queues[queueName] = weighted.map(w => w.id)
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

/**
 * Expand pool with one item. Mutates pool AND injects the new item into the
 * queue at a shallow depth.
 *
 * Critical: without the queue injection, pool expansion is silent as far as
 * round scheduling is concerned. The queue never empties (reinsert keeps
 * recycling existing items), so refill never fires, and the new item never
 * gets presented. Jon observed this as "C4/D5 alternated 33+ times after C5
 * was added." This is the Leitner contract — new items enter with
 * high-frequency / shallow depth — made literal in the queue.
 */
export function expandPool(
  engine: EngineState,
  pool: ActivePool<string>,
  kind: ItemKind,
  payloadFor: (id: string) => unknown,
  distance: (a: string, b: string) => number,
  queueName: string = DEFAULT_QUEUE,
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
  // Seed the new item into the queue within the shallow band so it appears
  // in the next 1-3 rounds rather than hiding behind whatever reinsert order
  // the existing items were stuck in.
  const [lo, hi] = engine.config.shallowDepth
  const depth = lo + Math.floor(Math.random() * (hi - lo + 1))
  reinsert(engine, addId, depth, queueName)
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
    const parsed = JSON.parse(raw) as PersistedState & { engine: { queue?: string[] } }
    // Merge config defaults for forward-compat when we tune knobs later.
    parsed.engine.config = { ...DEFAULT_QUEUE_CONFIG, ...parsed.engine.config }
    // Back-compat: early persisted state used `engine.queue: string[]`.
    // Migrate to the named-queues shape so existing learners don't lose state.
    const eng = parsed.engine as EngineState & { queue?: string[] }
    if (!eng.queues) {
      eng.queues = { [DEFAULT_QUEUE]: Array.isArray(eng.queue) ? eng.queue : [] }
      delete eng.queue
    }
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
