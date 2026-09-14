/** Harness pass only: actual AST-extracted callbacks + real controller, FSRS, gates,
 * receipt parser and pitch helpers. Hardware, rendering and persistence are explicit ports.
 * Fable 157/158: earned prefix, persisted unaided recital, unlimited supported practice.
 * Run: npx tsx --test tests/pitchforks-examination-integration.test.ts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
import { createPitchforksBossRecital } from '../src/components/PitchDefender/pitchforksBossRecital'
import * as campaign from '../src/components/PitchDefender/pitchforksCampaignProgress'
import { createPitchforksPresentationJourney, parsePitchforksPresentationJourney } from '../src/components/PitchDefender/pitchforksCurriculum'
import { projectPitchforksMastery } from '../src/components/PitchDefender/pitchforksMasteryProjection'
import { isBossAvailable, isWorldUnlocked } from '../src/components/PitchDefender/pitchforks3WorldRegistry'
import { advanceExactPitchHold, exactPitchSampleState, noteToFreq } from '../src/components/PitchDefender/pitchMath'
import { createVillageReturnQueue } from '../src/components/PitchDefender/villageReturnQueue'
import { FSRS_VOICE_KEY, FSRS_EAR_DEBUG_KEY, migrate } from '../src/lib/fsrsFamily'
const root = '../src/components/PitchDefender/'
const parse = (file: string) => ts.createSourceFile(file, readFileSync(new URL(root + file, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const ast = parse('PitchforksIII.tsx')
const songAst = parse('PitchforksSongcraft.tsx')
function extract(name: string, tree = ast) {
  const found: ts.Node[] = []
  function visit(n: ts.Node) {
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) found.push(n)
    if (ts.isVariableDeclaration(n) && n.name.getText(tree) === name && n.initializer) {
      const i = n.initializer
      found.push(ts.isCallExpression(i) && i.expression.getText(tree) === 'useCallback' ? i.arguments[0] : i)
    }
    ts.forEachChild(n, visit)
  }
  visit(tree)
  assert.equal(found.length, 1, `unique production declaration: ${name}`)
  return ts.transpileModule(`(${found[0].getText(tree).replace(/^export\s+/, '')})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
}
const ref = (current: any) => ({ current })
const noop = () => {}
const clone = (v: any) => JSON.parse(JSON.stringify(v))
function harness() {
  let now = Date.now()
  let failSave = false
  const timers = new Map<number, { at: number; fn: () => void }>(); let timerId = 0
  const tones: string[] = []
  const writes: string[] = [], reads: string[] = [], journeys: any[] = [], microphones: string[] = []
  const notes = ['C4', 'E4', 'G4']
  const identity = { version: 1 as const, rangeAssessedAt: '2026-09-13T00:00:00Z', startedAt: '2026-09-13T01:00:00Z' }
  const memory = Object.fromEntries(notes.map(note => [note, { note, S: 21, D: 5, due: now - 1, lastReview: now - 10, lapses: 0, phase: 'review', learningReps: 2 }]))
  let journey = campaign.bindPitchforksVillageCurriculum(createPitchforksPresentationJourney({ ...identity, unlockedNotes: notes }), { lowNote: 'C4', highNote: 'G4' }, now)
  journey = { ...journey, dungeonClear: { ...identity, admittedNotes: notes, clearedAt: now }, villageClear: { ...identity, bindings: journey.villageCurriculum!.bindings, clearedAt: now } }
  const stores = new Map<string, string>([[FSRS_VOICE_KEY, JSON.stringify(memory)]])
  const env: any = {
    ...campaign, createPitchforksBossRecital, projectPitchforksMastery, isBossAvailable, isWorldUnlocked,
    advanceExactPitchHold, exactPitchSampleState, noteToFreq, createVillageReturnQueue, migrate, FSRS_VOICE_KEY, FSRS_EAR_DEBUG_KEY,
    Date: { now: () => Math.max(now, Date.now()) }, performance: { now: () => now }, document: { hidden: false },
    localStorage: { getItem: (key: string) => { reads.push(key); return stores.get(key) ?? null } },
    saveStore: (key: string, value: any) => { writes.push(key); if (failSave) return false; stores.set(key, JSON.stringify(value)); return true },
    loadStore: (key: string) => migrate(key, stores.get(key) ?? null),
    savePresentationJourney: (j: any) => { const parsed = parsePitchforksPresentationJourney(JSON.stringify(j), identity.rangeAssessedAt, notes); assert.ok(parsed); journeys.push(parsed) },
    presentationJourneyRef: ref(journey), rangeProfileRef: ref({ assessedAt: identity.rangeAssessedAt }), unlockedNotesRef: ref(notes),
    fsrsRef: ref(memory), masteryProgressRef: ref(Object.fromEntries(notes.map(n => [n, { sessionIds: ['a', 'b', 'c'], masteredAt: now - 10 }]))),
    assetsRef: ref({ torchmasterChamberPlate: {}, bellringerChamberPlate: {}, bellringerRest: {}, bellTowerPlate: {}, cathedralPlate: {} }),
    bossControllerRef: ref(null), bossWorldRef: ref(null), bossPracticeOnlyRef: ref(false), bossIdentityRef: ref(null), bossReceiptsRef: ref([]),
    bossSupportedPracticeRef: ref(false), bossSimulatingRef: ref(false), bossHoldRef: ref({ heldMs: 0, matched: false }),
    bossHeardClaimRef: ref(null), bossButtonTrialRef: ref(null), bossClockRef: ref(0), bossPitchGenerationRef: ref(null),
    pitchGenerationRef: ref(1), pitchRef: ref(null), isListeningRef: ref(true), micErrorRef: ref(null),
    micSourceHealthRef: ref({ audioContextState: 'running', trackReadyState: 'live', trackMuted: false }),
    inputModeRef: ref('voice'), demoRef: ref(false), fsrsDebugRef: ref(false), runGenerationRef: ref(1),
    villageReturnQueueRef: ref(createVillageReturnQueue('village-return:1')), villageReturnOffersRef: ref(new Map()),
    villageReturnContextPlayedRef: ref(new Set()), completedVillageEncounterCountRef: ref(0),
    presentationVisitCountByTargetRef: ref(new Map()), runtimeRef: ref({}), rafRef: ref(null),
    demoTargetRef: ref(''), demoLockCountRef: ref(0), lastAshAtRef: ref(0), lastTimeRef: ref(0), phaseRef: ref('menu'),
    reducedMotionRef: ref(false), viewStateRef: ref(null), rainActivationRequestedRef: ref(false), rainUiSignatureRef: ref(''), micHudStateRef: ref('waiting'),
    pianoSamplesReadyRef: ref(true), cuePlayingUntilRef: ref(0), matchingSuppressedUntilRef: ref(0), cueTimeoutsRef: ref([]),
    matchingSuppressedNow: () => now < env.matchingSuppressedUntilRef.current,
    startListening: () => { microphones.push('start'); env.isListeningRef.current = true },
    stopListening: () => { microphones.push('stop'); env.isListeningRef.current = false },
    makeInitialRuntime: () => ({}), createRainState: () => ({}), requestAnimationFrame: () => 1,
    setTimeout: (fn: () => void, ms = 0) => { const id = ++timerId; timers.set(id, { at: now + ms, fn }); return id }, clearTimeout: (id: number) => timers.delete(id), playPianoNote: (note: string) => tones.push(note), createPitchforksButtonTrial: () => ({}),
    demoPitchForTarget: () => { throw new Error('earned examination reached simulator') },
  }
  for (const name of ['setBossSimulating', 'setBossState', 'setBossMessage', 'setPresentationJourney', 'setBossIdentity', 'setBossAudioBusy',
    'cancelAnimationFrame', 'clearCueTimers', 'clearNextWaveTimer', 'clearFirstMinuteTimer', 'clearNewNoteCeremony', 'clearNoteMasteredCeremony',
    'clearWaveReceipt', 'resetCloseSmash', 'resetThunderhead', 'resetBellWave', 'resetGalvanic', 'resumeCueAudioFromGesture', 'setPhase', 'loop',
    'renderBossChamber', 'resetSparkGuide', 'resetNormalBellPowerForRun', 'resetRangeMatch', 'setPendingRangeProfile', 'setRangeAssessmentError',
    'setRainState', 'resetLevelProgress', 'setMicHudState']) env[name] = noop
  for (const name of ['FSRS_DEBUG_KEY', 'CONFIDENCE_FLOOR', 'MATCH_TOLERANCE_CENTS', 'HOLD_MS']) env[name] = runInNewContext(extract(name), env)
  env.SONGCRAFT_STALE_AFTER_MS = runInNewContext(extract('SONGCRAFT_STALE_AFTER_MS', songAst), env)
  env.observePitchforksSongcraftGeneration = runInNewContext(extract('observePitchforksSongcraftGeneration', songAst), env)
  for (const name of ['isPitchforksBossId', 'distinctPitchforksAdmittedNotes', 'selectPitchforksBossSequence', 'assessPitchforksBossEntry',
    'clearCueTimers', 'rehearseCampaignRecital', 'acceptBossResult', 'resolveBossNote', 'stepBossChamber', 'beginBossPreview', 'playBossCue', 'quitToMenu']) env[name] = runInNewContext(extract(name), env)
  function enter(world: 'bell-tower' | 'cathedral' = 'bell-tower') { env.beginBossPreview('voice', 'bellringer', world); assert.ok(env.bossControllerRef.current, 'earned entry created controller') }
  function resolve(correct = true) { env.resolveBossNote(correct) }
  function finish() { for (let i = 0; env.bossControllerRef.current.state().status === 'active'; i++) { assert.ok(i < 30); resolve() } }
  function frame(ms = 50, fresh = true) {
    now += ms
    if (fresh) env.pitchGenerationRef.current++
    const note = env.bossControllerRef.current?.state().currentNote
    env.pitchRef.current = { frequency: note ? noteToFreq(note) : 0, confidence: 1, isActive: true }
    env.stepBossChamber(ms / 1000, {})
  }
  return { env, enter, resolve, finish, frame, writes, reads, journeys, microphones, stores, tones, timers,
    failSave: (v: boolean) => { failSave = v }, advance: (ms: number) => { const end = now + ms; for (;;) { const next = [...timers].filter(([, t]) => t.at <= end).sort((a,b) => a[1].at - b[1].at)[0]; if (!next) break; now = next[1].at; timers.delete(next[0]); next[1].fn() } now = end } }
}

for (const [boss, world, count] of [['torchmaster', 'village-gate', 2], ['choirmaster', 'bell-tower', 3]] as const) {
  test(`${boss} normal supporting chamber saves voice practice without campaign writes`, () => {
    const h = harness(), before = clone(h.env.presentationJourneyRef.current)
    h.env.beginBossPreview('voice', boss, world, true)
    assert.equal(h.env.bossControllerRef.current.state().sequence.length, count)
    assert.deepEqual(h.microphones, ['stop', 'start'])
    h.finish()
    assert.deepEqual([...new Set(h.writes)], [FSRS_VOICE_KEY])
    assert.equal(h.journeys.length, 0)
    assert.deepEqual(clone(h.env.presentationJourneyRef.current), before)
  })
  test(`${boss} rejects an unearned world before opening or saving`, () => {
    const h = harness()
    delete h.env.presentationJourneyRef.current.dungeonClear
    h.env.beginBossPreview('voice', boss, world, true)
    assert.equal(h.env.bossControllerRef.current, null)
    assert.deepEqual(h.writes, [])
    assert.deepEqual(h.microphones, [])
  })
}
test('completed recital can be revisited without granting a second award', () => {
  const h = harness(); h.enter(); h.finish()
  const earned = clone(h.env.presentationJourneyRef.current)
  const count = h.journeys.length
  h.env.quitToMenu()
  h.env.beginBossPreview('voice', 'bellringer', 'bell-tower', true)
  h.finish()
  assert.equal(h.journeys.length, count)
  assert.deepEqual(clone(h.env.presentationJourneyRef.current), earned)
})

for (const reason of ['missing-village', 'missing-dungeon', 'unmastered', 'demo', 'debug', 'ear', 'cathedral-early']) {
  test(`actual beginBossPreview rejects ${reason} before lifecycle/storage`, () => {
    const h = harness(), e = h.env
    if (reason === 'missing-village') delete e.presentationJourneyRef.current.villageClear
    if (reason === 'missing-dungeon') delete e.presentationJourneyRef.current.dungeonClear
    if (reason === 'unmastered') e.masteryProgressRef.current = {}
    if (reason === 'demo') e.demoRef.current = true
    if (reason === 'debug') e.fsrsDebugRef.current = true
    if (reason === 'ear') e.inputModeRef.current = 'ear'
    e.beginBossPreview('voice', 'bellringer', reason === 'cathedral-early' ? 'cathedral' : 'bell-tower')
    assert.equal(e.bossControllerRef.current, null); assert.equal(e.runGenerationRef.current, 1)
    assert.deepEqual(h.reads, []); assert.deepEqual(h.microphones, [])
  })
}
test('earned Bell then Cathedral: exact frozen sequence, real mic route, normal key and durable complete', () => {
  const h = harness(); h.enter()
  assert.deepEqual(clone(h.env.bossControllerRef.current.state().sequence), h.env.presentationJourneyRef.current.villageClear.bindings.flatMap((b: any) => [b.contextNote, b.targetNote]))
  assert.deepEqual(h.microphones, ['stop', 'start'])
  h.finish(); assert.ok(h.journeys.at(-1)?.bellTowerClear, JSON.stringify(h.env.bossControllerRef.current.state()))
  assert.deepEqual([...new Set(h.writes)], [FSRS_VOICE_KEY])
  h.env.quitToMenu(); h.enter('cathedral')
  assert.deepEqual(clone(h.env.bossControllerRef.current.state().sequence), ['C4', 'E4', 'G4', 'E4', 'C4'])
  h.finish(); assert.ok(h.journeys.at(-1).cathedralClear)
})
for (const lane of ['voice', 'ear']) test(`private ${lane} demo uses isolated key and cannot award`, () => {
  const h = harness(); h.env.demoRef.current = true
  h.env.beginBossPreview(lane, 'bellringer'); h.finish()
  assert.deepEqual([...new Set(h.writes)], [lane === 'voice' ? h.env.FSRS_DEBUG_KEY : FSRS_EAR_DEBUG_KEY])
  assert.equal(h.journeys.length, 0); assert.equal(h.microphones.includes('start'), false)
})
for (const taint of ['hint', 'demo', 'debug', 'ear', 'simulated', 'missing-cursor', 'unpersisted', 'wrong-attempt']) test(`actual acceptBossResult: ${taint} cannot certify`, () => {
  const h = harness(); h.enter(); const e = h.env
  if (taint === 'hint') { e.playBossCue(true); h.advance(1801) }
  h.resolve()
  if (taint === 'demo') e.demoRef.current = true
  if (taint === 'debug') e.fsrsDebugRef.current = true
  if (taint === 'ear') e.inputModeRef.current = 'ear'
  if (taint === 'missing-cursor') e.bossReceiptsRef.current = []
  if (taint === 'unpersisted') e.bossReceiptsRef.current[0] = { ...e.bossReceiptsRef.current[0], persisted: false }
  if (taint === 'wrong-attempt') e.bossReceiptsRef.current[0] = { ...e.bossReceiptsRef.current[0], attempt: 'old' }
  while (e.bossControllerRef.current.state().status === 'active') {
    if (taint === 'simulated') e.bossSimulatingRef.current = true
    h.resolve()
  }
  assert.equal(h.journeys.length, 0)
})
test('failed answer retries same note; failed save retries without resinging and can earn clear', () => {
  const h = harness(); h.enter(); h.resolve(false)
  const c = h.env.bossControllerRef.current
  assert.equal(c.state().cursor, 0); h.env.acceptBossResult(c.retryNote())
  h.failSave(true); h.resolve()
  assert.equal(c.state().status, 'pending-save'); assert.equal(h.journeys.length, 0)
  h.failSave(false); h.env.acceptBossResult(c.retrySave()); assert.equal(c.state().cursor, 1, JSON.stringify(c.state()))
  h.finish(); assert.ok(h.journeys.at(-1)?.bellTowerClear, JSON.stringify(h.env.bossControllerRef.current.state()))
})
test('quit cancels real controller and invalidates captured claim', () => {
  const h = harness(); h.enter(); const c = h.env.bossControllerRef.current, s = c.state()
  h.env.quitToMenu()
  h.env.acceptBossResult(c.resolve({ ...s, note: s.currentNote, correct: true }))
  assert.equal(c.state().status, 'cancelled'); assert.equal(h.env.bossControllerRef.current, null)
  assert.equal(h.env.bossWorldRef.current, null); assert.equal(h.journeys.length, 0); assert.equal(h.writes.length, 0)
})
test('actual stepBossChamber: repeated stale pitch never certifies; fresh held pitch completes with real helpers', () => {
  const h = harness(); h.enter()
  for (let i = 0; i < 30; i++) h.frame(50, false)
  assert.equal(h.writes.length, 0)
  for (let i = 0; i < 150 && !h.journeys.length; i++) h.frame()
  assert.ok(h.journeys.at(-1)?.bellTowerClear)
})
for (const bad of ['hidden', 'not-listening', 'mic-error', 'suspended', 'ended', 'muted']) test(`actual stepBossChamber rejects ${bad} and discards partial hold`, () => {
  const h = harness(); h.enter(); h.frame(); h.frame(); h.frame()
  assert.ok(h.env.bossHoldRef.current.heldMs > 0)
  const e = h.env
  if (bad === 'hidden') e.document.hidden = true
  if (bad === 'not-listening') e.isListeningRef.current = false
  if (bad === 'mic-error') e.micErrorRef.current = 'lost mic'
  if (bad === 'suspended') e.micSourceHealthRef.current.audioContextState = 'suspended'
  if (bad === 'ended') e.micSourceHealthRef.current.trackReadyState = 'ended'
  if (bad === 'muted') e.micSourceHealthRef.current.trackMuted = true
  for (let i = 0; i < 20; i++) h.frame()
  assert.equal(e.bossHoldRef.current.heldMs, 0); assert.equal(h.writes.length, 0)
})
test('generation recovery cannot add the stale gap to a partial hold', () => {
  const h = harness(); h.enter(); h.frame(); h.frame(); h.frame()
  h.frame(2000)
  assert.equal(h.env.bossHoldRef.current.heldMs, 0); assert.equal(h.writes.length, 0)
  for (let i = 0; i < 7; i++) h.frame()
  assert.equal(h.env.bossControllerRef.current.state().cursor, 1)
})





test('hint then failed answer then retry remains practice-only for the whole attempt', () => {
  const h = harness(); h.enter(); h.env.playBossCue(true)
  assert.equal(h.env.bossSupportedPracticeRef.current, true)
  h.advance(1801); h.resolve(false)
  h.env.acceptBossResult(h.env.bossControllerRef.current.retryNote()); h.finish()
  assert.equal(h.env.bossControllerRef.current.state().status, 'complete')
  assert.equal(h.journeys.length, 0)
})
for (const world of ['bell-tower', 'cathedral'] as const) test(`menu rehearsal ${world}: full ordered sequence and entry cancels remaining audio/suppression`, () => {
  const h = harness()
  if (world === 'cathedral') { h.enter(); h.finish(); h.env.quitToMenu() }
  const before = h.journeys.length
  const expected = world === 'bell-tower'
    ? h.env.presentationJourneyRef.current.villageClear.bindings.flatMap((b: any) => [b.contextNote, b.targetNote])
    : ['C4', 'E4', 'G4', 'E4', 'C4']
  h.env.rehearseCampaignRecital(world); h.advance(expected.length * 1800)
  assert.deepEqual(h.tones, expected); assert.equal(h.journeys.length, before)
  assert.equal(h.env.bossControllerRef.current, null)
  h.env.rehearseCampaignRecital(world); h.advance(0)
  assert.ok(h.env.matchingSuppressedUntilRef.current > 0)
  const captured = [...h.timers.values()].map(t => t.fn)
  h.enter(world)
  assert.equal(h.timers.size, 0); assert.equal(h.env.matchingSuppressedUntilRef.current, 0)
  const count = h.tones.length
  for (const callback of captured) callback() // Even an already-dequeued callback is generation-guarded.
  h.advance(30_000); assert.equal(h.tones.length, count)
  h.finish(); assert.equal(h.journeys.length, before + 1)
})
test('a simulated earlier cursor cannot be laundered by a real final response', () => {
  const h = harness(); h.enter(); h.env.bossSimulatingRef.current = true; h.resolve()
  assert.equal(h.env.bossSimulatingRef.current, false)
  h.finish()
  assert.equal(h.journeys.length, 0, 'simulation provenance must cover the entire attempt, not only its final response')
})
