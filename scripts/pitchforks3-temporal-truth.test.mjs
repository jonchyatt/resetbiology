import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sourcePath = new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url)

function loadBuildViewState() {
  const source = readFileSync(sourcePath, 'utf8')
  const start = source.indexOf('function buildViewState(')
  const end = source.indexOf('\nfunction freezeViewStateForDebug', start)
  assert.notEqual(start, -1, 'buildViewState must exist')
  assert.notEqual(end, -1, 'buildViewState boundary must exist')

  const executable = source
    .slice(start, end)
    .replace(
      'function buildViewState(args: BuildViewStateArgs): ViewState',
      'function buildViewState(args)',
    )
    .replace(
      'const receiptNoteStyles: Record<string, NoteChipPalette> = {}',
      'const receiptNoteStyles = {}',
    )

  return Function(
    'noteChipPalette',
    'createNote',
    'currentR',
    'retrievability',
    'hueForNote',
    'clamp',
    'STRIKE_IMPACT_START',
    `${executable}\nreturn buildViewState`,
  )(
    () => ({}),
    () => ({}),
    () => 1,
    () => 1,
    () => 180,
    (value, min, max) => Math.max(min, Math.min(max, value)),
    0.74,
  )
}

const buildViewState = loadBuildViewState()

function makeVillager({
  id = 1,
  notes = ['C4', 'A4'],
  burned = 1,
  state = 'walking',
  spawnIndex = 0,
} = {}) {
  return {
    id,
    totalTines: notes.length,
    x: 0,
    y: 0,
    speed: 0,
    notes,
    burned,
    state,
    spawnIndex,
    attackTimer: 1,
    attackTimerMax: 2,
    sequenceCued: true,
    walkFrame: 0,
    ashTimer: 1,
  }
}

function makeBolt({ villagerId = 1, tineIndex = 0, note = 'C4', age = 0.5 } = {}) {
  return {
    fromX: 0,
    fromY: 0,
    pivotX: 0,
    pivotY: 0,
    toX: 0,
    toY: 0,
    life: age * 0.72,
    maxLife: 0.72,
    seed: 1,
    hue: 180,
    note,
    villagerId,
    tineIndex,
  }
}

function makeArgs({
  villagers = [makeVillager()],
  bolt = makeBolt(),
  activeVillager = villagers[0],
  activeTineIndex = 1,
  activeNote = 'A4',
  prompt = 'Now: A4',
} = {}) {
  const active = activeVillager
    ? {
        villager: activeVillager,
        tineIndex: activeTineIndex,
        note: activeNote,
        key: `${activeVillager.id}:${activeTineIndex}`,
      }
    : null

  return {
    runtime: {
      animClock: 0,
      gameOver: false,
      villagers,
      bolts: bolt ? [bolt] : [],
      bursts: [],
      wave: 1,
      health: 3,
      score: 0,
      streak: 0,
      bannerTimer: 0,
    },
    phase: 'playing',
    active,
    activeVillagerId: activeVillager?.id ?? -1,
    activeKey: active?.key ?? '',
    chargeProgress: 0,
    tint: null,
    noteNamesVisible: true,
    staffNotationVisible: false,
    synesthesiaOn: false,
    reducedMotion: false,
    timersPaused: false,
    prompt,
    tuner: {
      visible: true,
      now: 0,
      targetNote: activeNote,
      sourceNote: activeNote,
      canUseSource: true,
      dotDeviation: 0,
      renderDeviation: 0,
      onTarget: true,
      trail: [],
    },
    ceremony: { active: false, note: null, toneFired: false, tonePulseKey: 0 },
    noteMastered: null,
    noteMasteredAgeMs: 0,
    waveReceipt: { visible: false, timer: 0, heard: [], sung: [], mastered: [] },
    frankReaction: null,
    shake: { x: 0, y: 0 },
    fsrsMemory: {},
  }
}

function promptNote(view) {
  return /^(?:Listen|Replay|Sing|Now|Strike):\s+(.+)$/.exec(view.prompt.text)?.[1] ?? null
}

function visibleTineNote(view) {
  if (!view.active) return null
  const villager = view.villagers.find(candidate => candidate.id === view.active.villagerId)
  return villager?.notes[villager.visualBurn] ?? null
}

function assertTemporalTruth(view, expectedNote) {
  assert.equal(view.active?.note ?? null, expectedNote, 'active owner')
  assert.equal(promptNote(view), expectedNote, 'prompt owner')
  assert.equal(view.tuner.targetNote, expectedNote, 'tuner owner')
  assert.equal(visibleTineNote(view), expectedNote, 'visible tine owner')
}

test('pre-impact strike keeps every child-facing surface on the struck tine', () => {
  const view = buildViewState(makeArgs({ bolt: makeBolt({ age: 0.5 }) }))
  assertTemporalTruth(view, 'C4')
})

test('impact handoff atomically moves every child-facing surface to the next tine', () => {
  const view = buildViewState(makeArgs({ bolt: makeBolt({ age: 0.8 }) }))
  assertTemporalTruth(view, 'A4')
})

test('stale cue copy is rebound to the current visual owner', () => {
  const view = buildViewState(makeArgs({ bolt: null, prompt: 'Listen: C4' }))
  assertTemporalTruth(view, 'A4')
})

test('between-villager handoff does not let the old impact bolt own the new target', () => {
  const oldVillager = makeVillager({ id: 1, burned: 2, state: 'ash' })
  const nextVillager = makeVillager({ id: 2, notes: ['G4', 'E4'], burned: 0, spawnIndex: 1 })
  const view = buildViewState(makeArgs({
    villagers: [oldVillager, nextVillager],
    bolt: makeBolt({ villagerId: 1, tineIndex: 1, note: 'A4', age: 0.8 }),
    activeVillager: nextVillager,
    activeTineIndex: 0,
    activeNote: 'G4',
    prompt: 'Sing: G4',
  }))
  assertTemporalTruth(view, 'G4')
})

test('wave-boundary handoff exposes no expired visual owner', () => {
  const view = buildViewState(makeArgs({
    villagers: [makeVillager({ burned: 2, state: 'ash' })],
    bolt: makeBolt({ tineIndex: 1, note: 'A4', age: 0.8 }),
    activeVillager: null,
    activeNote: null,
    prompt: 'Strike: A4',
  }))
  assert.equal(view.active, null)
  assert.equal(view.prompt.visible, false)
  assert.equal(view.tuner.targetNote, null)
})

test('dead target remains visually alive through the authored pre-impact receipt', () => {
  const view = buildViewState(makeArgs({
    villagers: [makeVillager({ burned: 2, state: 'ash' })],
    bolt: makeBolt({ tineIndex: 1, note: 'A4', age: 0.5 }),
    activeVillager: null,
    activeNote: null,
    prompt: 'Strike: A4',
  }))
  assertTemporalTruth(view, 'A4')
  assert.equal(view.villagers[0].visualState, 'walking')
})
