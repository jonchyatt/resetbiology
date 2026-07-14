import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import {
  DIVE_RESPONSE_DEADLINE_MS,
  INTRODUCTION_DURATION_MS,
  beginWave,
  createInitialState,
  formationAnchor,
  resolveAttack,
  tick,
  type Alien,
  type CeremonyToneAck,
  type EngineEvent,
  type EngineInput,
  type GameState,
  type IntroductionCeremony,
} from '../../src/components/PitchDefender/retroBlasterEngine'
import { INTRO_ORDER, KEYBOARD_ORDER } from '../../src/components/PitchDefender/types'

const BASE = 'f973a7f62852bbd1ecbfc62f84eed34026c732ad'
const EPOCH = 1_800_000_000_000
const NOTES = ['C4', 'A4', 'G4', 'E4']
const rows: string[] = []
const check = (name: string, run: () => void) => { run(); rows.push(name) }

function alien(slot = 0, note = NOTES[slot % NOTES.length], alive = true): Alien {
  const anchor = formationAnchor(slot)
  return {
    alienId: `r8b-game:alien:1:${slot}`,
    visualId: `r8b:1:${slot}`,
    visualKind: (slot % 4) as 0 | 1 | 2 | 3,
    x: anchor.x,
    y: anchor.y,
    entering: false,
    entryT: 1,
    entryTargetX: anchor.x,
    formationSlot: slot,
    formationX: anchor.x,
    formationY: anchor.y,
    note,
    hue: 180,
    soul: { note, r: 0.5, calm: 0.5, due: true, agitation: 0.5, divePressure: 2 },
    diveServiceCount: 0,
    alive,
    frame: 0,
    hitTimer: 0,
  }
}

function input(overrides: Partial<EngineInput> = {}): EngineInput {
  return {
    inputMode: 'click',
    isListening: false,
    reducedMotion: false,
    pitch: null,
    pendingAnswer: null,
    ceremonyToneAck: null,
    fsrs: {},
    isActive: true,
    memoryEpochMs: EPOCH,
    voiceTimeoutObservation: { healthy: false, heard: false },
    ...overrides,
  }
}

function ceremony(
  state: GameState,
  note = 'D4',
  status: IntroductionCeremony['toneStatus'] = 'pending',
  elapsedMs = 0,
  serial = 0,
): IntroductionCeremony {
  return {
    ceremonyId: `${state.gameId}:ceremony:${serial}`,
    note,
    elapsedMs,
    durationMs: INTRODUCTION_DURATION_MS,
    toneStatus: status,
  }
}

function completedWave(pendingIntroductions: string[]): GameState {
  const state = createInitialState('easy', NOTES, 1000, 'r8b-game')
  const dead = alien(0, 'C4', false)
  state.waveIntroTimer = 0
  state.aliens = [dead]
  state.spawnQueue = []
  state.spawnedThisWave = 1
  state.alienCountThisWave = 1
  state.activeAttack = null
  state.pendingIntroductions = [...pendingIntroductions]
  state.introductionCeremony = null
  state.particles = [{ x: 20, y: 30, vx: 12, vy: -5, life: 0.8, hue: 180 }]
  state.lasers = [{
    x: 30, y: 80, hue: 180, active: true, hits: false, targetY: 50,
    targetAlienId: null, attackId: null,
  }]
  return state
}

function withCeremony(
  note = 'D4',
  status: IntroductionCeremony['toneStatus'] = 'pending',
  elapsedMs = 0,
): GameState {
  const state = completedWave([])
  state.phase = 'ceremony'
  state.introductionCeremony = ceremony(state, note, status, elapsedMs)
  state.nextCeremonySerial = 1
  return state
}

function ack(state: GameState, dispatched: boolean, overrides: Partial<CeremonyToneAck> = {}): CeremonyToneAck {
  assert(state.introductionCeremony)
  return {
    ceremonyId: state.introductionCeremony.ceremonyId,
    note: state.introductionCeremony.note,
    dispatched,
    ...overrides,
  }
}

function normalizedFreeze(state: GameState): GameState {
  const copy = structuredClone(state)
  if (copy.introductionCeremony) {
    copy.introductionCeremony.elapsedMs = 0
    copy.introductionCeremony.toneStatus = 'pending'
  }
  return copy
}

function eventCount(events: readonly EngineEvent[], kind: EngineEvent['kind']): number {
  return events.filter(event => event.kind === kind).length
}

function openAttack(state: GameState, note = 'C4', slot = 0): void {
  const target = alien(slot, note)
  state.aliens = [target]
  state.spawnQueue = []
  state.waveIntroTimer = 0
  state.activeAttack = {
    attackId: `${state.gameId}:attack:${slot + 1}`,
    alienId: target.alienId,
    note,
    side: 1,
    phase: 'outbound',
    telegraphStartedAtMs: state.directorClockMs - 350,
    demandAtMs: state.directorClockMs,
    deadlineAtMs: state.directorClockMs + DIVE_RESPONSE_DEADLINE_MS,
    outboundT: 0,
    returnFromT: 0,
    returnStartedAtMs: null,
    outcome: null,
    resolvedAtMs: null,
    voiceWindowEligible: null,
    voiceHeardPhonation: false,
  }
}

check('R8b red contract imports exact public types and initializes concrete state', () => {
  const state = createInitialState('easy', NOTES, 1000, 'r8b-init')
  assert.deepEqual(state.pendingIntroductions, [])
  assert.equal(state.introductionCeremony, null)
  assert.equal(state.nextCeremonySerial, 0)
  assert.equal(INTRODUCTION_DURATION_MS, 2400)
})

check('one unlock queues once; duplicate queue attempt burns no serial', () => {
  const state = createInitialState('easy', NOTES, 1000, 'r8b-unlock')
  state.pendingIntroductions = ['D4']
  state.consecutiveCorrect = 9
  openAttack(state)
  const events: EngineEvent[] = []
  assert(resolveAttack(state, state.activeAttack!.attackId, 'correct', 250, events, 'click'))
  assert.deepEqual(state.unlockedNotes, [...NOTES, 'D4'])
  assert.deepEqual(state.pendingIntroductions, ['D4'])
  assert.equal(state.nextCeremonySerial, 0)
  assert.equal(eventCount(events, 'unlock'), 1)
})

check('two legitimate unlocks queue in order and restored notes never queue', () => {
  const state = createInitialState('easy', NOTES, 1000, 'r8b-order')
  state.consecutiveCorrect = 9
  openAttack(state, 'C4', 0)
  resolveAttack(state, state.activeAttack!.attackId, 'correct', 250, [], 'click')
  state.activeAttack = null
  state.consecutiveCorrect = 12
  openAttack(state, 'A4', 1)
  resolveAttack(state, state.activeAttack!.attackId, 'correct', 250, [], 'click')
  assert.deepEqual(state.pendingIntroductions, ['D4', 'F4'])
  const restored = createInitialState('easy', [...NOTES, 'D4', 'F4'], 1000, 'r8b-restored')
  assert.deepEqual(restored.pendingIntroductions, [])
})

check('empty queue preserves inherited wave completion event order', () => {
  const result = tick(completedWave([]), input(), 16, () => 0.5)
  assert.equal(result.state.phase, 'playing')
  assert.equal(result.state.wave, 2)
  assert.equal(result.state.introductionCeremony, null)
  assert.deepEqual(result.events.map(event => event.kind), ['waveComplete'])
})

check('non-empty queue enters one deterministic ceremony at the completed-wave boundary', () => {
  const result = tick(completedWave(['D4']), input(), 16, () => 0.5)
  assert.equal(result.state.phase, 'ceremony')
  assert.equal(result.state.wave, 1)
  assert.equal(result.state.introductionCeremony?.ceremonyId, 'r8b-game:ceremony:0')
  assert.equal(result.state.introductionCeremony?.note, 'D4')
  assert.equal(result.state.nextCeremonySerial, 1)
  assert.deepEqual(result.state.pendingIntroductions, [])
  assert.deepEqual(result.events.map(event => event.kind), ['waveComplete', 'ceremonyToneRequest'])
})

check('matching ack is the only elapsed authority; stale/negative/duplicate inputs fail closed', () => {
  const base = withCeremony()
  const stale = tick(base, input({ ceremonyToneAck: ack(base, true, { ceremonyId: 'stale' }) }), 50, () => 0.5)
  assert.equal(stale.state.introductionCeremony?.toneStatus, 'pending')
  assert.equal(stale.state.introductionCeremony?.elapsedMs, 0)
  const negative = tick(base, input({ ceremonyToneAck: ack(base, false) }), 50, () => 0.5)
  assert.equal(negative.state.introductionCeremony?.toneStatus, 'blocked')
  assert.equal(negative.state.introductionCeremony?.elapsedMs, 0)
  const positive = tick(base, input({ ceremonyToneAck: ack(base, true) }), 50, () => 0.5)
  assert.equal(positive.state.introductionCeremony?.toneStatus, 'acknowledged')
  assert.equal(positive.state.introductionCeremony?.elapsedMs, 50)
  const duplicate = tick(positive.state, input({ ceremonyToneAck: ack(positive.state, true) }), 50, () => 0.5)
  assert.equal(duplicate.state.introductionCeremony?.elapsedMs, 100)
})

check('large active dt is bounded and cannot spike ceremony elapsed on resume', () => {
  const state = withCeremony('D4', 'acknowledged', 0)
  const result = tick(state, input(), 5000, () => 0.5)
  assert.equal(result.state.introductionCeremony?.elapsedMs, 50)
  assert.equal(result.state.phase, 'ceremony')
  assert.deepEqual(result.events, [])
})

check('queued introduction cannot enter before the completed-wave boundary', () => {
  const state = createInitialState('easy', NOTES, 1000, 'r8b-live-boundary')
  state.waveIntroTimer = 0
  state.spawnQueue = []
  state.pendingIntroductions = ['D4']
  openAttack(state)
  const result = tick(state, input(), 16, () => 0.5)
  assert.equal(result.state.phase, 'playing')
  assert.equal(result.state.introductionCeremony, null)
  assert.deepEqual(result.state.pendingIntroductions, ['D4'])
  assert.equal(eventCount(result.events, 'ceremonyToneRequest'), 0)
})

check('inactive ticks are exact deep equality and cannot consume an acknowledgment', () => {
  const state = withCeremony()
  const before = structuredClone(state)
  const result = tick(state, input({ isActive: false, ceremonyToneAck: ack(state, false) }), 5000, () => 0.5)
  assert.deepEqual(result.state, before)
  assert.deepEqual(result.events, [])
})

check('whole-state ceremony freeze permits exactly elapsed and tone status', () => {
  let state = withCeremony('D4', 'pending')
  const originalParticles = structuredClone(state.particles)
  const originalLasers = structuredClone(state.lasers)
  const initial = normalizedFreeze(state)
  for (let index = 0; index < 240; index++) {
    const toneAck = index === 0 ? ack(state, true) : null
    const result = tick(state, input({ ceremonyToneAck: toneAck }), 5, () => 0.5)
    state = result.state
    assert.deepEqual(normalizedFreeze(state), initial)
    assert.deepEqual(result.events, [])
  }
  assert.equal(state.introductionCeremony?.elapsedMs, 1200)
  assert.deepEqual(state.particles, originalParticles)
  assert.deepEqual(state.lasers, originalLasers)
})

check('queued ceremonies are gapless and each emit one request', () => {
  const state = withCeremony('D4', 'acknowledged', INTRODUCTION_DURATION_MS - 10)
  state.pendingIntroductions = ['F4']
  const next = tick(state, input(), 20, () => 0.5)
  assert.equal(next.state.phase, 'ceremony')
  assert.equal(next.state.introductionCeremony?.ceremonyId, 'r8b-game:ceremony:1')
  assert.equal(next.state.introductionCeremony?.note, 'F4')
  assert.equal(next.state.nextCeremonySerial, 2)
  assert.equal(eventCount(next.events, 'ceremonyToneRequest'), 1)
  assert.equal(eventCount(next.events, 'waveComplete'), 0)
})

check('final exit returns exact inherited new-wave setup with no extra event or sim step', () => {
  const state = withCeremony('D4', 'acknowledged', INTRODUCTION_DURATION_MS - 10)
  const expected = structuredClone(state)
  expected.phase = 'playing'
  expected.introductionCeremony = null
  expected.wave++
  expected.waveIntroTimer = 1.6
  beginWave(expected, {}, EPOCH)
  const result = tick(state, input(), 20, () => 0.5)
  assert.deepEqual(result.state, expected)
  assert.equal(eventCount(result.events, 'waveComplete'), 0)
  assert.deepEqual(result.events, [])
})

check('one completed wave emits one waveComplete across one and two introductions', () => {
  for (const notes of [['D4'], ['D4', 'F4']]) {
    const boundary = tick(completedWave(notes), input(), 16, () => 0.5)
    let state = boundary.state
    let waveCompleteCount = eventCount(boundary.events, 'waveComplete')
    while (state.phase === 'ceremony') {
      const current = state.introductionCeremony!
      const result = tick(state, input({
        ceremonyToneAck: current.toneStatus === 'pending' ? ack(state, true) : null,
      }), INTRODUCTION_DURATION_MS, () => 0.5)
      waveCompleteCount += eventCount(result.events, 'waveComplete')
      state = result.state
    }
    assert.equal(waveCompleteCount, 1)
    assert.equal(state.wave, 2)
  }
})

check('all reachable unlock notes have exact direct piano keys', () => {
  assert.equal(INTRO_ORDER.length, 15)
  assert.deepEqual([...INTRO_ORDER].sort(), [...KEYBOARD_ORDER].sort())
})

check('three-file product ceiling and frozen observer/sibling boundary', () => {
  const changed = execFileSync('git', ['diff', '--name-only', BASE, '--', 'src'], { encoding: 'utf8' })
    .trim().split(/\r?\n/).filter(Boolean).sort()
  assert.deepEqual(changed, [
    'src/components/PitchDefender/RetroBlasterII.tsx',
    'src/components/PitchDefender/retroBlasterEngine.ts',
    'src/components/PitchDefender/retroBlasterRenderer.ts',
  ])
  const currentAudio = readFileSync('src/components/PitchDefender/audioEngine.ts', 'utf8').replace(/\r\n/g, '\n')
  const baseAudio = execFileSync('git', ['show', `${BASE}:src/components/PitchDefender/audioEngine.ts`], { encoding: 'utf8' }).replace(/\r\n/g, '\n')
  assert.equal(currentAudio, baseAudio)
})

check('shell contract pins active-frame ack ownership, inert gameplay keys, and ceremony-only quit', () => {
  const shell = readFileSync('src/components/PitchDefender/RetroBlasterII.tsx', 'utf8')
  assert.match(shell, /gameplayActive[\s\S]*?pendingCeremonyToneAckRef\.current/)
  assert.match(shell, /activeCeremony\?\.toneStatus === 'pending'/)
  assert.match(shell, /result\.state\.phase === 'playing'[\s\S]*?result\.state\.phase === 'ceremony'/)
  assert.match(shell, /phase === 'ceremony'[\s\S]*?RETRY SIGNAL[\s\S]*?REPLAY SIGNAL[\s\S]*?QUIT/)
  assert.match(shell, /gs\.phase !== 'playing'/)
})

console.log(JSON.stringify({
  status: 'PASS',
  fixture: 'R8b NEW SIGNAL',
  assertions: rows.length,
  rows,
}, null, 2))
