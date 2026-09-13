import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  acceptPitchforksBellPowerCombatResponse,
  createPitchforksBellPowerState,
} from '../src/components/PitchDefender/pitchforksBellPower'
import {
  RAINCALL_REQUIRED_RESPONSES,
  RAINCALL_TIMINGS,
  acceptPitchforksRainCombatResponse,
  createRainState,
  deriveRainEffects,
  stepRain,
  type PitchforksRainCombatResponse,
} from '../src/components/PitchDefender/pitchforksRainEcology'

const source = readFileSync(
  new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url),
  'utf8',
)

let checks = 0
const check = (run: () => void): void => {
  run()
  checks += 1
}

const normalResponse = (
  eventId: string,
  overrides: Partial<PitchforksRainCombatResponse> = {},
): PitchforksRainCombatResponse => ({
  runId: 'normal-run-7',
  eventId,
  note: 'D4',
  lane: 'voice',
  source: 'combat',
  correct: true,
  ...overrides,
})

check(() => {
  // Pure-controller contract: elapsed time in an explicit normal frame never
  // buys readiness; the same frame can still consume one admitted event.
  let rain = stepRain(createRainState(), RAINCALL_TIMINGS.chargingMs, { mode: 'normal' })
  assert.equal(rain.phase, 'charging')
  assert.equal(rain.charge, 0)
  rain = stepRain(rain, 250, {
    mode: 'normal',
    combatResponse: normalResponse('normal-event-1'),
  })
  assert.equal(rain.phase, 'charging')
  assert.equal(rain.charge, 1)

  const frameStart = source.indexOf('const activationRequested')
  const frameEnd = source.indexOf('const thunderheadPhaseAtFrameStart', frameStart)
  assert.ok(frameStart >= 0 && frameEnd > frameStart, 'updateGame must keep a Rain frame seam')
  const frame = source.slice(frameStart, frameEnd)
  assert.match(
    frame,
    /stepRain\(rt\.rain, dt \* 1000, \{[\s\S]*?mode:\s*demoRef\.current\s*\?\s*['"]demo['"]\s*:\s*['"]normal['"]/
  )
  assert.match(frame, /const rainEffects = deriveRainEffects\(nextRain\)/)
  assert.doesNotMatch(frame, /const rainEffects = demoRef\.current\s*\?/, 'normal frames must use the same derived ecology effects')
})

check(() => {
  // One current, eligible voice event is independently spendable by both
  // ledgers. A Rain connector must sit on this existing correct voice seam.
  const event = normalResponse('shared-normal-event')
  let rain = createRainState()
  const rainDecision = acceptPitchforksRainCombatResponse(rain, event)
  rain = rainDecision.state
  const bell = createPitchforksBellPowerState({
    runId: event.runId ?? 'normal-run-7',
    requiredResponses: 3,
    admittedNotes: ['D4', 'E4'],
    taughtPair: ['D4', 'E4'],
  })
  const bellDecision = acceptPitchforksBellPowerCombatResponse(bell, event as never)
  assert.equal(rainDecision.accepted, true)
  assert.equal(rainDecision.charged, true)
  assert.equal(rain.charge, 1)
  assert.equal(bellDecision.accepted, true)
  assert.equal(bellDecision.charged, true)
  assert.equal(bellDecision.state.charge, 1)

  const reviewStart = source.indexOf('const reviewTargetNote')
  const reviewEnd = source.indexOf('const playVillagerSequence', reviewStart)
  assert.ok(reviewStart >= 0 && reviewEnd > reviewStart, 'correct-response caller seam must remain present')
  const review = source.slice(reviewStart, reviewEnd)
  const voiceStart = review.indexOf("if (lane === 'voice')")
  assert.ok(voiceStart >= 0, 'normal Rain must remain on the existing voice-only branch')
  const voiceBranch = review.slice(voiceStart)
  assert.match(voiceBranch, /acceptNormalBellCombatResponse|acceptPitchforksBellPowerCombatResponse/)
  assert.match(voiceBranch, /rain/i, 'the same current voice response must also reach Rain')

  const rainUses = [...source.matchAll(/acceptPitchforksRainCombatResponse/g)]
  assert.ok(rainUses.length >= 2, 'normal caller must import and invoke the Rain controller')
  const callerWindow = source.slice(Math.max(0, (rainUses[1].index ?? 0) - 1600), (rainUses[1].index ?? 0) + 600)
  assert.match(callerWindow, /runGenerationRef\.current|current\.runId/)
  assert.match(callerWindow, /getActiveTarget|liveTarget/)
})

check(() => {
  let rain = createRainState()
  const excluded: Array<[string, Partial<PitchforksRainCombatResponse>]> = [
    ['wrong', { correct: false }],
    ['demo', { demo: true }],
    ['simulated', { simulated: true }],
    ['stale', { stale: true }],
    ['ear-lane', { lane: 'ear' }],
    ['ear-source', { source: 'ear' }],
    ['ear-flag', { ear: true }],
    ['ear-mode', { inputMode: 'ear' }],
  ]
  for (const [eventId, overrides] of excluded) {
    const decision = acceptPitchforksRainCombatResponse(rain, normalResponse(eventId, overrides))
    assert.equal(decision.accepted, false)
    assert.equal(decision.charged, false)
    rain = decision.state
  }
  assert.equal(rain.charge, 0)

  const fresh = acceptPitchforksRainCombatResponse(rain, normalResponse('fresh-normal-event'))
  assert.equal(fresh.accepted, true)
  assert.equal(fresh.charged, true)

  // Rain's optional runId is provenance, not the caller's stale-run fence.
  // The mounted caller must revalidate the current run and live target before
  // this controller is broadcast to.
  const rainUses = [...source.matchAll(/acceptPitchforksRainCombatResponse/g)]
  assert.ok(rainUses.length >= 2, 'Rain caller must exist before stale-fence inspection')
  const callerWindow = source.slice(Math.max(0, (rainUses[1].index ?? 0) - 1800), (rainUses[1].index ?? 0) + 600)
  assert.match(callerWindow, /runGenerationRef\.current|current\.runId/)
  assert.match(callerWindow, /getActiveTarget|liveTarget/)
  assert.doesNotMatch(callerWindow, /pitchRef\.current/, 'Rain charge cannot be minted from a detached pitch callback')
})

check(() => {
  // Ecology stays environmental: rain/water changes only phase/effects and
  // never fabricates a tine, score, review, or lock receipt.
  let rain = createRainState()
  for (let index = 0; index < RAINCALL_REQUIRED_RESPONSES; index += 1) {
    rain = acceptPitchforksRainCombatResponse(rain, normalResponse(`ready-${index + 1}`)).state
  }
  assert.equal(rain.phase, 'ready')
  rain = stepRain(rain, 250, { mode: 'normal', activated: true })
  assert.equal(rain.phase, 'gutter_fill')
  assert.deepEqual(deriveRainEffects({ ...rain, phase: 'raining' }), { slowFactor: 0.55, extinguish: true })
  assert.equal('tine' in rain, false)
  assert.equal('score' in rain, false)
  assert.equal('lockEvent' in rain, false)

  const reset = createRainState()
  assert.equal(reset.phase, 'charging')
  assert.equal(reset.charge, 0)
  assert.equal(reset.cycleID, 0)
  assert.deepEqual(reset.consumedEventIds, [])

  const startWaveStart = source.indexOf('const startWave')
  const startWaveEnd = source.indexOf('const addBolt', startWaveStart)
  assert.ok(startWaveStart >= 0 && startWaveEnd > startWaveStart, 'level boundary must expose a Rain reset seam')
  assert.match(source.slice(startWaveStart, startWaveEnd), /createRainState\(\)|resetRain/i)

  const quitStart = source.indexOf('const quitToMenu')
  const quitEnd = source.indexOf('const beginSongcraft', quitStart)
  assert.ok(quitStart >= 0 && quitEnd > quitStart, 'quit boundary must expose a Rain reset seam')
  assert.match(source.slice(quitStart, quitEnd), /runtimeRef\.current\.rain|resetRain/i)

  const torchStart = source.indexOf('const advanceActiveTorch')
  const torchEnd = source.indexOf("if (activeVillagerIdRef.current !== target.villager.id)", torchStart)
  assert.ok(torchStart >= 0 && torchEnd > torchStart, 'torch ecology helper must remain isolated')
  const torchPath = source.slice(torchStart, torchEnd)
  assert.doesNotMatch(torchPath, /reviewTargetNote|strikeActiveTine|recordMasteryProgressForReview|saveFsrs|saveCueSupport/)
})

check(() => {
  // The existing dock remains touch/focus accessible, but normal earned
  // Village must be eligible alongside the private demonstration route.
  const rainStart = source.indexOf('data-testid="pf3-raincall"')
  const rainEnd = source.indexOf('{bellControlVisible && <section', rainStart)
  assert.ok(rainStart >= 0 && rainEnd > rainStart, 'Rain dock must remain in the ability dock')
  const dock = source.slice(Math.max(0, rainStart - 220), rainEnd)
  assert.doesNotMatch(source, /\{demoMode && <section\s+data-testid="pf3-raincall"/)
  assert.match(dock, /normalBell|normal.*Route|rain.*(?:Visible|Available|Route)|village-gate/i)
  assert.match(dock, /data-testid="pf3-raincall-action"/)
  assert.match(dock, /data-testid="pf3-raincall-status"/)
  assert.match(dock, /aria-describedby=/)
  assert.match(dock, /min-h-12/)

  const rainCopyStart = source.indexOf('const rainEffects = deriveRainEffects')
  const rainCopy = source.slice(rainCopyStart, rainStart)
  assert.match(rainCopy, /rainState\.charge|RAINCALL_REQUIRED_RESPONSES/)
  assert.match(rainCopy, /rainState\.cycleID/)

  const spawnStart = source.indexOf('const spawnVillager')
  const spawnEnd = source.indexOf('const startWave', spawnStart)
  assert.ok(spawnStart >= 0 && spawnEnd > spawnStart)
  const spawn = source.slice(spawnStart, spawnEnd)
  assert.match(spawn, /torchBearer:/)
  assert.match(spawn, /normalBellRouteAvailable|selectedWorldRef\.current|village-gate/)
  assert.doesNotMatch(spawn, /torch:\s*demoRef\.current\s*&&/)

  const torchStart = source.indexOf('const advanceActiveTorch')
  const torchEnd = source.indexOf("if (activeVillagerIdRef.current !== target.villager.id)", torchStart)
  const torchPath = source.slice(torchStart, torchEnd)
  assert.doesNotMatch(torchPath, /!demoRef\.current/)
  assert.match(torchPath, /target\.villager\.torchBearer/)
})

console.log(`pitchforks normal Rain integration seam: ${checks}/5 PASS (harness + source contract; mounted route remains unverified)`)
