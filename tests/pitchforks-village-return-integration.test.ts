/** Harness-only: runs production callback bodies, not React, a microphone or a browser.
 * Run: npx tsx --test tests/pitchforks-village-return-integration.test.ts
 * FSRS target selection and audio hardware are controlled ports; queue, lesson,
 * receipt and level-outcome helpers are real. Missing callback dependencies fail.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
import * as queue from '../src/components/PitchDefender/villageReturnQueue'
import { selectVillageLessonCandidate } from '../src/components/PitchDefender/villageLessonSelector'
import { recordVillagePractice } from '../src/components/PitchDefender/villagePractice'
import { createPitchforksLevelProgress, recordPitchforksLevelOutcome } from '../src/components/PitchDefender/pitchforksLevelProgress'
import { noteToFreq } from '../src/components/PitchDefender/pitchMath'

const source = readFileSync(new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url), 'utf8')
const ast = ts.createSourceFile('PitchforksIII.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

function executable(name: string, throughRunReset = false): string {
  const matches: ts.Node[] = []
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name && node.initializer &&
      ts.isCallExpression(node.initializer) && node.initializer.expression.getText(ast) === 'useCallback') {
      const body = node.initializer.arguments[0]
      assert.ok(ts.isArrowFunction(body) || ts.isFunctionExpression(body))
      matches.push(body)
    }
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) matches.push(node)
    ts.forEachChild(node, visit)
  }
  visit(ast)
  assert.equal(matches.length, 1, `one real production declaration for ${name}`)
  let text = matches[0].getText(ast).replace(/^export\s+/, '')
  if (throughRunReset) {
    const callback = matches[0] as ts.ArrowFunction
    assert.ok(ts.isBlock(callback.body))
    const statements = [...callback.body.statements]
    const end = statements.findIndex(statement => ts.isExpressionStatement(statement) &&
      ts.isBinaryExpression(statement.expression) &&
      statement.expression.left.getText(ast) === 'completedVillageEncounterCountRef.current' &&
      statement.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken)
    assert.ok(end >= 0, `${name} has a direct run reset`)
    // Execute the contiguous production prefix, including guards and ordering.
    // Later rendering/audio/mic setup is deliberately outside this lifecycle slice.
    text = `() => { ${statements.slice(0, end + 1).map(statement => statement.getText(ast)).join('\n')} }`
  }
  return ts.transpileModule(`(${text})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
}

const ref = <T,>(current: T) => ({ current })
const noop = () => {}

function harness() {
  let now = 0
  let timerId = 0
  let active: any = null
  let chosenNote = 'F4'
  let audioEmits = true
  const timers = new Map<number, { at: number; fn: () => void }>()
  const tones: string[] = []
  const saves: any[] = []
  const forbidden = () => { throw new Error('Village practice leaked into ordinary FSRS/mastery') }
  // Explicit fixtures only. There is no permissive fallback for unknown refs/helpers.
  const env: any = {
    ...queue, selectVillageLessonCandidate, recordVillagePractice, recordPitchforksLevelOutcome, noteToFreq,
    performance: { now: () => now }, Date: { now: () => 1_800_000_000_000 + now },
    runtimeRef: ref({ spawned: 0, wave: 1, plan: { count: 100, tineCounts: Array(100).fill(1), speed: 1 }, villagers: [], firstVillagerId: null }),
    runGenerationRef: ref(1), villageReturnQueueRef: ref(queue.createVillageReturnQueue('village-return:1')),
    villageReturnOffersRef: ref(new Map()), villageReturnContextPlayedRef: ref(new Set()),
    completedVillageEncounterCountRef: ref(0), presentationVisitCountByTargetRef: ref(new Map()),
    rangeProfileRef: ref({ lowNote: 'D4', highNote: 'A4' }),
    presentationJourneyRef: ref({ startedAt: 'journey', guidedNotes: ['D4', 'F4'], unlockedNotes: ['D4', 'F4'], villagePractice: [] }),
    unlockedNotesRef: ref(['D4', 'F4']), inputModeRef: ref('voice'), isListeningRef: ref(true),
    demoRef: ref(false), bossSimulatingRef: ref(false), galvanicProofRef: ref(false), bellProofRef: ref(false),
    closeSmashProofRef: ref(false), nextIdRef: ref(40), assetsRef: ref({ villagerMeta: {} }),
    defaultVillagerMeta: { frame_w: 1, frame_h: 1 }, SPRITE_SCALE: 1, W: 800, GROUND_Y: 400,
    pickVillagerNotes: () => [chosenNote], attackTimeForWave: () => 10, villagerEntryX: () => 800,
    createTorchState: () => ({}), createInactiveTorchState: () => ({}), ensureActiveNoteMemory: noop,
    normalBellRouteAvailable: () => !env.demoRef.current && !env.bossSimulatingRef.current,
    normalVillageLessonAvailable: () => !env.demoRef.current && !env.bossSimulatingRef.current,
    galvanicOwnsInput: () => env.galvanicProofRef.current,
    getActiveTarget: () => active, latencyForTarget: () => 500,
    levelProgressRef: ref(createPitchforksLevelProgress()), failureGradedKeysRef: ref(new Set()),
    cueSupportByTargetRef: ref(new Map()), hintedTargetKeysRef: ref(new Set()), waveNotesSungRef: ref(new Set()),
    reconcileCampaignProgress: noop, setLevelProgress: noop, setPresentationJourney: noop, getMasterySessionId: () => 'session',
    savePresentationJourney: (journey: any) => saves.push(journey), acceptNormalBellCombatResponse: noop,
    gradeVoice: forbidden, gradeEar: forbidden, saveFsrs: forbidden, recordMasteryProgressForReview: forbidden,
    strikePresentationPending: () => false, matchingSuppressedNow: () => now < env.matchingSuppressedUntilRef.current,
    cuePlayingNow: () => now < env.cuePlayingUntilRef.current,
    matchingSuppressedUntilRef: ref(0), cuePlayingUntilRef: ref(0), timersPausedRef: ref(false),
    buttonTrialRef: ref(null), audioCueRef: ref(true), cueVolumeRef: ref(100), pianoSamplesReadyRef: ref(true),
    firstMinuteCoachRef: ref({ beat: 'complete' }), activeCueContextRef: ref({ support: 'recall' }),
    waveNotesHeardRef: ref(new Set()), demoStepRef: ref(''), phaseRef: ref('playing'),
    activeVillagerIdRef: ref(null), activePromptKeyRef: ref(''), promptStartedAtRef: ref(0), cueTimeoutsRef: ref([]),
    TONE_SPACING_MS: 500, TONE_MS: 300, ECHO_TAIL_MS: 100, TONE_SUPPRESS_MS: 350,
    setFirstMinuteCoachSnapshot: noop, setPromptText: noop, setButtonFeedback: noop,
    presentMusicalPrompt: noop, recordSparkGuideEvent: noop, setPianoVolume: noop, markToneEmitted: noop,
    playPianoNote: (note: string, options: any) => { assert.equal(options.exact, true); tones.push(note); return audioEmits },
    clearCueTimers: () => { timers.clear(); env.cueTimeoutsRef.current = [] },
    setTimeout: (fn: () => void, delay = 0) => { const id = ++timerId; timers.set(id, { at: now + delay, fn }); return id },
    clearNextWaveTimer: noop, resetCloseSmash: noop, resetThunderhead: noop, resetBellWave: noop,
    resetNormalBellPowerForRun: noop, resetGalvanic: noop, clearWaveReceipt: noop,
    fixedWaveDirector: () => ({ count: 100, tineCounts: Array(100).fill(1), speed: 1 }),
    masteryProgressRef: ref({}), earFsrsRef: ref({}), waveStartedAtRef: ref(0),
    createRainState: () => ({}), rainActivationRequestedRef: ref(false), rainUiSignatureRef: ref(''),
    setRainState: noop, activeKeyRef: ref(''), lockHeldMsRef: ref(0), lockProgressRef: ref(0), tintRef: ref(null), setHud: noop,
    resetLevelProgress: (wave: number) => { env.levelProgressRef.current = createPitchforksLevelProgress(wave) },
    bossWorldRef: ref(null), bossPracticeOnlyRef: ref(false), bossControllerRef: ref(null), bossIdentityRef: ref(null), setBossIdentity: noop, setBossState: noop,
    setBossAudioBusy: noop, rafRef: ref(null), cancelAnimationFrame: noop, setPhase: noop, resumeCueAudioFromGesture: noop,
  }
  const spawnCallback = runInNewContext(executable('spawnVillager'), env)
  const review = runInNewContext(executable('reviewTargetNote'), env)
  const play = runInNewContext(executable('playVillagerSequence'), env)
  const display = runInNewContext(executable('projectVillageReturnDisplay'), env)
  const startWave = runInNewContext(executable('startWave'), env)
  const beginPlayingReset = runInNewContext(executable('beginPlaying', true), env)
  const quitToMenuReset = runInNewContext(executable('quitToMenu', true), env)
  function advance(ms: number) {
    const end = now + ms
    for (let iterations = 0; ; iterations++) {
      assert.ok(iterations < 1000, 'timers must settle')
      const next = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
      if (!next) break
      now = next[1].at; timers.delete(next[0]); next[1].fn()
    }
    now = end
  }
  function activate(target: any) { active = target; env.activeVillagerIdRef.current = target.villager.id }
  function spawn(note = 'F4') {
    chosenNote = note; spawnCallback()
    const villager = env.runtimeRef.current.villagers.at(-1)
    assert.equal(villager.notes[0], note, 'spawn must preserve the selected literal FSRS target')
    const target = { villager, note, key: `${villager.id}:0`, tineIndex: 0 }
    activate(target)
    return target
  }
  function complete() { const t = spawn(); assert.equal(review(t, true), true); return t }
  function due() {
    const introduction = complete()
    for (let i = 0; i < 3; i++) complete()
    advance(90_000)
    const target = spawn()
    assert.equal(target.villager.supportedLesson.support, 'UNAIDED_RETURN')
    return { introduction, target }
  }
  return { env, spawn, review, play, display, advance, activate, complete, due, tones, saves,
    startWave, beginPlayingReset, quitToMenuReset,
    setAudioEmits: (value: boolean) => { audioEmits = value },
    rows: () => env.presentationJourneyRef.current.villagePractice as any[],
  }
}

test('actual spawn/review: both delay gates, one-shot count, pre-render concealment, emitted context and separate receipt', () => {
  const h = harness()
  const first = h.complete()
  assert.equal(h.env.completedVillageEncounterCountRef.current, 1)
  assert.equal(h.review(first, true), false)
  assert.equal(h.env.completedVillageEncounterCountRef.current, 1)
  assert.equal(h.rows()[0].encounterIndex, 1, 'actor ID 41 is not the encounter counter')
  h.complete(); h.complete(); h.complete()
  h.advance(89_999)
  assert.equal(h.spawn().villager.supportedLesson.support, 'SUPPORTED')
  h.advance(1)
  const target = h.spawn()
  assert.equal(target.villager.supportedLesson.support, 'UNAIDED_RETURN')
  assert.equal(h.display(target.villager, {}, new Set()).answerVisible, false)
  const duplicate = h.spawn()
  assert.equal(duplicate.villager.supportedLesson.support, 'SUPPORTED')
  assert.equal(h.env.villageReturnOffersRef.current.size, 1)
  h.activate(target); h.play(target.villager, 'cue')
  assert.equal(h.env.villageReturnContextPlayedRef.current.has(target.key), false, 'scheduling is not emission')
  h.advance(0)
  assert.deepEqual(h.tones, ['D4'], 'automatic return plays context, never target')
  assert.equal(h.env.villageReturnContextPlayedRef.current.has(target.key), true)
  assert.equal(h.review(target, true), false, 'speaker echo window blocks review')
  h.advance(1000)
  assert.equal(h.review(target, true), true)
  assert.deepEqual(h.rows().map(r => r.support), ['SUPPORTED', 'UNAIDED_RETURN'])
  assert.equal(h.rows()[1].introducedEncounterIndex, 1)
  assert.equal(h.rows()[1].cueFree, true)
  assert.equal(h.env.villageReturnQueueRef.current.entries[0].status, 'done')
  assert.equal(h.review(target, true), false)
  assert.equal(h.saves.length, 2)
})

test('90 seconds alone does not replace three completed encounters', () => {
  const h = harness(); h.complete(); h.advance(90_000)
  for (let i = 0; i < 3; i++) assert.equal(h.spawn().villager.supportedLesson.support, 'SUPPORTED')
  assert.equal(h.env.completedVillageEncounterCountRef.current, 1)
  h.complete(); h.complete(); h.complete()
  assert.equal(h.spawn().villager.supportedLesson.support, 'UNAIDED_RETURN')
})

for (const reason of ['muted', 'disabled', 'samples-unready', 'playback-failed', 'other-target', 'muted-after-scheduling'] as const) {
  test(`actual audio callback: ${reason} cannot mint context evidence or unaided success`, () => {
    const h = harness(); const { target } = h.due()
    h.env.waveNotesHeardRef.current.add('D4') // Another encounter's heard-set is insufficient.
    if (reason === 'muted') h.env.cueVolumeRef.current = 0
    if (reason === 'disabled') h.env.audioCueRef.current = false
    if (reason === 'samples-unready') h.env.pianoSamplesReadyRef.current = false
    if (reason === 'playback-failed') h.setAudioEmits(false)
    h.play(target.villager, 'cue')
    if (reason === 'muted-after-scheduling') h.env.cueVolumeRef.current = 0
    if (reason === 'other-target') h.spawn()
    h.advance(1000); h.activate(target)
    assert.equal(h.env.villageReturnContextPlayedRef.current.has(target.key), false)
    assert.equal(h.review(target, true), true)
    assert.equal(h.rows().some(r => r.support === 'UNAIDED_RETURN'), false)
    assert.equal(h.env.villageReturnQueueRef.current.entries[0].attempt, 'retry')
  })
}

for (const hinted of [false, true]) {
  test(`actual review: ${hinted ? 'hinted success' : 'failure'} permits one delayed supported retry only`, () => {
    const h = harness(); const { target } = h.due()
    h.play(target.villager, 'cue'); h.advance(1000)
    if (hinted) {
      h.play(target.villager, 'replay')
      assert.equal(h.env.hintedTargetKeysRef.current.has(target.key), true, 'hint precedes scheduled target')
      assert.equal(h.display(target.villager, {}, h.env.hintedTargetKeysRef.current).answerVisible, true)
      h.advance(1000)
      assert.deepEqual(h.tones, ['D4', 'D4', 'F4'])
    }
    assert.equal(h.review(target, hinted), true)
    const retry = h.env.villageReturnQueueRef.current.entries[0]
    assert.equal(retry.attempt, 'retry'); assert.equal(retry.status, 'pending')
    assert.equal(h.review(target, true), false)
    h.complete(); h.complete(); h.complete()
    h.advance(89_999)
    const early = h.spawn()
    assert.equal(h.env.villageReturnOffersRef.current.has(early.key), false)
    h.advance(1)
    const next = h.spawn()
    assert.equal(h.env.villageReturnOffersRef.current.get(next.key).attempt, 'retry')
    assert.equal(next.villager.supportedLesson.support, 'SUPPORTED')
    assert.equal(h.review(next, true), true)
    assert.equal(h.env.villageReturnQueueRef.current.entries[0].status, 'exhausted')
    h.complete(); h.complete(); h.complete(); h.advance(90_000)
    assert.equal(h.env.villageReturnOffersRef.current.has(h.spawn().key), false)
    assert.equal(h.rows().some(r => r.support === 'UNAIDED_RETURN'), false)
  })
}

test('durable supported pair-cap no-op still creates a fresh run queue introduction', () => {
  const prior = harness(); prior.complete()
  const h = harness()
  h.env.presentationJourneyRef.current.villagePractice = prior.rows().map(r => ({ ...r, eventId: 'old-event', sessionId: 'old-session' }))
  h.complete()
  assert.equal(h.rows().length, 1); assert.equal(h.saves.length, 0)
  assert.equal(h.env.villageReturnQueueRef.current.entries.length, 1)
  assert.equal(h.env.villageReturnQueueRef.current.entries[0].enqueuedAtCompletedEncounterCount, 1)
})

test('stale run audio and review callbacks cannot resolve an old reservation', () => {
  const h = harness(); const { target } = h.due()
  h.play(target.villager, 'cue')
  h.env.runGenerationRef.current++
  h.advance(1000)
  assert.deepEqual(h.tones, [])
  assert.equal(h.env.villageReturnContextPlayedRef.current.size, 0)
  const count = h.env.completedVillageEncounterCountRef.current
  assert.equal(h.review(target, true), false)
  assert.equal(h.env.completedVillageEncounterCountRef.current, count)
  assert.equal(h.rows().length, 1)
})

test('a second reserved pair sharing the target retains its own unaided identity', () => {
  const h = harness()
  h.env.unlockedNotesRef.current = ['D4', 'F4', 'A4']
  h.env.presentationJourneyRef.current.unlockedNotes = ['D4', 'F4', 'A4']
  h.complete() // D4 -> F4, minor third
  h.complete() // A4 -> F4, major third
  h.complete(); h.complete(); h.complete(); h.advance(90_000)
  const first = h.spawn()
  const second = h.spawn()
  assert.equal(first.villager.supportedLesson.contextNote, 'D4')
  assert.equal(second.villager.supportedLesson.contextNote, 'A4')
  assert.equal(h.env.villageReturnOffersRef.current.size, 2)
  h.play(second.villager, 'cue'); h.advance(1000)
  assert.equal(h.review(second, true), true)
  assert.ok(h.rows().some(r => r.contextNote === 'A4' && r.support === 'UNAIDED_RETURN'),
    'review must validate this reservation, not reselect the first pending pair for F4')
})

test('stale target after run reset cannot become a fresh supported introduction', () => {
  const h = harness(); const { target } = h.due()
  h.beginPlayingReset() // Contiguous production callback statements, not a modeled reset.
  h.env.levelProgressRef.current = createPitchforksLevelProgress()
  h.spawn()
  assert.equal(h.review(target, true), false, 'clearing reservations must not erase stale-target protection')
  assert.equal(h.env.completedVillageEncounterCountRef.current, 0)
  assert.equal(h.env.villageReturnQueueRef.current.entries.length, 0)
})

test('actual startWave preserves queue/count, releases reservations and permits the same pending offer again', () => {
  const h = harness(); const { target } = h.due()
  h.play(target.villager, 'cue'); h.advance(1000)
  const state = h.env.villageReturnQueueRef.current
  const count = h.env.completedVillageEncounterCountRef.current
  const offer = h.env.villageReturnOffersRef.current.get(target.key)
  assert.equal(h.env.villageReturnContextPlayedRef.current.size, 1)
  h.startWave(2)
  assert.equal(h.env.villageReturnQueueRef.current, state)
  assert.equal(h.env.completedVillageEncounterCountRef.current, count)
  assert.equal(h.env.villageReturnOffersRef.current.size, 0)
  assert.equal(h.env.villageReturnContextPlayedRef.current.size, 0)
  const next = h.spawn()
  assert.equal(h.env.villageReturnOffersRef.current.get(next.key).revision, offer.revision)
})

for (const name of ['beginPlayingReset', 'quitToMenuReset'] as const) {
  test(`actual ${name} production prefix resets ephemeral state and preserves durable receipts`, () => {
    const h = harness(); const { target } = h.due()
    const rows = h.rows()
    h.play(target.villager, 'cue'); h.advance(1000)
    const run = h.env.runGenerationRef.current
    h[name]()
    assert.equal(h.env.runGenerationRef.current, run + 1)
    assert.equal(h.env.villageReturnQueueRef.current.runId, `village-return:${run + 1}`)
    assert.equal(h.env.villageReturnQueueRef.current.entries.length, 0)
    assert.equal(h.env.completedVillageEncounterCountRef.current, 0)
    assert.equal(h.env.villageReturnOffersRef.current.size, 0)
    assert.equal(h.env.villageReturnContextPlayedRef.current.size, 0)
    assert.equal(h.rows(), rows)
  })
}
