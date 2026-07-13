// W0/R3a deterministic proof rail. Replays the shipped parent engine from git
// beside the working engine, then exercises the entrance state machine and the
// ratified W0 demand ceilings without a browser or wall-clock timing.
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import * as current from '../../src/components/PitchDefender/retroBlasterEngine'
import type {
  Alien, Difficulty, EngineEvent, EngineInput, GameState,
} from '../../src/components/PitchDefender/retroBlasterEngine'

const PARENT_COMMIT = '6dd73659'
const DT_MS = 16
const NOTES = ['C4', 'D4', 'E4', 'F4']
const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')

type EngineModule = Pick<typeof current,
  'beginWave' | 'createInitialState' | 'pickSpotlightIdx' |
  'pickTargetForNote' | 'tick' | 'waveParams'>

interface TimedPlayNote {
  atMs: number
  payload: Extract<EngineEvent, { kind: 'playNote' }>
}

interface WaveReplay {
  difficulty: Difficulty
  wave: number
  waveDurationMs: number
  playNotes: TimedPlayNote[]
  spawnTimesMs: number[]
  peakAlive: number
  params: ReturnType<typeof current.waveParams>
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function near(actual: number, expected: number, label: string): void {
  assert(Math.abs(actual - expected) < 1e-9, `${label}: ${actual} !== ${expected}`)
}

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function input(overrides: Partial<EngineInput> = {}): EngineInput {
  return {
    inputMode: 'click', isListening: false, reducedMotion: false,
    pitch: null, fsrs: {}, ...overrides,
  }
}

function alien(overrides: Partial<Alien> = {}): Alien {
  return {
    x: current.ENTRY_ORIGIN.x,
    y: current.ENTRY_ORIGIN.y,
    entering: true,
    entryT: 0,
    entryTargetX: 400,
    note: 'C4', hue: 0, alive: true, frame: 0, hitTimer: 0,
    ...overrides,
  }
}

function entranceState(aliens = [alien()]): GameState {
  const state = current.createInitialState('true', NOTES, 1000)
  state.aliens = aliens.map(value => ({ ...value }))
  state.activeIdx = -1
  state.waveIntroTimer = 0
  state.spawnQueue = ['fixture-sentinel']
  state.alienCountThisWave = state.aliens.length
  state.nextSpawnAt = Number.POSITIVE_INFINITY
  state.lastProgressAt = state.clockMs
  return state
}

function entryOracle(targetX: number, rawT: number): { x: number; y: number } {
  const t = 1 - (1 - rawT) ** 2
  const u = 1 - t
  const controlX = current.ENTRY_ORIGIN.x + (targetX - current.ENTRY_ORIGIN.x) * 1.4
  const controlY = current.ENTRY_ORIGIN.y + (current.SPAWN_Y - current.ENTRY_ORIGIN.y) * 0.5
  return {
    x: u * u * current.ENTRY_ORIGIN.x + 2 * u * t * controlX + t * t * targetX,
    y: u * u * current.ENTRY_ORIGIN.y + 2 * u * t * controlY + t * t * current.SPAWN_Y,
  }
}

async function loadParentEngine(): Promise<{ engine: EngineModule; cleanup: () => Promise<void> }> {
  const source = execFileSync(
    'git', ['show', `${PARENT_COMMIT}:src/components/PitchDefender/retroBlasterEngine.ts`],
    { cwd: root, encoding: 'utf8' },
  )
  const imports = new Map([
    ['../../lib/fsrs', pathToFileURL(resolve(root, 'src/lib/fsrs.ts')).href],
    ['./types', pathToFileURL(resolve(root, 'src/components/PitchDefender/types.ts')).href],
    ['./pitchMath', pathToFileURL(resolve(root, 'src/components/PitchDefender/pitchMath.ts')).href],
  ])
  let rewritten = source
  for (const [specifier, url] of imports) {
    rewritten = rewritten.replace(`from '${specifier}'`, `from '${url}'`)
  }
  const tempDir = await mkdtemp(join(tmpdir(), 'retro-r3a-parent-'))
  const tempFile = join(tempDir, 'retroBlasterEngine.ts')
  await writeFile(tempFile, rewritten, 'utf8')
  const engine = await import(`${pathToFileURL(tempFile).href}?r3a=${Date.now()}`) as EngineModule
  return { engine, cleanup: () => rm(tempDir, { recursive: true, force: true }) }
}

function eligibleNote(gs: GameState): string | null {
  let best: { y: number; note: string } | null = null
  for (let i = 0; i < gs.aliens.length; i++) {
    const candidate = gs.aliens[i]
    if (!candidate.alive || candidate.entering) continue
    if (gs.lasers.some(laser => laser.active && laser.hits && laser.targetIdx === i)) continue
    if (!best || candidate.y > best.y) best = { y: candidate.y, note: candidate.note }
  }
  return best?.note ?? null
}

function replayWave(engine: EngineModule, difficulty: Difficulty, targetWave = 10): WaveReplay {
  const rng = mulberry32(42)
  let gs = engine.createInitialState(difficulty, NOTES, 1) as GameState
  engine.beginWave(gs, {})
  let pendingAnswer: string | null = null
  let waveStartAt: number | null = targetWave === 1 ? gs.clockMs : null
  let waveEndAt: number | null = null
  let peakAlive = 0
  const playNotes: TimedPlayNote[] = []
  const spawnTimesMs: number[] = []

  for (let step = 0; step < 2_000_000 && gs.wave <= targetWave; step++) {
    assert(gs.phase !== 'game_over', `${difficulty} replay reached game over at wave ${gs.wave}`)
    if (gs.wave === targetWave && waveStartAt === null) waveStartAt = gs.clockMs
    const waveBefore = gs.wave
    const result = engine.tick(
      gs,
      input({ answeredNote: pendingAnswer, latencyMs: 0 }),
      DT_MS,
      rng,
    )
    gs = result.state as GameState
    pendingAnswer = null

    if (waveBefore === targetWave) {
      peakAlive = Math.max(peakAlive, gs.aliens.filter(value => value.alive).length)
      for (const event of result.events) {
        if (event.kind === 'playNote') playNotes.push({ atMs: gs.clockMs, payload: event })
        if (event.kind === 'spawn') spawnTimesMs.push(gs.clockMs)
      }
      if (gs.wave > targetWave) waveEndAt = gs.clockMs
    }

    if (gs.wave !== waveBefore) pendingAnswer = null
    if (!pendingAnswer) pendingAnswer = eligibleNote(gs)
  }

  assert(waveStartAt !== null && waveEndAt !== null, `${difficulty} wave ${targetWave} did not complete`)
  return {
    difficulty,
    wave: targetWave,
    waveDurationMs: waveEndAt - waveStartAt,
    playNotes,
    spawnTimesMs,
    peakAlive,
    params: engine.waveParams(targetWave, difficulty),
  }
}

function gaps(values: number[]): number[] {
  return values.slice(1).map((value, index) => value - values[index])
}

function trajectoryFixture(parent: EngineModule): string {
  const arrivals: Record<number, number> = {}
  for (const stepMs of [16, 33, 50]) {
    let state = entranceState()
    let elapsed = 0
    while (state.aliens[0].entering) {
      const result = current.tick(state, input(), stepMs, mulberry32(7))
      state = result.state
      elapsed += stepMs
      const value = state.aliens[0]
      const expectedT = Math.min(1, elapsed / current.ENTRY_DURATION_MS)
      near(value.entryT, expectedT, `${stepMs}ms entryT at ${elapsed}ms`)
      if (expectedT < 1) {
        const expected = entryOracle(value.entryTargetX, expectedT)
        near(value.x, expected.x, `${stepMs}ms x at ${elapsed}ms`)
        near(value.y, expected.y, `${stepMs}ms y at ${elapsed}ms`)
      } else {
        near(value.x, value.entryTargetX, `${stepMs}ms arrival x`)
        near(value.y, current.SPAWN_Y, `${stepMs}ms arrival y`)
      }
    }
    arrivals[stepMs] = elapsed
    assert(elapsed >= current.ENTRY_DURATION_MS && elapsed < current.ENTRY_DURATION_MS + stepMs,
      `${stepMs}ms arrival ${elapsed}ms is outside [500, ${500 + stepMs})`)
  }

  let largeDt = entranceState()
  largeDt = current.tick(largeDt, input(), 10_000, mulberry32(8)).state
  assert(largeDt.aliens[0].entryT === 1 && !largeDt.aliens[0].entering,
    'large-dt tick did not clamp entryT to exact arrival')
  near(largeDt.aliens[0].x, largeDt.aliens[0].entryTargetX, 'large-dt x')
  near(largeDt.aliens[0].y, current.SPAWN_Y, 'large-dt y')

  let arrived = entranceState()
  arrived = current.tick(arrived, input(), 500, mulberry32(9)).state
  const currentPost = current.tick(arrived, input(), 50, mulberry32(9)).state
  const parentState = parent.createInitialState('true', NOTES, arrived.clockMs) as GameState
  parentState.aliens = [{
    x: arrived.aliens[0].entryTargetX, y: current.SPAWN_Y,
    note: 'C4', hue: 0, alive: true, frame: 0, hitTimer: 0,
  } as Alien]
  parentState.waveIntroTimer = 0
  parentState.spawnQueue = ['fixture-sentinel']
  parentState.nextSpawnAt = Number.POSITIVE_INFINITY
  parentState.lastProgressAt = parentState.clockMs
  const parentPost = parent.tick(parentState, input(), 50, mulberry32(9)).state as GameState
  near(currentPost.aliens[0].x, parentPost.aliens[0].x, 'post-arrival x parity')
  near(currentPost.aliens[0].y, parentPost.aliens[0].y, 'post-arrival descent parity')

  const laneX = 413
  const midpoint = entryOracle(laneX, 1 - Math.sqrt(0.5))
  const straightMidpointX = (current.ENTRY_ORIGIN.x + laneX) / 2
  assert(midpoint.x - straightMidpointX >= 77, 'outer-lane curve lacks the ratified lateral bow')
  let peakX = -Infinity
  for (let i = 0; i <= 1000; i++) peakX = Math.max(peakX, entryOracle(laneX, i / 1000).x)
  assert(peakX + 36 < current.W, `outer-right atlas edge clips: ${peakX + 36}px`)

  return `oracle matched at every step; arrivals ${JSON.stringify(arrivals)}ms; outer-right edge ${(peakX + 36).toFixed(2)}px < ${current.W}px`
}

function pauseAndSoftlockFixture(): string {
  let state = entranceState()
  state = current.tick(state, input(), 200, mulberry32(11)).state
  const frozen = { t: state.aliens[0].entryT, x: state.aliens[0].x, y: state.aliens[0].y }
  for (let i = 0; i < 4; i++) state = current.tick(state, input(), 0, mulberry32(11)).state
  near(state.aliens[0].entryT, frozen.t, 'paused entryT')
  near(state.aliens[0].x, frozen.x, 'paused x')
  near(state.aliens[0].y, frozen.y, 'paused y')
  state = current.tick(state, input(), 300, mulberry32(11)).state
  assert(!state.aliens[0].entering && state.aliens[0].entryT === 1, 'resume did not continue to exact arrival')

  const roster = entranceState([
    alien({ entryTargetX: 144 }),
    alien({ entryTargetX: 413, note: 'D4' }),
  ])
  assert(current.pickSpotlightIdx(roster.aliens, roster.playerX) === -1, 'all-entering roster received spotlight')
  assert(current.pickTargetForNote(roster.aliens, 'C4', roster.playerX) === null, 'entering alien was answer-targetable')
  let beforeArrival = current.tick(roster, input(), 499, mulberry32(12)).state
  assert(beforeArrival.activeIdx === -1 && beforeArrival.aliens.every(value => value.entering),
    'all-entering sentinel ended before 500ms')
  const arrival = current.tick(beforeArrival, input(), 1, mulberry32(12))
  assert(arrival.state.activeIdx >= 0 && arrival.state.aliens.every(value => !value.entering),
    'spotlight did not recover on the exact all-entering arrival tick')
  assert(arrival.events.some(event => event.kind === 'playNote' && event.delayMs === 200 && event.guard === 'alive'),
    'arrival spotlight did not emit the alive/200ms cue')
  return 'dt=0 froze state exactly; resume arrived exactly; all-entering sentinel lasted 500ms and recovered on arrival'
}

class MockMediaQueryList {
  matches: boolean
  private listeners = new Set<(event: { matches: boolean }) => void>()
  constructor(matches: boolean) { this.matches = matches }
  addEventListener(_type: 'change', listener: (event: { matches: boolean }) => void) { this.listeners.add(listener) }
  removeEventListener(_type: 'change', listener: (event: { matches: boolean }) => void) { this.listeners.delete(listener) }
  set(matches: boolean) {
    this.matches = matches
    for (const listener of this.listeners) listener({ matches })
  }
}

async function reducedMotionFixture(): Promise<string> {
  const coldMedia = new MockMediaQueryList(true)
  let coldReduced = coldMedia.matches
  const coldListener = (event: { matches: boolean }) => { coldReduced = event.matches }
  coldMedia.addEventListener('change', coldListener)
  let cold = current.createInitialState('easy', NOTES, 1000)
  cold.waveIntroTimer = 0
  cold.spawnQueue = ['C4']
  cold.alienCountThisWave = 1
  cold.nextSpawnAt = cold.clockMs
  cold.lastProgressAt = cold.clockMs
  cold = current.tick(cold, input({ reducedMotion: coldReduced }), 16, mulberry32(13)).state
  assert(cold.aliens.length === 1 && !cold.aliens[0].entering && cold.aliens[0].entryT === 1,
    'cold reduced-motion spawn produced an entrance frame')
  near(cold.aliens[0].x, cold.aliens[0].entryTargetX, 'cold reduced-motion lane x')
  coldMedia.removeEventListener('change', coldListener)

  const liveMedia = new MockMediaQueryList(false)
  let liveReduced = liveMedia.matches
  const liveListener = (event: { matches: boolean }) => { liveReduced = event.matches }
  liveMedia.addEventListener('change', liveListener)
  let live = entranceState()
  live = current.tick(live, input({ reducedMotion: liveReduced }), 200, mulberry32(14)).state
  assert(live.aliens[0].entering, 'live-toggle fixture was not mid-curve')
  liveMedia.set(true)
  live = current.tick(live, input({ reducedMotion: liveReduced }), 16, mulberry32(14)).state
  assert(!live.aliens[0].entering && live.aliens[0].entryT === 1, 'live preference toggle did not clamp next tick')
  near(live.aliens[0].x, live.aliens[0].entryTargetX, 'live-toggle clamp x')
  near(live.aliens[0].y, current.SPAWN_Y, 'live-toggle clamp y')
  live = current.tick(live, input({ reducedMotion: liveReduced }), 16, mulberry32(14)).state
  near(live.aliens[0].x, live.aliens[0].entryTargetX, 'post-toggle lane x')
  liveMedia.removeEventListener('change', liveListener)

  const view = await readFile(resolve(root, 'src/components/PitchDefender/RetroBlasterII.tsx'), 'utf8')
  assert(view.includes("typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches"),
    'view lacks SSR-safe reduced-motion initialization')
  assert(view.includes("mediaQuery.addEventListener('change', onChange)"), 'view lacks live matchMedia listener')
  assert(view.includes("mediaQuery.removeEventListener('change', onChange)"), 'view lacks matchMedia cleanup')
  assert(view.includes('reducedMotion: reducedMotionRef.current'), 'RAF engine input does not read the live reduced-motion ref')
  return 'cold-start emitted zero curve frames; mocked live change clamped next tick; SSR/listener/cleanup/ref wiring present'
}

function killState(engine: EngineModule): GameState {
  const state = engine.createInitialState('true', NOTES, 1000) as GameState
  state.aliens = [{
    x: 200, y: current.SPAWN_Y, entering: false, entryT: 1, entryTargetX: 200,
    note: 'C4', hue: 0, alive: true, frame: 0, hitTimer: 0,
  }]
  state.activeIdx = 0
  state.waveIntroTimer = 0
  state.spawnQueue = ['D4']
  state.spawnedThisWave = 1
  state.alienCountThisWave = 2
  state.nextSpawnAt = state.clockMs + 800
  state.lastProgressAt = state.clockMs
  state.lasers = [{
    x: 212, y: current.SPAWN_Y + current.ALIEN_H,
    hue: 0, active: true, hits: true,
    targetY: current.SPAWN_Y, targetIdx: 0,
  }]
  return state
}

function spotlightRecoveryFixture(parent: EngineModule): string {
  let state = killState(current)
  let result = current.tick(state, input(), 0, mulberry32(15))
  state = result.state
  assert(state.activeIdx === -1, 'fixture did not reproduce the post-kill -1 spotlight state')
  let spawnedAt = -1
  let recoveredAt = -1
  let recoveryEvent: Extract<EngineEvent, { kind: 'playNote' }> | null = null
  for (let step = 0; step < 200 && recoveredAt < 0; step++) {
    result = current.tick(state, input(), DT_MS, mulberry32(15))
    state = result.state
    if (spawnedAt < 0 && result.events.some(event => event.kind === 'spawn')) spawnedAt = state.clockMs
    const cue = result.events.find((event): event is Extract<EngineEvent, { kind: 'playNote' }> => event.kind === 'playNote')
    if (cue) { recoveredAt = state.clockMs; recoveryEvent = cue }
  }
  assert(spawnedAt >= 0 && recoveredAt >= 0, 'fresh qualifying alien never recovered spotlight')
  assert(state.activeIdx === 1 && !state.aliens[1].entering, 'recovered spotlight is not the arrived fresh alien')
  assert(recoveryEvent?.delayMs === 200 && recoveryEvent.guard === 'alive' && recoveryEvent.targetIdx === 1,
    'recovery cue payload differs from alive/200ms/target-1 contract')

  let parentState = killState(parent)
  parentState.aliens = parentState.aliens.map(value => {
    const { entering: _entering, entryT: _entryT, entryTargetX: _entryTargetX, ...legacy } = value
    return legacy as Alien
  })
  let parentResult = parent.tick(parentState, input(), 0, mulberry32(15))
  parentState = parentResult.state as GameState
  assert(parentState.activeIdx === -1, 'parent fixture did not reproduce post-kill -1')
  const parentEvents: EngineEvent[] = []
  for (let step = 0; step < 100; step++) {
    parentResult = parent.tick(parentState, input(), DT_MS, mulberry32(15))
    parentState = parentResult.state as GameState
    parentEvents.push(...parentResult.events)
  }
  assert(parentState.aliens.length === 2 && parentState.activeIdx === -1,
    'parent did not reproduce the permanent spotlight stall after the second spawn')
  assert(!parentEvents.some(event => event.kind === 'playNote'),
    'parent unexpectedly emitted a recovery playNote')
  return `parent stayed -1 after fresh spawn; R3a recovered index 1 at ${recoveredAt - spawnedAt}ms after spawn with alive/200ms cue`
}

function pacingFixture(parent: EngineModule): string {
  const ceilings: Record<Difficulty, { apm: number; gapMs: number }> = {
    easy: { apm: 54.5, gapMs: 1100 },
    true: { apm: 75, gapMs: 800 },
  }
  const summaries: string[] = []
  for (const difficulty of ['easy', 'true'] as const) {
    const baseline = replayWave(parent, difficulty)
    const actual = replayWave(current, difficulty)
    const ceiling = ceilings[difficulty]
    const eventTimes = actual.playNotes.map(event => event.atMs)
    const eventGaps = gaps(eventTimes)
    const minGap = Math.min(...eventGaps)
    const apm = actual.playNotes.length / (actual.waveDurationMs / 60_000)
    assert(actual.params.maxConcurrent > 1, `${difficulty} pacing replay did not exercise maxConcurrent > 1`)
    if (difficulty === 'true') {
      assert(actual.peakAlive > 1, 'true pacing replay never exercised concurrent alive aliens')
    }
    assert(baseline.playNotes.length === 1,
      `${difficulty} parent baseline expected playNoteEventCount 1, got ${baseline.playNotes.length}`)
    assert(actual.playNotes.length === actual.params.alienCount,
      `${difficulty} corrected demand stream ${actual.playNotes.length} !== alien count ${actual.params.alienCount}`)
    assert(apm <= ceiling.apm, `${difficulty} ${apm.toFixed(2)} APM exceeds ${ceiling.apm}`)
    assert(minGap >= ceiling.gapMs, `${difficulty} minimum demand gap ${minGap}ms is below ${ceiling.gapMs}ms`)
    const spawnMinGap = Math.min(...gaps(actual.spawnTimesMs))
    assert(spawnMinGap >= actual.params.spawnInterval, `${difficulty} spawn corroboration fell below spawnInterval`)
    summaries.push(`${difficulty}: ${apm.toFixed(2)} APM <= ${ceiling.apm}, min gap ${minGap}ms >= ${ceiling.gapMs}ms`)
  }

  const baseline = replayWave(parent, 'true')
  const actual = replayWave(current, 'true')
  for (let i = 0; i < baseline.playNotes.length; i++) {
    const before = baseline.playNotes[i]
    const after = actual.playNotes[i]
    assert(JSON.stringify(after.payload) === JSON.stringify(before.payload),
      `shared playNote payload ${i} changed`)
    const beforeOffset = before.atMs - baseline.spawnTimesMs[0]
    const afterOffset = after.atMs - actual.spawnTimesMs[0]
    const shift = afterOffset - beforeOffset
    assert(shift >= 0, `shared playNote ${i} fired ${-shift}ms earlier`)
    assert(shift <= current.ENTRY_DURATION_MS, `shared playNote ${i} shifted ${shift}ms (>500ms)`)
  }
  return `${summaries.join('; ')}; shared parent subset payload/order preserved and shifted monotonically <=500ms. ` +
    'Ceiling from W0 interim table (Act I single-note aliens only, attackTimerMs=spawnInterval/interAttackRestMs=0) — supersede with the real 4-persona W-chunk\'s split when it ships; may tighten.'
}

async function audioRecoveryFixture(): Promise<string> {
  const [view, audio] = await Promise.all([
    readFile(resolve(root, 'src/components/PitchDefender/RetroBlasterII.tsx'), 'utf8'),
    readFile(resolve(root, 'src/components/PitchDefender/audioEngine.ts'), 'utf8'),
  ])
  assert(view.includes("if (_sfxCtx.state === 'suspended') _sfxCtx.resume()"),
    'RetroBlaster SFX context no longer resumes from suspended')
  assert(audio.includes("if (_ctx.state === 'suspended') _ctx.resume()"),
    'shared piano context no longer resumes from suspended')
  const parentAudio = execFileSync(
    'git', ['show', 'HEAD:src/components/PitchDefender/audioEngine.ts'],
    { cwd: root, encoding: 'utf8' },
  )
  assert(audio.replace(/\r\n/g, '\n') === parentAudio.replace(/\r\n/g, '\n'),
    'audioEngine changed relative to the R3a parent')
  return 'RetroBlaster SFX and shared piano contexts retain suspended→resume paths; audioEngine byte-identical to R3a parent'
}

async function main(): Promise<void> {
  const parentHandle = await loadParentEngine()
  const fixtures: Array<[string, () => string | Promise<string>]> = [
    ['trajectory/oracle/arrival/large-dt/post-arrival/edge', () => trajectoryFixture(parentHandle.engine)],
    ['pause-resume/targeting/no-softlock/arrival-cue', pauseAndSoftlockFixture],
    ['reduced-motion cold/live/view contract', reducedMotionFixture],
    ['spotlight recovery regression', () => spotlightRecoveryFixture(parentHandle.engine)],
    ['W0 pacing average/min-gap + parent differential', () => pacingFixture(parentHandle.engine)],
    ['audio-context recovery regression', audioRecoveryFixture],
  ]

  let failed = false
  try {
    for (const [name, run] of fixtures) {
      try {
        console.log(`PASS ${name}: ${await run()}`)
      } catch (error) {
        failed = true
        console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  } finally {
    await parentHandle.cleanup()
  }

  console.log(failed ? 'R3a PROOF: FAIL' : `R3a PROOF: ALL ${fixtures.length} FIXTURES PASS`)
  if (failed) process.exitCode = 1
}

void main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
