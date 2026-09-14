/** Harness proof: actual component callbacks and shipped power controllers.
 * Hardware, paint, audio and strike effects are explicit ports; no browser acceptance.
 * Run: npx tsx --test tests/pitchforks-earned-power-access.test.ts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
import * as thunder from '../src/components/PitchDefender/pitchforksThunderhead'
import * as galvanic from '../src/components/PitchDefender/pitchforksGalvanic'
import * as bell from '../src/components/PitchDefender/pitchforksBellPower'
import * as rain from '../src/components/PitchDefender/pitchforksRainEcology'
import * as pitch from '../src/components/PitchDefender/pitchMath'
import { bindPitchforksVillageCurriculum, projectPitchforksWorldGates } from '../src/components/PitchDefender/pitchforksCampaignProgress'
import { createPitchforksPresentationJourney, patientTineCountsForWave, villagerEntryX, attackTimeForCurriculum } from '../src/components/PitchDefender/pitchforksCurriculum'
import { isWorldUnlocked } from '../src/components/PitchDefender/pitchforks3WorldRegistry'
import { pitchforksMicUnreliable } from '../src/components/PitchDefender/pitchforksTunerFeedback'
import { observePitchforksSongcraftGeneration } from '../src/components/PitchDefender/PitchforksSongcraft'
import { selectVillageLessonCandidate } from '../src/components/PitchDefender/villageLessonSelector'
import { selectVillageReturnOffer } from '../src/components/PitchDefender/villageReturnQueue'

const source = readFileSync(new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url), 'utf8')
const tree = ts.createSourceFile('PitchforksIII.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const extracted = new Map<string, string>()
function extract(name: string) {
  if (extracted.has(name)) return extracted.get(name)!
  const found: ts.Node[] = []
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found.push(node)
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name && node.initializer) {
      const value = node.initializer
      found.push(ts.isCallExpression(value) && value.expression.getText(tree) === 'useCallback' ? value.arguments[0] : value)
    }
    ts.forEachChild(node, visit)
  }
  visit(tree)
  assert.equal(found.length, 1, `unique production declaration ${name}`)
  const code = ts.transpileModule(`(${found[0].getText(tree).replace(/^export\s+/, '')})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  extracted.set(name, code)
  return code
}
const ref = (current: any) => ({ current })
const clone = (value: any) => JSON.parse(JSON.stringify(value))
function harness() {
  let now = 1000
  const strikes: string[] = []
  const e: any = { ...thunder, ...galvanic, ...bell, ...rain, ...pitch, projectPitchforksWorldGates,
    pitchforksMicUnreliable, isWorldUnlocked, patientTineCountsForWave, villagerEntryX, attackTimeForCurriculum,
    selectVillageLessonCandidate, selectVillageReturnOffer, observePitchforksSongcraftGeneration,
    performance: { now: () => now }, document: { visibilityState: 'visible' },
    NOTE_COLORS: {}, setPromptText: () => {}, setThunderheadState: () => {}, setGalvanicProjection: () => {},
    setBellPowerState: () => {}, syncRainSnapshot: () => {}, localSfx: () => {},
    cuePlayingNow: () => false, matchingSuppressedNow: () => false, strikePresentationPending: () => false,
    thunderheadTargetPoint: () => ({ x: 300, y: 100 }), // paint-only geometry port
    strikeActiveTine: (target: any, _matched: boolean, kind: string) => {
      strikes.push(`${kind}:${target.key}`); target.villager.burned++
    },
  }
  // Allocate only refs referenced by the real source; values used below are explicit.
  for (const name of new Set(source.match(/\b\w+Ref\b/g))) e[name] = ref(null)
  const values: any = {
    demoRef: false, fsrsDebugRef: false, bossSimulatingRef: false, galvanicProofRef: false,
    bellProofRef: false, closeSmashProofRef: false, inputModeRef: 'voice', phaseRef: 'playing',
    selectedWorldRef: 'village-gate', runGenerationRef: 1, thunderheadArmRequestedRef: false,
    thunderheadReleaseRequestedRef: false, thunderheadSequenceRef: 0, thunderheadClockMsRef: 1000,
    thunderheadTravelStartedAtRef: 0, thunderheadMatchDueAtRef: 0,
    thunderheadTravelStartRef: { x: 0, y: 0 }, thunderheadTravelTargetRef: { x: 100, y: 0 },
    thunderheadStateRef: thunder.createPitchforksThunderheadState(),
    galvanicStateRef: galvanic.createPitchforksGalvanicState('galvanic:1:1'),
    galvanicBanksRef: [], galvanicArmRequestedRef: false, galvanicReleaseRequestedRef: false,
    galvanicAwaitingSilenceRef: false, galvanicArmedTargetKeyRef: '', galvanicSequenceRef: 0,
    galvanicAttackSequenceRef: 0, galvanicLastOutcomesRef: [], galvanicRecoilVillagerIdsRef: new Set(),
    closeSmashRecoilUntilRef: new Map(), closeSmashStateRef: { phase: 'idle' },
    bellWaveStateRef: { phase: 'idle' }, bellArmRequestedRef: false, bellReleaseRequestedRef: false,
    bellChargeReceiptRef: null, bellPowerStateRef: null, firstLockGraceRef: false,
    lockHeldMsRef: 0, lockProgressRef: 0, tintRef: null, activeKeyRef: '',
    presentationJourneyRef: createPitchforksPresentationJourney({
      rangeAssessedAt: '2026-09-13T00:00:00Z', startedAt: '2026-09-13T01:00:00Z', unlockedNotes: ['C4', 'E4'],
    }),
    runtimeRef: { wave: 1, animClock: 1, bolts: [], villagers: [], rain: rain.createRainState() },
    unlockedNotesRef: ['C4', 'E4'], demoStepRef: 'unchanged',
    assetsRef: { frankMeta: { rod_tip: {x: 20, y: 10} }, villagerMeta: {} },
    rangeProfileRef: { lowNote: 'C4', highNote: 'E4' }, presentationVisitCountByTargetRef: new Map(),
    villageReturnOffersRef: new Map(), villageReturnQueueRef: {entries: []}, completedVillageEncounterCountRef: 0,
    nextIdRef: 0,
  }
  for (const [name, value] of Object.entries(values)) e[name].current = value
  for (const name of ['SPRITE_SCALE', 'FRANK_SPRITE_SCALE', 'FRANK_X', 'FRANK_CLOUD_X_OFFSET', 'FRANK_CLOUD_Y',
    'THUNDERHEAD_BANK_X_OFFSET', 'W', 'GROUND_Y', 'defaultVillagerMeta', 'GALVANIC_PROOF_X', 'GALVANIC_PROOF_FIRST_NOTES',
    'GALVANIC_BANK_CAPACITY', 'THUNDERHEAD_TRAVEL_MS', 'THUNDERHEAD_MATCH_SETTLE_MS',
    'HOLD_MS', 'CONFIDENCE_FLOOR', 'MATCH_TOLERANCE_CENTS', 'TRAIL_MS', 'CLOSE_SMASH_RECOIL_MS',
    'FRANK_REACH_X', 'CLOSE_SMASH_FALLBACK_MS']) e[name] = runInNewContext(extract(name), e)
  e.THUNDERHEAD_CEILING_Y = 20 // paint-only port
  for (const name of ['pitchIdentity', 'createInactiveTorchState', 'attackTimeForWave', 'normalThunderheadRouteAvailable', 'normalGalvanicRouteAvailable',
    'thunderheadRouteAvailable', 'galvanicRouteAvailable', 'galvanicOwnsInput',
    'normalBellRouteAvailable', 'normalVillageLessonAvailable', 'activeTargetFromLiveVillager',
    'activeTargetForThunderheadReceipt', 'activeTargetForCloseReceipt', 'liveGalvanicTargets',
    'getActiveVillager', 'getActiveTarget', 'buildGalvanicDebugProjection', 'publishGalvanicProjection',
    'commitThunderheadState', 'transitionThunderhead', 'resetThunderhead', 'cancelThunderhead',
    'confirmThunderheadLock', 'requestThunderheadArm', 'requestThunderheadRelease', 'advanceThunderheadLifecycle',
    'resetGalvanic', 'cancelGalvanic', 'confirmGalvanicLock', 'requestGalvanicArm', 'requestGalvanicRelease',
    'advanceGalvanicRelease', 'commitBellPowerState', 'acceptNormalBellCombatResponse', 'requestCloseSmash',
    'fixedWaveDirector', 'spawnVillager', 'processLock']) e[name] = runInNewContext(extract(name), e)
  function earn(level: 'dungeon' | 'village' | 'bell' = 'bell') {
    const journey = bindPitchforksVillageCurriculum(e.presentationJourneyRef.current, { lowNote: 'C4', highNote: 'E4' }, 1)
    const identity = { version: 1, rangeAssessedAt: journey.rangeAssessedAt, startedAt: journey.startedAt }
    e.presentationJourneyRef.current = {
      ...journey, dungeonClear: { ...identity, admittedNotes: journey.unlockedNotes, clearedAt: 1 },
      ...(level !== 'dungeon' ? { villageClear: { ...identity, bindings: journey.villageCurriculum!.bindings, clearedAt: 2 } } : {}),
      ...(level === 'bell' ? { bellTowerClear: { ...identity, admittedNotes: journey.unlockedNotes, clearedAt: 3 } } : {}),
    }
  }
  function add(note = 'C4') {
    const villagers = e.runtimeRef.current.villagers
    const actor = { id: villagers.length + 1, spawnIndex: villagers.length, state: 'walking',
      burned: 0, totalTines: 1, notes: [note], x: 300 + villagers.length * 100, torch: { phase: 'spent' }, torchBearer: false }
    villagers.push(actor)
    return actor
  }
  return { e, earn, add, strikes, tick: (ms: number) => { now += ms; return now } }
}

test('receipt access ratchets without changing proof flags or allocating charges', () => {
  const h = harness(), e = h.e
  assert.equal(e.thunderheadRouteAvailable(), false); assert.equal(e.galvanicRouteAvailable(), false)
  h.earn('dungeon'); assert.equal(e.normalBellRouteAvailable(), true)
  assert.equal(e.thunderheadRouteAvailable(), false)
  h.earn('village'); assert.equal(e.thunderheadRouteAvailable(), true); assert.equal(e.galvanicRouteAvailable(), false)
  h.earn(); assert.equal(e.galvanicRouteAvailable(), true)
  assert.equal(e.galvanicOwnsInput(), false)
  assert.equal(e.demoRef.current, false); assert.equal(e.galvanicProofRef.current, false)
  assert.equal(e.thunderheadStateRef.current.bank, null); assert.equal(e.galvanicBanksRef.current.length, 0)
})
for (const taint of ['fsrsDebugRef', 'bossSimulatingRef']) test(`normal access rejects ${taint}`, () => {
  const h = harness(); h.earn(); h.add(); const e = h.e; e[taint].current = true
  assert.equal(e.normalBellRouteAvailable(), false)
  e.requestThunderheadArm(); e.requestGalvanicArm()
  assert.equal(e.thunderheadArmRequestedRef.current, false); assert.equal(e.galvanicArmRequestedRef.current, false)
})
for (const world of ['dungeon', 'village-gate', 'bell-tower', 'cathedral']) test(`Bell/Rain retained and teaching bounded in ${world}`, () => {
  const h = harness(); h.earn(); const e = h.e; e.selectedWorldRef.current = world
  assert.equal(e.normalBellRouteAvailable(), world !== 'dungeon')
  assert.equal(e.normalVillageLessonAvailable(), world === 'village-gate')
  assert.equal(e.normalThunderheadRouteAvailable(), true); assert.equal(e.normalGalvanicRouteAvailable(), true)
  e.bellPowerStateRef.current = bell.createPitchforksBellPowerState({runId: 'bell-power:1', requiredResponses: 3, admittedNotes: ['C4','E4'], taughtPair: ['C4','E4']})
  h.add(); const target = e.getActiveTarget(); e.acceptNormalBellCombatResponse(target); e.acceptNormalBellCombatResponse(target)
  assert.equal(e.bellPowerStateRef.current.charge, world === 'dungeon' ? 0 : 1)
  assert.equal(e.runtimeRef.current.rain.charge, world === 'dungeon' ? 0 : 1)
})
for (const lane of ['ear', 'buttons']) test(`${lane} cannot arm or release earned powers`, () => {
  const h = harness(); h.earn(); h.add(); const e = h.e; e.inputModeRef.current = lane
  e.requestThunderheadArm(); e.requestGalvanicArm(); e.requestThunderheadRelease(); e.requestGalvanicRelease()
  assert.equal(e.thunderheadArmRequestedRef.current, false); assert.equal(e.galvanicArmRequestedRef.current, false)
  assert.equal(e.thunderheadReleaseRequestedRef.current, false); assert.equal(e.galvanicReleaseRequestedRef.current, false)
})
test('empty release requests are inert in earned normal play', () => {
  const h = harness(); h.earn(); const e = h.e
  e.requestThunderheadRelease(); e.requestGalvanicRelease()
  e.advanceThunderheadLifecycle(1000, false); e.advanceGalvanicRelease(1000)
  assert.deepEqual(h.strikes, []); assert.equal(e.thunderheadReleaseRequestedRef.current, false)
  assert.equal(e.galvanicReleaseRequestedRef.current, false)
})
test('Thunderhead actual bank/travel/match/consume is exact, paused and one-shot in normal play', () => {
  const h = harness(); h.earn(); h.add(); const e = h.e
  e.requestThunderheadArm(); assert.equal(e.thunderheadArmRequestedRef.current, true)
  assert.equal(e.confirmThunderheadLock(e.getActiveTarget(), 1000), true)
  assert.deepEqual(h.strikes, []); e.requestThunderheadRelease()
  e.advanceThunderheadLifecycle(1000, true); assert.equal(e.thunderheadStateRef.current.phase, 'banked')
  e.advanceThunderheadLifecycle(1000, false); e.advanceThunderheadLifecycle(1900, false)
  assert.equal(e.thunderheadStateRef.current.phase, 'target_match')
  e.advanceThunderheadLifecycle(2100, false); e.advanceThunderheadLifecycle(2200, false)
  assert.deepEqual(h.strikes, ['thunderhead:1:0']); assert.equal(e.thunderheadStateRef.current.phase, 'consumed')
  assert.equal(e.demoStepRef.current, 'unchanged')
})
test('Thunderhead rejects a stale exact-octave target rather than striking a bystander', () => {
  const h = harness(); h.earn(); const actor = h.add(); h.add(); const e = h.e
  e.requestThunderheadArm(); e.confirmThunderheadLock(e.getActiveTarget(), 1000); e.requestThunderheadRelease()
  e.advanceThunderheadLifecycle(1000, false); actor.notes[0] = 'C5'; e.advanceThunderheadLifecycle(1900, false)
  assert.deepEqual(h.strikes, []); assert.equal(e.thunderheadLastTransitionReasonRef.current, 'stale-target')
})
test('Galvanic actual requests, two distinct banks, exact sweep and consumed-before-effects', () => {
  const h = harness(); h.earn(); h.add(); h.add(); h.add('E4'); const e = h.e
  for (let index = 0; index < 2; index++) {
    e.requestGalvanicArm(); assert.equal(e.galvanicArmRequestedRef.current, true)
    assert.equal(e.confirmGalvanicLock(e.getActiveTarget()), false, 'requires an observed silence')
    e.galvanicAwaitingSilenceRef.current = false // detector port; processLock tested below
    assert.equal(e.confirmGalvanicLock(e.getActiveTarget()), true)
    e.galvanicAwaitingSilenceRef.current = false
  }
  e.requestGalvanicArm(); assert.equal(e.galvanicArmRequestedRef.current, false)
  assert.equal(e.galvanicBanksRef.current.length, 2)
  const strike = e.strikeActiveTine
  e.strikeActiveTine = (...args: any[]) => { assert.equal(e.galvanicBanksRef.current.length, 0); assert.equal(e.galvanicStateRef.current.consumedLockIds.length, 2); strike(...args) }
  e.requestGalvanicRelease(); e.advanceGalvanicRelease(1000); e.advanceGalvanicRelease(1100)
  assert.deepEqual(h.strikes, ['galvanic:1:0', 'galvanic:2:0'])
  assert.equal(e.runtimeRef.current.villagers[2].burned, 0)
  assert.equal(e.galvanicRecoilVillagerIdsRef.current.has(3), true)
  assert.equal(e.demoStepRef.current, 'unchanged')
})
test('Galvanic pending ownership blocks other powers, cancellation restores them', () => {
  const h = harness(); h.earn(); h.add(); const e = h.e
  e.requestGalvanicArm(); e.requestThunderheadArm(); assert.equal(e.thunderheadArmRequestedRef.current, false)
  e.cancelGalvanic(); assert.equal(e.galvanicOwnsInput(), false)
  e.requestThunderheadArm(); assert.equal(e.thunderheadArmRequestedRef.current, true)
  e.requestGalvanicArm(); assert.equal(e.galvanicArmRequestedRef.current, false)
})
test('a Village clear alone cannot arm or confirm Galvanic', () => {
  const h = harness(); h.earn('village'); h.add(); const e = h.e
  e.requestGalvanicArm(); assert.equal(e.galvanicArmRequestedRef.current, false)
  e.galvanicArmRequestedRef.current = true; e.galvanicArmedTargetKeyRef.current = '1:0'
  assert.equal(e.confirmGalvanicLock(e.getActiveTarget()), false)
})
for (const phase of ['activating', 'pending']) test(`normal Bell ${phase} owns input ahead of Thunderhead`, () => {
  const h = harness(); h.earn(); h.add(); const e = h.e
  e.bellPowerStateRef.current = {phase}
  e.requestThunderheadArm(); assert.equal(e.thunderheadArmRequestedRef.current, false)
  e.bellPowerStateRef.current = null
  e.requestThunderheadArm(); e.confirmThunderheadLock(e.getActiveTarget(), 1000)
  e.bellPowerStateRef.current = {phase}
  e.requestThunderheadRelease(); assert.equal(e.thunderheadReleaseRequestedRef.current, false)
})
for (const missing of ['dungeonClear', 'villageClear']) test(`malformed earned prefix missing ${missing} cannot grant powers`, () => {
  const h = harness(); h.earn(); const e = h.e
  delete e.presentationJourneyRef.current[missing]
  e.selectedWorldRef.current = 'cathedral'
  assert.equal(e.normalThunderheadRouteAvailable(), false)
  assert.equal(e.normalGalvanicRouteAvailable(), false)
  assert.equal(e.normalBellRouteAvailable(), false)
})
test('private showcase access remains explicit; ordinary wave plans remain ordinary', () => {
  const h = harness(); const e = h.e
  e.demoRef.current = true
  assert.equal(e.thunderheadRouteAvailable(), true); assert.equal(e.galvanicRouteAvailable(), false)
  e.galvanicProofRef.current = true; assert.equal(e.galvanicRouteAvailable(), true)
  assert.equal(e.normalThunderheadRouteAvailable(), false)
  assert.equal(e.normalGalvanicRouteAvailable(), false)
  assert.notDeepEqual(clone(e.fixedWaveDirector(1, true, false, true)), clone(e.fixedWaveDirector(1, false, false, false)))
})

for (const world of ['village-gate', 'bell-tower', 'cathedral']) test(`actual ${world} spawn preserves chosen note and confines lesson creation`, () => {
  const h = harness(); h.earn(); const e = h.e
  e.selectedWorldRef.current = world
  e.pickVillagerNotes = () => ['E4']
  e.ensureActiveNoteMemory = () => { throw new Error('normal spawn forced a fixture note') }
  Object.assign(e.runtimeRef.current, { spawned: 0, firstVillagerId: null, plan: { count: 1, tineCounts: [1], speed: 15 } })
  e.spawnVillager()
  const actor = e.runtimeRef.current.villagers[0]
  assert.deepEqual(clone(actor.notes), ['E4'])
  assert.equal(Boolean(actor.supportedLesson), world === 'village-gate')
  assert.equal(actor.torchBearer, true)
  assert.equal(actor.x, villagerEntryX(e.W, e.defaultVillagerMeta.frame_w * e.SPRITE_SCALE))
  assert.equal(e.demoStepRef.current, 'unchanged')
})

function microphoneHarness(power: 'thunderhead' | 'galvanic') {
  const h = harness(); h.earn(); h.add(); const e = h.e
  for (const name of ['pauseSparkGuide', 'resetSparkGuide', 'flushPendingMusicalPrompt', 'presentMusicalPrompt',
    'setActiveCueContextSnapshot', 'setFirstMinuteCoachSnapshot', 'playVillagerSequence', 'updateSparkGuide']) e[name] = () => {}
  e.colorForCents = () => null // paint-only port
  e.environmentalClockPausedNow = () => false
  e.cueContextForVillager = () => ({support: 'recall', noteCount: 1})
  e.demoPitchForTarget = () => { throw new Error('normal power reached simulator') }
  e.armCloseSmash = () => { throw new Error('power hold leaked to Close Smash') }
  e.isListeningRef.current = true; e.micErrorRef.current = null
  e.micSourceHealthRef.current = { audioContextState: 'running', trackReadyState: 'live', trackMuted: false }
  e.ceremonyRef.current = {active: false}; e.firstMinuteCoachRef.current = {beat: 'complete'}
  e.activeKeyRef.current = '1:0'; e.activeVillagerIdRef.current = 1
  e.pitchGenerationRef.current = 0
  e.lockGenerationRef.current = {lastGeneration: 0, generationObserved: false, generationObservedAt: 0}
  e[power === 'thunderhead' ? 'requestThunderheadArm' : 'requestGalvanicArm']()
  function frame(active = true, fresh = true, note = 'C4') {
    h.tick(50)
    if (fresh) e.pitchGenerationRef.current++
    e.pitchRef.current = { isActive: active, frequency: pitch.noteToFreq(note), confidence: 1 }
    e.processLock(0.05)
  }
  return {...h, frame, banks: () => power === 'thunderhead' ? Number(e.thunderheadStateRef.current.phase === 'banked') : e.galvanicBanksRef.current.length}
}
for (const power of ['thunderhead', 'galvanic'] as const) {
  test(`actual processLock earns ${power} only from fresh exact microphone samples`, () => {
    const h = microphoneHarness(power)
    for (let i = 0; i < 10; i++) h.frame(false)
    for (let i = 0; i < 10; i++) h.frame(true, true, 'C5')
    assert.equal(h.banks(), 0, 'octave error cannot bank')
    for (let i = 0; i < 15; i++) h.frame(true, false)
    assert.equal(h.banks(), 0, 'render-only frames cannot bank')
    for (let i = 0; i < 10; i++) h.frame()
    assert.equal(h.banks(), 1)
    for (let i = 0; i < 10; i++) h.frame()
    assert.equal(h.banks(), 1); assert.deepEqual(h.strikes, [])
  })
  for (const bad of ['hidden', 'muted', 'ended', 'suspended', 'suppressed', 'not-listening']) test(`${power} live-input guard rejects ${bad}`, () => {
    const h = microphoneHarness(power), e = h.e
    if (bad === 'hidden') e.document.visibilityState = 'hidden'
    if (bad === 'muted') e.micSourceHealthRef.current.trackMuted = true
    if (bad === 'ended') e.micSourceHealthRef.current.trackReadyState = 'ended'
    if (bad === 'suspended') e.micSourceHealthRef.current.audioContextState = 'suspended'
    if (bad === 'suppressed') e.matchingSuppressedNow = () => true
    if (bad === 'not-listening') e.isListeningRef.current = false
    for (let i = 0; i < 15; i++) h.frame()
    assert.equal(h.banks(), 0); assert.deepEqual(h.strikes, [])
  })
}
