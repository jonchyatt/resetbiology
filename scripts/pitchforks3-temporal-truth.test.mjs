import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sourcePath = new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url)

function loadBuildViewState() {
  const source = readFileSync(sourcePath, 'utf8')
  const impactMatch = /const STRIKE_IMPACT_START\s*=\s*([0-9]+(?:\.[0-9]+)?)/.exec(source)
  assert.ok(impactMatch, 'STRIKE_IMPACT_START must be readable from the source')
  const strikeImpactStart = Number(impactMatch[1])
  assert.ok(Number.isFinite(strikeImpactStart), 'STRIKE_IMPACT_START must be numeric')
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

  const pendingMatch = /const strikePresentationPending = useCallback\(\(\) => \{([\s\S]*?)\r?\n  \}, \[\]\)/.exec(source)
  assert.ok(pendingMatch, 'strikePresentationPending callback must be extractable')
  const strikeRuntime = { current: { bolts: [] } }
  const strikePresentationPending = Function(
    'runtimeRef',
    'STRIKE_IMPACT_START',
    `return function strikePresentationPending() {${pendingMatch[1]}\n}`,
  )(strikeRuntime, strikeImpactStart)

  const buildViewState = Function(
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
    strikeImpactStart,
  )

  return { buildViewState, source, strikeImpactStart, strikePresentationPending, strikeRuntime }
}

const { buildViewState, source, strikeImpactStart, strikePresentationPending, strikeRuntime } = loadBuildViewState()

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

function makeBolt({ villagerId = 1, tineIndex = 0, note = 'C4', age = 0.2 } = {}) {
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
      feedback: activeNote
        ? {
            kind: 'on-target',
            headline: `A4 HEARD · ${activeNote} TARGET`,
            detail: 'ON TARGET · HOLD',
            compactLabel: `A4 → ${activeNote}: hold`,
          }
        : {
            kind: 'waiting',
            headline: 'READY FOR THE NEXT FORK',
            detail: 'Listen for the target',
            compactLabel: 'ready...',
          },
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

function strikeFeedback(note) {
  return {
    kind: 'locked',
    headline: `STRIKE · ${note}`,
    detail: 'Watch the lightning reach the fork',
    compactLabel: `strike: ${note}`,
  }
}

test('loader extracts the authored impact boundary from source', () => {
  assert.equal(strikeImpactStart, 0.42)
  assert.match(source, /const STRIKE_IMPACT_START\s*=\s*0\.42/)
})

test('pre-impact strike keeps every child-facing surface on the struck tine', () => {
  const view = buildViewState(makeArgs({ bolt: makeBolt({ age: 0.2 }) }))
  assertTemporalTruth(view, 'C4')
  assert.deepEqual(view.tuner.feedback, strikeFeedback('C4'))
})

test('impact handoff atomically moves every child-facing surface to the next tine', () => {
  const view = buildViewState(makeArgs({ bolt: makeBolt({ age: 0.8 }) }))
  assertTemporalTruth(view, 'A4')
  assert.deepEqual(view.tuner.feedback, {
    kind: 'on-target',
    headline: 'A4 HEARD · A4 TARGET',
    detail: 'ON TARGET · HOLD',
    compactLabel: 'A4 → A4: hold',
  })
})

test('strike feedback flips exactly at the authored impact boundary', () => {
  const before = buildViewState(makeArgs({ bolt: makeBolt({ age: strikeImpactStart - 0.001 }) }))
  const at = buildViewState(makeArgs({ bolt: makeBolt({ age: strikeImpactStart }) }))
  assert.deepEqual(before.tuner.feedback, strikeFeedback('C4'))
  assert.deepEqual(at.tuner.feedback, {
    kind: 'on-target',
    headline: 'A4 HEARD · A4 TARGET',
    detail: 'ON TARGET · HOLD',
    compactLabel: 'A4 → A4: hold',
  })
})

test('descending strike feedback follows the high-to-low owner handoff', () => {
  const villager = makeVillager({ notes: ['A4', 'C4'], burned: 1 })
  const makeDescendingArgs = age => makeArgs({
    villagers: [villager],
    bolt: makeBolt({ tineIndex: 1, note: 'A4', age }),
    activeVillager: villager,
    activeTineIndex: 0,
    activeNote: 'C4',
    prompt: 'Now: C4',
  })
  const before = buildViewState(makeDescendingArgs(0.2))
  const after = buildViewState(makeDescendingArgs(0.8))
  assertTemporalTruth(before, 'A4')
  assert.deepEqual(before.tuner.feedback, strikeFeedback('A4'))
  assertTemporalTruth(after, 'C4')
  assert.equal(after.tuner.feedback.compactLabel, 'A4 → C4: hold')
})

test('stale cue copy is rebound to the current visual owner', () => {
  const view = buildViewState(makeArgs({ bolt: null, prompt: 'Listen: C4' }))
  assertTemporalTruth(view, 'A4')
  assert.equal(view.tuner.feedback.kind, 'on-target')
  assert.equal(view.tuner.feedback.compactLabel, 'A4 → A4: hold')
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
  assert.equal(view.tuner.feedback.kind, 'on-target')
  assert.equal(view.tuner.feedback.compactLabel, 'A4 → G4: hold')
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
  assert.equal(view.tuner.feedback.kind, 'waiting')
})

test('dead target remains visually alive through the authored pre-impact receipt', () => {
  const view = buildViewState(makeArgs({
    villagers: [makeVillager({ burned: 2, state: 'ash' })],
    bolt: makeBolt({ tineIndex: 1, note: 'A4', age: 0.2 }),
    activeVillager: null,
    activeNote: null,
    prompt: 'Strike: A4',
  }))
  assertTemporalTruth(view, 'A4')
  assert.equal(view.villagers[0].visualState, 'walking')
  assert.deepEqual(view.tuner.feedback, strikeFeedback('A4'))
})

test('extracted pending guard follows the exact bolt impact boundary', () => {
  strikeRuntime.current.bolts = []
  assert.equal(strikePresentationPending(), false)
  strikeRuntime.current.bolts = [makeBolt({ age: strikeImpactStart - 0.001 })]
  assert.equal(strikePresentationPending(), true)
  strikeRuntime.current.bolts = [makeBolt({ age: strikeImpactStart })]
  assert.equal(strikePresentationPending(), false)
  strikeRuntime.current.bolts = [makeBolt({ age: strikeImpactStart + 0.001 })]
  assert.equal(strikePresentationPending(), false)
})

test('strike suppression audit samples before the new bolt exists', () => {
  const strikeStart = source.indexOf('const strikeActiveTine = useCallback')
  const snapshot = source.indexOf('const wasMatchingSuppressed = matchingSuppressedNow()', strikeStart)
  const boltInsert = source.indexOf('addBolt(villager, tineIndex, strikeHue, strikeNote)', strikeStart)
  const audit = source.indexOf('if (wasMatchingSuppressed) lockWhileSuppressedRef.current = true', strikeStart)
  assert.ok(strikeStart >= 0 && snapshot > strikeStart && boltInsert > snapshot && audit > boltInsert)

  const events = []
  const wasMatchingSuppressed = (() => {
    events.push('suppression-read')
    return false
  })()
  events.push('bolt-insert')
  if (wasMatchingSuppressed) events.push('illegal-lock-audit')
  assert.deepEqual(events, ['suppression-read', 'bolt-insert'])
})

test('strike presentation guards suppress matching and cue changes before the owner handoff', () => {
  const matchingStart = source.indexOf('const matchingSuppressedNow = useCallback')
  const matchingEnd = source.indexOf('\n  const syncSparkGuideStatus', matchingStart)
  assert.ok(matchingStart >= 0 && matchingEnd > matchingStart, 'matching suppression callback must exist')
  assert.match(source.slice(matchingStart, matchingEnd), /strikePresentationPending\(\)/)

  const processStart = source.indexOf('const processLock = useCallback')
  const targetStart = source.indexOf('const target = getActiveTarget()', processStart)
  assert.ok(processStart >= 0 && targetStart > processStart, 'processLock target lookup must exist')
  assert.match(
    source.slice(processStart, targetStart),
    /if \(strikePresentationPending\(\)\) \{[\s\S]*?lockHeldMsRef\.current = 0[\s\S]*?lockProgressRef\.current = 0[\s\S]*?return/,
  )

  const sequenceStart = source.indexOf('const playVillagerSequence = useCallback')
  const sequenceClear = source.indexOf('clearCueTimers()', sequenceStart)
  assert.ok(sequenceStart >= 0 && sequenceClear > sequenceStart, 'playVillagerSequence cue reset must exist')
  assert.match(source.slice(sequenceStart, sequenceClear), /if \(strikePresentationPending\(\)\) return/)

  const replayTestId = source.indexOf('data-testid="pf3-replay-notes"')
  const replayStart = source.lastIndexOf('<button', replayTestId)
  const replayEnd = source.indexOf('</button>', replayTestId)
  assert.ok(replayStart >= 0 && replayEnd > replayStart, 'replay button must exist')
  const replayBlock = source.slice(replayStart, replayEnd)
  assert.match(replayBlock, /disabled=\{cuePlaybackActive \|\| strikePresentationPending\(\)\}/)
  assert.match(replayBlock, /if \(strikePresentationPending\(\)\) return/)
})
