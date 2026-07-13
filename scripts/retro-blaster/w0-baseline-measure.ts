// W0 interim persona-window-table — empirical cross-check.
// Pure logic replay of retroBlasterEngine.tick() with a scripted always-answer bot,
// no browser, no rendering. Measures observed steady-state inter-playNote timing
// on the highest-cadence tier ('true') at a late wave, cross-checking the literal
// spawnInterval constant (waveParams line 222) cited as W0's primary number.
// Read-only: imports the engine, does not modify it.
import { createInitialState, beginWave, tick, waveParams, type Difficulty } from '../../src/components/PitchDefender/retroBlasterEngine'

function mulberry32(seed: number) {
  let a = seed
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Bot targets the most-urgent ALIVE alien (lowest y, i.e. closest to the player),
// same urgency rule pickSpotlightIdx/pickTargetForNote use — NOT gated on gs.activeIdx.
// This is deliberate: the pre-R3a engine only reassigns gs.activeIdx immediately after
// a kill (retroBlasterEngine.ts:518-522) and never again if that reassignment finds no
// other alive alien yet — activeIdx can permanently stick at -1 for the rest of a wave
// (observed live in this harness). A real always-correct player still answers by the
// alien's visible note (color/position), independent of the spotlight cue, and
// pickTargetForNote() matches ANY alive alien of the right class — so the bot must too,
// to measure the engine's true maximum sustainable cadence rather than a spotlight-stall.
function mostUrgentAliveNote(gs: ReturnType<typeof createInitialState>): string | null {
  let best: { y: number; note: string } | null = null
  for (const a of gs.aliens) {
    if (!a.alive) continue
    if (!best || a.y > best.y) best = { y: a.y, note: a.note }
  }
  return best?.note ?? null
}

function measure(difficulty: Difficulty, targetWave: number, reactionMs: number) {
  const notes = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']
  let gs = createInitialState(difficulty, notes.slice(0, 4), 1)
  const rng = mulberry32(42)
  beginWave(gs, {})
  // Fast-forward to targetWave by force-completing waves with an always-correct bot,
  // capturing playNote timestamps only once targetWave is reached.
  const DT = 16 // ms, fixed small step for determinism
  const playNoteTimestamps: number[] = []
  const spawnTimestamps: number[] = []
  let pendingAnswer: { note: string; atMs: number } | null = null
  let guardSteps = 0
  const MAX_STEPS = 2_000_000

  while (gs.wave < targetWave && guardSteps < MAX_STEPS) {
    guardSteps++
    if (gs.phase === 'game_over') {
      return { difficulty, targetWave, reactionMs, gameOverAtWave: gs.wave, note: 'GAME OVER before reaching targetWave at this reaction speed — not measurable' }
    }
    const answeredNote = pendingAnswer && gs.clockMs >= pendingAnswer.atMs ? pendingAnswer.note : null
    if (answeredNote) pendingAnswer = null
    const result = tick(gs, { inputMode: 'click', isListening: false, pitch: null, answeredNote, latencyMs: reactionMs, fsrs: {} }, DT, rng)
    gs = result.state
    if (!pendingAnswer) {
      const note = mostUrgentAliveNote(gs)
      if (note) pendingAnswer = { note, atMs: gs.clockMs + reactionMs }
    }
  }
  if (guardSteps >= MAX_STEPS) throw new Error(`measure(${difficulty}, wave ${targetWave}): guard-step ceiling hit, never reached target wave`)

  // Now measure: run the target wave itself, recording every playNote event's clockMs.
  let steps = 0
  while (gs.wave === targetWave && steps < 200_000) {
    steps++
    if (gs.phase === 'game_over') {
      return { difficulty, targetWave, reactionMs, gameOverDuringMeasuredWave: true, playNoteEventCountBeforeGameOver: playNoteTimestamps.length, note: 'GAME OVER mid-measurement at this reaction speed — partial data only' }
    }
    const answeredNote = pendingAnswer && gs.clockMs >= pendingAnswer.atMs ? pendingAnswer.note : null
    if (answeredNote) pendingAnswer = null
    const result = tick(gs, { inputMode: 'click', isListening: false, pitch: null, answeredNote, latencyMs: reactionMs, fsrs: {} }, DT, rng)
    gs = result.state
    for (const ev of result.events) {
      if (ev.kind === 'playNote') playNoteTimestamps.push(gs.clockMs)
      if (ev.kind === 'spawn') spawnTimestamps.push(gs.clockMs)
    }
    if (!pendingAnswer) {
      const note = mostUrgentAliveNote(gs)
      if (note) pendingAnswer = { note, atMs: gs.clockMs + reactionMs }
    }
  }
  if (steps >= 200_000) throw new Error(`measure(${difficulty}, wave ${targetWave}): guard-step ceiling hit mid-measurement`)

  const gaps: number[] = []
  for (let i = 1; i < playNoteTimestamps.length; i++) gaps.push(playNoteTimestamps[i] - playNoteTimestamps[i - 1])
  const steadyGaps = gaps.slice(Math.max(0, gaps.length - 8)) // last 8 gaps = steady-state tail
  const minSteadyGap = steadyGaps.length ? Math.min(...steadyGaps) : null
  const params = waveParams(targetWave, difficulty)

  // spawn events are unconditional (fire on every alien spawn, gated only by maxConcurrent/
  // spawnInterval — never by activeIdx/spotlight state), unlike playNote. This is the
  // requiredAnswerEvents proxy W0 v2 uses instead of playNote.
  const spawnGaps: number[] = []
  for (let i = 1; i < spawnTimestamps.length; i++) spawnGaps.push(spawnTimestamps[i] - spawnTimestamps[i - 1])
  const steadySpawnGaps = spawnGaps.slice(Math.max(0, spawnGaps.length - 8))
  const minSteadySpawnGap = steadySpawnGaps.length ? Math.min(...steadySpawnGaps) : null

  return {
    difficulty,
    targetWave,
    reactionMs,
    literalSpawnIntervalMs: params.spawnInterval,
    playNoteEventCount: playNoteTimestamps.length,
    allPlayNoteGapsMs: gaps,
    steadyStatePlayNoteTailGapsMs: steadyGaps,
    minObservedSteadyPlayNoteGapMs: minSteadyGap,
    spawnEventCount: spawnTimestamps.length,
    steadyStateSpawnTailGapsMs: steadySpawnGaps,
    minObservedSteadySpawnGapMs: minSteadySpawnGap,
    spawnCrossCheckPass: minSteadySpawnGap === null ? null : minSteadySpawnGap >= params.spawnInterval - 1, // -1ms tolerance for DT quantization
  }
}

const results = {
  measuredAt: 'w0-baseline-measure.ts (deterministic, DT=16ms, mulberry32 seed=42)',
  parentCommit: '6dd73659',
  note: 'Multiple reactionMs values probe whether the pre-R3a engine\'s playNote event ever re-fires under sustained play (spotlight-refresh finding, see write-up).',
  easy_reaction50ms: measure('easy', 10, 50),
  true_reaction50ms: measure('true', 10, 50),
  true_reaction300ms: measure('true', 10, 300),
  true_reaction600ms: measure('true', 10, 600),
  true_reaction1000ms: measure('true', 10, 1000),
}

console.log(JSON.stringify(results, null, 2))
