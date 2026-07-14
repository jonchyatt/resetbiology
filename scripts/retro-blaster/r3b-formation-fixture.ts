import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'

import {
  ALIEN_H,
  DIVE_RESPONSE_DEADLINE_MS,
  DIVE_TELEGRAPH_MS,
  ENTRY_DURATION_MS,
  FORMATION_BREATH_PERIOD_MS,
  FORMATION_BREATH_X,
  FORMATION_BREATH_Y,
  FORMATION_CENTER_X,
  FORMATION_PITCH_X,
  FORMATION_PITCH_Y,
  FORMATION_SLOT_COUNT,
  FORMATION_SLOT_ORDER,
  FORMATION_TOP_Y,
  MAX_SIM_STEP_MS,
  NOTE_BUTTONS_Y,
  PLAYER_Y,
  SPACE_SCALE,
  beginWave,
  buildWaveQueue,
  createInitialState,
  formationAnchor,
  formationPose,
  isTargetableAlien,
  pickSpotlightIdx,
  pickTargetForNote,
  tick,
  type Alien,
  type EngineInput,
  type GameState,
} from '../../src/components/PitchDefender/retroBlasterEngine'
import { ENEMY_ROSTER } from '../../src/components/PitchDefender/retroBlasterRenderer'
import { noteToFreq } from '../../src/components/PitchDefender/pitchMath'

const root = process.cwd()
const EPSILON = 1e-7

function engineInput(overrides: Partial<EngineInput> = {}): EngineInput {
  return {
    inputMode: 'click',
    isListening: false,
    reducedMotion: false,
    pitch: null,
    fsrs: {},
    ...overrides,
  }
}

function alien(slot = 0, overrides: Partial<Alien> = {}): Alien {
  const anchor = formationAnchor(slot)
  return {
    alienId: `fixture-game:alien:1:${slot}`,
    visualId: `fixture:${slot}`,
    visualKind: (slot % 4) as 0 | 1 | 2 | 3,
    x: anchor.x,
    y: anchor.y,
    entering: false,
    entryT: 1,
    entryTargetX: anchor.x,
    formationSlot: slot,
    formationX: anchor.x,
    formationY: anchor.y,
    note: ['C4', 'D4', 'E4', 'F4'][slot % 4],
    hue: 180,
    alive: true,
    frame: 0,
    hitTimer: 0,
    ...overrides,
  }
}

function bindOpenDemand(state: GameState, targetIndex = 0): void {
  const target = state.aliens[targetIndex]
  state.activeAttack = {
    attackId: `${state.gameId}:attack:${state.nextAttackSerial++}`,
    alienId: target.alienId,
    note: target.note,
    side: 1,
    phase: 'outbound',
    telegraphStartedAtMs: state.directorClockMs - DIVE_TELEGRAPH_MS,
    demandAtMs: state.directorClockMs,
    deadlineAtMs: state.directorClockMs + DIVE_RESPONSE_DEADLINE_MS,
    outboundT: 0,
    returnFromT: 0,
    returnStartedAtMs: null,
    outcome: null,
    resolvedAtMs: null,
  }
}

function advance(
  state: GameState,
  totalMs: number,
  stepMs: number,
  input = engineInput(),
): GameState {
  let next = state
  let elapsed = 0
  while (elapsed < totalMs) {
    const step = Math.min(stepMs, totalMs - elapsed)
    next = tick(next, input, step, () => 0.5).state
    elapsed += step
  }
  return next
}

function validateGeometry(): void {
  assert.equal(FORMATION_SLOT_COUNT, 15)
  assert.deepEqual(FORMATION_SLOT_ORDER, [
    [2, 0], [1, 0], [3, 0], [0, 0], [4, 0],
    [2, 1], [1, 1], [3, 1], [0, 1], [4, 1],
    [2, 2], [1, 2], [3, 2], [0, 2], [4, 2],
  ])
  for (let slot = 0; slot < FORMATION_SLOT_COUNT; slot++) {
    const [column, row] = FORMATION_SLOT_ORDER[slot]
    assert.deepEqual(formationAnchor(slot), {
      x: FORMATION_CENTER_X + (column - 2) * FORMATION_PITCH_X,
      y: FORMATION_TOP_Y + row * FORMATION_PITCH_Y,
    })
  }
  assert.throws(() => formationAnchor(FORMATION_SLOT_COUNT), RangeError)
}

async function alphaBounds(
  pngPath: string,
  frame: { x: number; y: number; w: number; h: number },
): Promise<{ x: number; y: number; w: number; h: number }> {
  const { data, info } = await sharp(pngPath)
    .extract({ left: frame.x, top: frame.y, width: frame.w, height: frame.h })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  let minX = info.width
  let minY = info.height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * info.channels + 3] === 0) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }
  assert.ok(maxX >= minX && maxY >= minY, `${pngPath} frame has no opaque pixels`)
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

async function validateLiveAtlasClearance(): Promise<void> {
  const minGap = 6 * SPACE_SCALE
  const hudSafeBottom = 42 * SPACE_SCALE
  const playerSafeTop = PLAYER_Y - 20 * SPACE_SCALE
  const noteButtonSafeTop = NOTE_BUTTONS_Y
  const activeScale = 1.2 * SPACE_SCALE
  const focusPad = 4 * SPACE_SCALE
  const activeOffsetY = (ALIEN_H * 0.2) / 2
  let maxWidth = 0
  let maxHeight = 0

  for (const descriptor of ENEMY_ROSTER) {
    const jsonPath = resolve(root, `public/sprites/${descriptor.id}-atlas.json`)
    const pngPath = resolve(root, `public/sprites/${descriptor.id}-atlas.png`)
    const atlas = JSON.parse(await readFile(jsonPath, 'utf8')) as {
      frames: Record<string, { x: number; y: number; w: number; h: number }>
    }
    for (const frameName of ['idle-a', 'idle-b']) {
      const bounds = await alphaBounds(pngPath, atlas.frames[frameName])
      const width = bounds.w * activeScale + focusPad * 2
      const height = bounds.h * activeScale + focusPad * 2
      maxWidth = Math.max(maxWidth, width)
      maxHeight = Math.max(maxHeight, height)
      for (let slot = 0; slot < FORMATION_SLOT_COUNT; slot++) {
        const anchor = formationAnchor(slot)
        const atlasTop = anchor.y - activeOffsetY - 9 * SPACE_SCALE
        const visualTop = atlasTop + bounds.y * activeScale - focusPad - FORMATION_BREATH_Y
        const visualBottom = atlasTop + (bounds.y + bounds.h) * activeScale + focusPad + FORMATION_BREATH_Y
        assert.ok(visualTop + EPSILON >= hudSafeBottom + minGap,
          `${descriptor.id}/${frameName}/slot${slot} clips HUD clearance`)
        assert.ok(visualBottom <= Math.min(playerSafeTop, noteButtonSafeTop) - minGap + EPSILON,
          `${descriptor.id}/${frameName}/slot${slot} clips player/buttons clearance`)
      }
    }
  }

  assert.ok(FORMATION_PITCH_X >= maxWidth + minGap)
  assert.ok(FORMATION_PITCH_Y >= maxHeight + minGap)
  const syntheticWidth = 60 * activeScale + focusPad * 2
  const syntheticHeight = 50 * activeScale + focusPad * 2
  assert.equal(
    FORMATION_PITCH_X >= syntheticWidth + minGap && FORMATION_PITCH_Y >= syntheticHeight + minGap,
    false,
    'synthetic 60x50 negative control must fail the footprint contract',
  )
}

function prepareSpawningState(count: number): GameState {
  const state = createInitialState('true', ['C4', 'D4', 'E4', 'F4'], 1000)
  state.wave = 9
  state.waveIntroTimer = 0
  state.spawnQueue = Array.from({ length: count }, (_, index) => ['C4', 'D4', 'E4', 'F4'][index % 4])
  state.alienCountThisWave = count
  state.nextSpawnAt = state.directorClockMs
  return state
}

function validateStableSlotsAndHoles(): void {
  let state = prepareSpawningState(12)
  while (state.spawnedThisWave < 12) {
    const result = tick(state, engineInput(), 16, () => 0.5)
    state = result.state
    if (result.events.some(event => event.kind === 'spawn')) {
      const latest = state.aliens.at(-1)!
      assert.equal(latest.formationSlot, state.spawnedThisWave - 1)
      if (state.spawnedThisWave < 12) latest.alive = false
    }
  }
  assert.deepEqual(state.aliens.map(item => item.formationSlot), Array.from({ length: 12 }, (_, index) => index))
  assert.equal(new Set(state.aliens.map(item => `${item.formationX}:${item.formationY}`)).size, 12)

  const survivors = state.aliens.filter(item => item.alive)
  const survivorSlots = survivors.map(item => item.formationSlot)
  state = advance(state, 400, 20)
  assert.deepEqual(state.aliens.filter(item => item.alive).map(item => item.formationSlot), survivorSlots)
}

function validateEntryAndBreath(): void {
  for (const frameStep of [16, 20, 40]) {
    let state = prepareSpawningState(1)
    state = tick(state, engineInput(), 0, () => 0.5).state
    const startedAt = state.directorClockMs
    while (state.aliens[0].entering) state = tick(state, engineInput(), frameStep, () => 0.5).state
    const elapsed = state.directorClockMs - startedAt
    assert.ok(elapsed >= ENTRY_DURATION_MS && elapsed < ENTRY_DURATION_MS + frameStep)
    const expected = formationPose(
      state.aliens[0].formationX,
      state.aliens[0].formationY,
      state.directorClockMs,
      false,
    )
    assert.ok(Math.abs(state.aliens[0].x - expected.x) < EPSILON)
    assert.ok(Math.abs(state.aliens[0].y - expected.y) < EPSILON)
    const next = tick(state, engineInput(), 0, () => 0.5).state.aliens[0]
    assert.ok(Math.hypot(next.x - state.aliens[0].x, next.y - state.aliens[0].y) <= 0.25)
  }

  const anchor = formationAnchor(0)
  const expected = [
    [0, 0],
    [FORMATION_BREATH_X, FORMATION_BREATH_Y],
    [0, 0],
    [-FORMATION_BREATH_X, -FORMATION_BREATH_Y],
    [0, 0],
  ]
  for (const [index, time] of [0, 600, 1200, 1800, 2400].entries()) {
    const pose = formationPose(anchor.x, anchor.y, time, false)
    assert.ok(Math.abs(pose.x - anchor.x - expected[index][0]) < EPSILON)
    assert.ok(Math.abs(pose.y - anchor.y - expected[index][1]) < EPSILON)
  }
  assert.deepEqual(formationPose(anchor.x, anchor.y, 600, true), anchor)
  assert.deepEqual(formationPose(anchor.x, anchor.y, FORMATION_BREATH_PERIOD_MS * 10, false), anchor)
}

function validateClocksAndReducedMotion(): void {
  const state = createInitialState('true', ['C4', 'D4', 'E4', 'F4'], 1000)
  state.waveIntroTimer = 0
  state.spawnQueue = ['C4']
  state.alienCountThisWave = 1
  state.nextSpawnAt = state.directorClockMs + 800
  let result = tick(state, engineInput(), 5000, () => 0.5)
  assert.equal(result.state.directorClockMs, 1000 + MAX_SIM_STEP_MS)
  assert.equal(result.state.aliens.length, 0)
  result = tick(result.state, engineInput({ isActive: false }), 5000, () => 0.5)
  assert.equal(result.state.directorClockMs, 1000 + MAX_SIM_STEP_MS)
  assert.equal(result.events.length, 0)

  const base = createInitialState('true', ['C4', 'D4', 'E4', 'F4'], 1000)
  base.waveIntroTimer = 0
  base.spawnQueue = []
  base.alienCountThisWave = 2
  base.aliens = [alien(0), alien(1)]
  const normal = tick(base, engineInput(), 40, () => 0.5)
  const reduced = tick(base, engineInput({ reducedMotion: true }), 40, () => 0.5)
  assert.deepEqual(normal.events, reduced.events)
  assert.equal(normal.state.score, reduced.state.score)
  assert.equal(normal.state.cityHealth, reduced.state.cityHealth)
  for (const item of reduced.state.aliens) {
    assert.equal(item.x, item.formationX)
    assert.equal(item.y, item.formationY)
  }
}

function validateTargetabilityAndMicClock(): void {
  const entering = alien(0, { entering: true, entryT: 0.5 })
  assert.equal(isTargetableAlien(entering), false)
  assert.equal(pickTargetForNote([entering], 'C4', 320), null)
  assert.equal(pickSpotlightIdx([entering], 320), -1)

  let state = createInitialState('true', ['C4', 'D4', 'E4', 'F4'], 1000, 'fixture-game')
  state.waveIntroTimer = 0
  state.spawnQueue = []
  state.alienCountThisWave = 2
  state.aliens = [alien(0), alien(1)]
  bindOpenDemand(state)
  const pitch = {
    note: 'C4', frequency: noteToFreq('C4'), cents: 0, confidence: 1, isActive: true,
  }
  state = tick(state, engineInput({ inputMode: 'mic', isListening: true, pitch }), 100, () => 0.5).state
  assert.equal(state.matchStartAt, 1100)
  assert.equal(state.chargeProgress, 0)
  state = tick(state, engineInput({ inputMode: 'mic', isListening: true, pitch }), 250, () => 0.5).state
  assert.equal(state.clockMs, 1350, 'mic clock must retain shipped unclamped elapsed semantics')
  assert.equal(state.directorClockMs, 1100, 'director clock must cap both long frames independently')
  assert.equal(state.chargeProgress, 250, 'mic hold spanning >50ms must remain byte-identical')
}

function validateStateMachineAndPacing(): void {
  const a = createInitialState('true', ['C4', 'D4', 'E4', 'F4'], 1000)
  const b = createInitialState('true', ['C4', 'D4', 'E4', 'F4'], 1000)
  a.wave = b.wave = 4
  beginWave(a, {})
  beginWave(b, {})
  assert.deepEqual(a.spawnQueue, b.spawnQueue, 'wave reset must be idempotent for equal inputs')

  const expectedQueues: Record<string, string[]> = {}
  for (const [key, wave, difficulty] of [['easy-1', 1, 'easy'], ['true-7', 7, 'true']] as const) {
    const waveState = createInitialState(difficulty, ['C4', 'D4', 'E4', 'F4'], 1000)
    waveState.wave = wave
    buildWaveQueue(waveState, {})
    expectedQueues[key] = waveState.spawnQueue
  }
  assert.deepEqual(expectedQueues, {
    'easy-1': ['C4', 'E4'],
    'true-7': ['E4', 'D4', 'C4', 'C4', 'E4', 'E4', 'C4', 'E4', 'C4', 'F4'],
  })

  const capacity = prepareSpawningState(1)
  capacity.spawnedThisWave = FORMATION_SLOT_COUNT
  const queueBefore = [...capacity.spawnQueue]
  assert.throws(() => tick(capacity, engineInput(), 0, () => 0.5), RangeError)
  assert.deepEqual(capacity.spawnQueue, queueBefore, 'slot-capacity failure mutated caller state')

  let interrupted = prepareSpawningState(1)
  interrupted = tick(interrupted, engineInput(), 0, () => 0.5).state
  interrupted = advance(interrupted, 200, 20)
  interrupted = tick(interrupted, engineInput({ reducedMotion: true }), 16, () => 0.5).state
  assert.equal(interrupted.aliens[0].entering, false)
  assert.equal(interrupted.aliens[0].x, interrupted.aliens[0].formationX)
  assert.equal(interrupted.aliens[0].y, interrupted.aliens[0].formationY)

  let waiting = createInitialState('true', ['C4', 'D4', 'E4', 'F4'], 1000)
  waiting.waveIntroTimer = 0
  waiting.spawnQueue = []
  waiting.aliens = [alien(0)]
  const waveBefore = waiting.wave
  waiting = tick(waiting, engineInput(), 50, () => 0.5).state
  assert.equal(waiting.wave, waveBefore, 'queue-empty live formation advanced the wave')
  waiting.aliens[0].alive = false
  waiting = tick(waiting, engineInput(), 50, () => 0.5).state
  assert.equal(waiting.wave, waveBefore + 1)
  waiting = tick(waiting, engineInput(), 0, () => 0.5).state
  assert.equal(waiting.wave, waveBefore + 1, 'wave completion fired twice')

  let stable = createInitialState('true', ['C4', 'D4', 'E4', 'F4'], 1000)
  stable.waveIntroTimer = 0
  stable.spawnQueue = []
  stable.alienCountThisWave = 2
  stable.aliens = [alien(0), alien(1)]
  stable.nextAttackAtMs = Number.POSITIVE_INFINITY
  for (const item of stable.aliens) {
    const pose = formationPose(item.formationX, item.formationY, stable.directorClockMs, false)
    item.x = pose.x
    item.y = pose.y
  }
  const startingPositions = stable.aliens.map(item => [item.x, item.y])
  const shields = stable.cityHealth
  stable = advance(stable, FORMATION_BREATH_PERIOD_MS * 10, MAX_SIM_STEP_MS)
  assert.equal(stable.cityHealth, shields)
  assert.ok(stable.aliens.every((item, index) =>
    Math.abs(item.x - startingPositions[index][0]) < EPSILON &&
    Math.abs(item.y - startingPositions[index][1]) < EPSILON))
}

async function validateShellAudioContract(): Promise<void> {
  const shell = await readFile(resolve(root, 'src/components/PitchDefender/RetroBlasterII.tsx'), 'utf8')
  assert.equal((shell.match(/playPianoNote\(/g) ?? []).length, 5,
    'pitched playback must remain limited to demand, explicit replay, the two R8a radio-check sites, and R8b NEW SIGNAL')
  assert.match(shell, /getPianoReadiness\(RADIO_CHECK_NOTE\)/,
    'R8a output dispatch must be guarded by the ratified readiness observer')
  assert.match(shell, /This is a systems check, not a score/,
    'R8a must not represent the named radio check as a skill test')
  assert.equal(/startMusic\s*\(/.test(shell), false, 'Retro Blaster must not start ambient pitched music')
  assert.match(shell, /visibilitychange/)
  assert.match(shell, /isTargetableAlien/)
}

async function main(): Promise<void> {
  validateGeometry()
  await validateLiveAtlasClearance()
  validateStableSlotsAndHoles()
  validateEntryAndBreath()
  validateClocksAndReducedMotion()
  validateTargetabilityAndMicClock()
  validateStateMachineAndPacing()
  await validateShellAudioContract()
  console.log('R3b formation fixture PASS')
  console.log('15 stable slots; live-atlas clearances; collective breath; two clocks')
  console.log('targetability, long-frame mic parity, state recovery, silence contract PASS')
}

void main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
