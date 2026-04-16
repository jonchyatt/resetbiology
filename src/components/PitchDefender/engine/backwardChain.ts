// ─── backwardChain — monologue memorization engine ─────────────────────────
//
// Jon's method: start at the last line, prepend one earlier line per
// advancement. Working window caps at 5-7 lines. Periodic 8-13 line medium
// reviews + occasional full-tail runs verify integration before advancing.
// Scoring is per-line AND per-transition — transitions are where breakdown
// lives.

import {
  EngineState, MasteryItem, createEngine, createItem, recordResult,
  pickDepth, reinsert,
} from './masteryQueue'

export type ReviewSpanType = 'working' | 'medium' | 'full'

export interface ReviewSpan {
  type: ReviewSpanType
  startIdx: number
  endIdx: number      // inclusive
}

export interface MonologueState {
  lines: string[]
  currentStart: number
  windowMax: number            // 5-7 typical
  mediumSize: [number, number] // medium span size range, e.g. [8, 13]
  workingCycleTarget: number   // rounds before scheduling a medium review
  mediumCycleTarget: number    // mediums before scheduling a full tail
  workingCycle: number
  mediumCycle: number
  lastWorkingPassed: boolean
  lastMediumPassed: boolean
  lastFullPassed: boolean
  engine: EngineState
}

export function createMonologueState(
  lines: string[],
  opts: Partial<Pick<MonologueState,
    'windowMax' | 'mediumSize' | 'workingCycleTarget' | 'mediumCycleTarget'>> = {},
): MonologueState {
  const state: MonologueState = {
    lines,
    currentStart: lines.length - 1,
    windowMax: opts.windowMax ?? 6,
    mediumSize: opts.mediumSize ?? [8, 13],
    workingCycleTarget: opts.workingCycleTarget ?? 4,
    mediumCycleTarget: opts.mediumCycleTarget ?? 3,
    workingCycle: 0,
    mediumCycle: 0,
    lastWorkingPassed: false,
    lastMediumPassed: true,  // no medium yet = don't block advancement
    lastFullPassed: true,
    engine: createEngine({
      masteryAlpha: 0.3,
      recentWindow: 6,
      poolStabilityAttempts: 6,
      poolAccuracyThreshold: 0.85,
      perItemMasteryFloor: 0.7,
    }),
  }
  // Seed line items and transition items for the last line only — we grow
  // backward as the learner advances.
  for (let i = lines.length - 1; i >= state.currentStart; i--) {
    state.engine.items[lineId(i)] = createItem(lineId(i), 'line', { lineIdx: i })
    if (i < lines.length - 1) {
      state.engine.items[transId(i)] = createItem(
        transId(i), 'transition', { fromIdx: i, toIdx: i + 1 },
      )
    }
  }
  return state
}

export function lineId(i: number) { return `L:${i}` }
export function transId(i: number) { return `T:${i}` }

export function knownRange(state: MonologueState): [number, number] {
  return [state.currentStart, state.lines.length - 1]
}

export function workingSpan(state: MonologueState): ReviewSpan {
  const [start, end] = knownRange(state)
  return {
    type: 'working',
    startIdx: start,
    endIdx: Math.min(end, start + state.windowMax - 1),
  }
}

export function mediumSpan(state: MonologueState): ReviewSpan {
  const [start, end] = knownRange(state)
  const [lo, hi] = state.mediumSize
  const size = lo + Math.floor(Math.random() * (hi - lo + 1))
  const endIdx = Math.min(end, start + size - 1)
  return { type: 'medium', startIdx: start, endIdx }
}

export function fullSpan(state: MonologueState): ReviewSpan {
  const [start, end] = knownRange(state)
  return { type: 'full', startIdx: start, endIdx: end }
}

/** Pick which review type to run next based on cycle counters. */
export function pickNextSpan(state: MonologueState): ReviewSpan {
  const [start, end] = knownRange(state)
  const knownLines = end - start + 1
  // Can't do meaningful medium/full if we don't know enough lines yet.
  if (knownLines < state.mediumSize[0]) return workingSpan(state)
  if (state.mediumCycle >= state.mediumCycleTarget) return fullSpan(state)
  if (state.workingCycle >= state.workingCycleTarget) return mediumSpan(state)
  return workingSpan(state)
}

/** Normalize text for fuzzy line match: lowercase, strip punctuation, collapse ws. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Token-overlap similarity in [0,1]. Order-sensitive via LCS. */
export function lineSimilarity(expected: string, got: string): number {
  const a = normalize(expected).split(' ').filter(Boolean)
  const b = normalize(got).split(' ').filter(Boolean)
  if (a.length === 0) return b.length === 0 ? 1 : 0
  // Longest common subsequence length
  const dp = Array(a.length + 1).fill(0).map(() => Array(b.length + 1).fill(0))
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }
  const lcs = dp[a.length][b.length]
  return lcs / a.length
}

/** Per-line threshold — "verbatim enough" */
export const LINE_PASS_THRESHOLD = 0.82

/**
 * Grade a span attempt against the user's spoken transcript. The transcript
 * spans the whole recitation; we segment it by finding best-match offsets.
 * Returns per-line + per-transition pass/fail. Mutates engine mastery.
 */
export function gradeSpan(
  state: MonologueState,
  span: ReviewSpan,
  transcript: string,
): {
  lineResults: { idx: number; score: number; passed: boolean }[]
  transitionResults: { fromIdx: number; passed: boolean }[]
  spanPassed: boolean
} {
  const { lines } = state
  const tokens = normalize(transcript).split(' ').filter(Boolean)
  // Greedy segmentation: for each expected line, find the window of tokens
  // in `tokens` that maximizes similarity, consuming left-to-right.
  let cursor = 0
  const lineResults: { idx: number; score: number; passed: boolean }[] = []
  for (let i = span.startIdx; i <= span.endIdx; i++) {
    const expected = lines[i]
    const expTokenCount = normalize(expected).split(' ').filter(Boolean).length
    // Scan candidate windows of +/- 50% around expected length.
    let bestScore = 0
    let bestEnd = cursor
    const searchFrom = cursor
    const searchTo = Math.min(tokens.length, cursor + Math.ceil(expTokenCount * 2.5))
    for (let winLen = Math.max(1, Math.floor(expTokenCount * 0.5));
             winLen <= Math.max(1, Math.ceil(expTokenCount * 1.5)); winLen++) {
      for (let s = searchFrom; s + winLen <= searchTo; s++) {
        const candidate = tokens.slice(s, s + winLen).join(' ')
        const score = lineSimilarity(expected, candidate)
        if (score > bestScore) { bestScore = score; bestEnd = s + winLen }
      }
    }
    const passed = bestScore >= LINE_PASS_THRESHOLD
    lineResults.push({ idx: i, score: bestScore, passed })
    cursor = bestEnd
    recordResult(state.engine, lineId(i), passed)
    const item = state.engine.items[lineId(i)]
    if (item) {
      const depth = pickDepth(state.engine, item, passed)
      reinsert(state.engine, lineId(i), depth)
    }
  }
  // Transition passes when BOTH adjacent lines passed in this attempt.
  const transitionResults: { fromIdx: number; passed: boolean }[] = []
  for (let k = 0; k < lineResults.length - 1; k++) {
    const a = lineResults[k], b = lineResults[k + 1]
    const passed = a.passed && b.passed
    transitionResults.push({ fromIdx: a.idx, passed })
    const tid = transId(a.idx)
    if (!state.engine.items[tid]) {
      state.engine.items[tid] = createItem(tid, 'transition', {
        fromIdx: a.idx, toIdx: b.idx,
      })
    }
    recordResult(state.engine, tid, passed)
    const item = state.engine.items[tid]
    if (item) reinsert(state.engine, tid, pickDepth(state.engine, item, passed))
  }
  const passedCount = lineResults.filter(r => r.passed).length
  const spanPassed = passedCount === lineResults.length
    && transitionResults.every(r => r.passed)

  // Update cycle counters + last-passed flags
  if (span.type === 'working') {
    state.lastWorkingPassed = spanPassed
    state.workingCycle += 1
  } else if (span.type === 'medium') {
    state.lastMediumPassed = spanPassed
    state.mediumCycle += 1
    state.workingCycle = 0
  } else {
    state.lastFullPassed = spanPassed
    state.mediumCycle = 0
    state.workingCycle = 0
  }
  return { lineResults, transitionResults, spanPassed }
}

/** Whether we may prepend one earlier line to the known set. */
export function canAdvance(state: MonologueState): boolean {
  if (state.currentStart <= 0) return false
  if (!state.lastWorkingPassed) return false
  if (!state.lastMediumPassed) return false
  if (!state.lastFullPassed) return false
  // Require at least one passed working run before advancing
  const span = workingSpan(state)
  for (let i = span.startIdx; i <= span.endIdx; i++) {
    const it = state.engine.items[lineId(i)]
    if (!it || it.mastery < state.engine.config.perItemMasteryFloor) return false
  }
  return true
}

/** Prepend one earlier line to the known set + seed its item/transition. */
export function advance(state: MonologueState): number {
  if (!canAdvance(state)) return state.currentStart
  state.currentStart -= 1
  const newIdx = state.currentStart
  const lid = lineId(newIdx)
  state.engine.items[lid] = createItem(lid, 'line', { lineIdx: newIdx })
  const tid = transId(newIdx)
  state.engine.items[tid] = createItem(tid, 'transition', {
    fromIdx: newIdx, toIdx: newIdx + 1,
  })
  state.lastWorkingPassed = false
  return newIdx
}
