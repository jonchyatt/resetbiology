import assert from 'node:assert/strict'

import {
  RAINCALL_REQUIRED_RESPONSES,
  MAX_RECENT_RAIN_TRANSITIONS,
  MAX_RECENT_TORCH_TRANSITIONS,
  MAX_RAIN_STEP_MS,
  RAINCALL_TIMINGS,
  acceptPitchforksRainCombatResponse,
  TORCH_EXACT_HOLD_MS,
  createRainState,
  createTorchState,
  deriveRainEffects,
  stepRain,
  stepTorch,
  type PitchforksRainCombatResponse,
} from '../src/components/PitchDefender/pitchforksRainEcology'

let checks = 0
const check = (run: () => void) => {
  run()
  checks += 1
}

const advanceRain = (
  state: ReturnType<typeof createRainState>,
  durationMs: number,
  options: Parameters<typeof stepRain>[2] = {},
) => {
  let next = state
  for (let elapsed = 0; elapsed < durationMs; elapsed += MAX_RAIN_STEP_MS) {
    next = stepRain(next, Math.min(MAX_RAIN_STEP_MS, durationMs - elapsed), options)
  }
  return next
}

const advanceTorch = (
  state: ReturnType<typeof createTorchState>,
  durationMs: number,
  options: Parameters<typeof stepTorch>[2],
) => {
  let next = state
  for (let elapsed = 0; elapsed < durationMs; elapsed += 250) {
    next = stepTorch(next, Math.min(250, durationMs - elapsed), options)
  }
  return next
}

const combatResponse = (
  eventId: string,
  overrides: Partial<PitchforksRainCombatResponse> = {},
): PitchforksRainCombatResponse => ({
  runId: 'run-1',
  eventId,
  note: 'D4',
  lane: 'voice',
  source: 'combat',
  correct: true,
  ...overrides,
})

const earnRainReady = (): ReturnType<typeof createRainState> => {
  let rain = createRainState()
  for (let index = 0; index < RAINCALL_REQUIRED_RESPONSES; index += 1) {
    const decision = acceptPitchforksRainCombatResponse(
      rain,
      combatResponse(`rain-combat-${index + 1}`, { note: index % 2 === 0 ? 'D4' : 'E4' }),
    )
    assert.equal(decision.accepted, true)
    assert.equal(decision.charged, true)
    rain = decision.state
  }
  return rain
}

check(() => {
  const initial = createRainState()
  assert.equal(initial.phase, 'charging')
  assert.equal(initial.fill, 0)
  assert.deepEqual(stepRain(initial, 0, { activated: true }), initial)
  assert.deepEqual(stepRain(initial, -1), initial)
  assert.deepEqual(stepRain(initial, Number.NaN), initial)
  assert.deepEqual(stepRain(initial, Number.POSITIVE_INFINITY), initial)
  assert.deepEqual(stepRain(initial, 250, { paused: true, activated: true }), initial)
})

check(() => {
  // Activation is ignored before charge completes, including a held command.
  const rain = advanceRain(createRainState(), RAINCALL_TIMINGS.chargingMs, { activated: true })
  assert.equal(rain.phase, 'ready')
  assert.equal(rain.fill, 0)
  assert.equal(rain.charge, RAINCALL_REQUIRED_RESPONSES)
  assert.equal(rain.recentTransitions.at(-1)?.target, 'ready')
  assert.equal(rain.recentTransitions.at(-1)?.atMs, RAINCALL_TIMINGS.chargingMs)
  const explicitDemo = advanceRain(createRainState(), RAINCALL_TIMINGS.chargingMs, { mode: 'demo' })
  assert.equal(explicitDemo.phase, 'ready')
  assert.equal(explicitDemo.charge, RAINCALL_REQUIRED_RESPONSES)
})

check(() => {
  let rain = createRainState()
  for (let index = 0; index < RAINCALL_REQUIRED_RESPONSES - 1; index += 1) {
    rain = acceptPitchforksRainCombatResponse(
      rain,
      combatResponse(`earned-${index + 1}`),
    ).state
  }
  assert.equal(rain.phase, 'charging')
  assert.equal(rain.charge, RAINCALL_REQUIRED_RESPONSES - 1)

  const ready = acceptPitchforksRainCombatResponse(
    rain,
    combatResponse(`earned-${RAINCALL_REQUIRED_RESPONSES}`),
  )
  assert.equal(ready.accepted, true)
  assert.equal(ready.charged, true)
  assert.equal(ready.state.phase, 'ready')
  assert.equal(ready.state.charge, RAINCALL_REQUIRED_RESPONSES)
})

check(() => {
  let rain = createRainState()
  const invalid: Array<[string, Partial<PitchforksRainCombatResponse>]> = [
    ['wrong', { correct: false }],
    ['demo', { demo: true }],
    ['simulated', { simulated: true }],
    ['ear-lane', { lane: 'ear' }],
    ['ear-source', { source: 'ear' }],
    ['ear-flag', { ear: true }],
  ]
  for (const [eventId, overrides] of invalid) {
    const decision = acceptPitchforksRainCombatResponse(rain, combatResponse(eventId, overrides))
    assert.equal(decision.accepted, false)
    assert.equal(decision.charged, false)
    rain = decision.state
  }
  assert.equal(rain.phase, 'charging')
  assert.equal(rain.charge, 0)
  assert.equal(rain.consumedEventIds.length, invalid.length)

  const accepted = acceptPitchforksRainCombatResponse(rain, combatResponse('dedupe'))
  const duplicate = acceptPitchforksRainCombatResponse(accepted.state, combatResponse('dedupe'))
  assert.equal(accepted.accepted, true)
  assert.equal(accepted.charged, true)
  assert.equal(duplicate.reason, 'duplicate-event')
  assert.strictEqual(duplicate.state, accepted.state)
})

check(() => {
  const normal = advanceRain(createRainState(), RAINCALL_TIMINGS.chargingMs, { mode: 'normal' })
  assert.equal(normal.phase, 'charging')
  assert.equal(normal.charge, 0)
  const earned = stepRain(normal, 0, {
    mode: 'normal',
    acceptedResponse: combatResponse('timer-does-not-earn'),
  })
  assert.equal(earned.phase, 'charging')
  assert.equal(earned.charge, 1)
})

check(() => {
  let rain = advanceRain(createRainState(), RAINCALL_TIMINGS.chargingMs)
  rain = stepRain(rain, 250, { activated: true })
  assert.equal(rain.phase, 'gutter_fill')
  assert.equal(rain.fill, 0.125)
  const firstFill = rain.fill
  rain = stepRain(rain, 250, { activated: true })
  assert.equal(rain.phase, 'gutter_fill')
  assert.ok(rain.fill > firstFill)
  assert.deepEqual(rain.recentTransitions.slice(-1).map(({ source, target }) => [source, target]), [
    ['ready', 'gutter_fill'],
  ])
})

check(() => {
  let rain = advanceRain(createRainState(), RAINCALL_TIMINGS.chargingMs)
  rain = stepRain(rain, 250, { activated: true })
  rain = advanceRain(rain, RAINCALL_TIMINGS.fillMs - 250)
  assert.equal(rain.phase, 'gargoyle_release')
  assert.equal(rain.fill, 1)
  assert.equal(rain.recentTransitions.at(-1)?.target, 'gargoyle_release')
  rain = advanceRain(rain, RAINCALL_TIMINGS.releaseMs)
  assert.equal(rain.phase, 'raining')
  assert.equal(rain.recentTransitions.at(-1)?.target, 'raining')
  assert.ok((rain.recentTransitions.at(-1)?.atMs ?? 0) > (rain.recentTransitions.at(-2)?.atMs ?? 0))
})

check(() => {
  let rain = earnRainReady()
  const cycleBefore = rain.cycleID
  rain = stepRain(rain, 250, { mode: 'normal', activated: true })
  assert.equal(rain.phase, 'gutter_fill')
  assert.equal(rain.charge, 0)
  rain = advanceRain(rain, RAINCALL_TIMINGS.fillMs, { mode: 'normal' })
  assert.equal(rain.phase, 'gargoyle_release')
  rain = advanceRain(rain, RAINCALL_TIMINGS.releaseMs, { mode: 'normal' })
  assert.equal(rain.phase, 'raining')
  rain = advanceRain(rain, RAINCALL_TIMINGS.rainingMs, { mode: 'normal' })
  assert.equal(rain.phase, 'cooldown')
  rain = advanceRain(rain, RAINCALL_TIMINGS.cooldownMs, { mode: 'normal' })
  assert.equal(rain.phase, 'charging')
  assert.equal(rain.charge, 0)
  assert.equal(rain.cycleID, cycleBefore + 1)
})

check(() => {
  let rain = earnRainReady()
  const saturated = acceptPitchforksRainCombatResponse(
    rain,
    combatResponse('over-cap'),
  )
  assert.equal(saturated.accepted, true)
  assert.equal(saturated.charged, false)
  assert.equal(saturated.reason, 'saturated')
  assert.equal(saturated.state.charge, RAINCALL_REQUIRED_RESPONSES)

  rain = stepRain(saturated.state, 250, { mode: 'normal', activated: true })
  const active = acceptPitchforksRainCombatResponse(rain, combatResponse('active-no-bank'))
  assert.equal(active.accepted, true)
  assert.equal(active.charged, false)
  assert.equal(active.reason, 'busy')
  assert.equal(active.state.charge, 0)

  rain = advanceRain(active.state, RAINCALL_TIMINGS.fillMs + RAINCALL_TIMINGS.releaseMs + RAINCALL_TIMINGS.rainingMs, { mode: 'normal' })
  assert.equal(rain.phase, 'cooldown')
  const cooling = acceptPitchforksRainCombatResponse(rain, combatResponse('cooldown-no-bank'))
  assert.equal(cooling.charged, false)
  assert.equal(cooling.state.charge, 0)
  rain = advanceRain(cooling.state, RAINCALL_TIMINGS.cooldownMs, { mode: 'normal' })
  assert.equal(rain.phase, 'charging')
  assert.equal(rain.charge, 0)
})

check(() => {
  const dry = deriveRainEffects(createRainState())
  assert.deepEqual(dry, { slowFactor: 1, extinguish: false })
  const release = deriveRainEffects({ ...createRainState(), phase: 'gargoyle_release' })
  assert.deepEqual(release, { slowFactor: 1, extinguish: true })
  const rain = deriveRainEffects({ ...createRainState(), phase: 'raining' })
  assert.deepEqual(rain, { slowFactor: 0.55, extinguish: true })
  assert.equal('noteHit' in rain, false)
  assert.equal('score' in rain, false)
  assert.equal('lockEvent' in rain, false)

  const earned = earnRainReady()
  assert.equal('tine' in earned, false)
  assert.equal('score' in earned, false)
  assert.equal('lockEvent' in earned, false)
})

check(() => {
  const initial = createTorchState()
  assert.deepEqual(stepTorch(initial, 0, { confirmedExactHold: true }), initial)
  assert.deepEqual(stepTorch(initial, -1, { confirmedExactHold: true }), initial)
  assert.deepEqual(stepTorch(initial, Number.NaN, { confirmedExactHold: true }), initial)
  let torch = advanceTorch(initial, 1_000, {
    confirmedExactHold: true,
    rainWet: false,
    paused: false,
  })
  assert.equal(torch.phase, 'holding')
  assert.equal(torch.heldMs, 1_000)
  torch = stepTorch(torch, 250, {
    confirmedExactHold: false,
    rainWet: false,
    paused: false,
  })
  assert.equal(torch.phase, 'lit')
  assert.equal(torch.heldMs, 0)
  assert.equal(torch.recentTransitions.at(-1)?.cause, 'hold_lost')
  torch = advanceTorch(torch, TORCH_EXACT_HOLD_MS, {
    confirmedExactHold: true,
    rainWet: false,
    paused: false,
  })
  assert.equal(torch.phase, 'steaming')
  assert.equal(torch.heldMs, TORCH_EXACT_HOLD_MS)
})

check(() => {
  let torch = createTorchState()
  torch = advanceTorch(torch, TORCH_EXACT_HOLD_MS, {
    confirmedExactHold: true,
    rainWet: false,
    paused: false,
  })
  torch = advanceTorch(torch, 500, {
    confirmedExactHold: false,
    rainWet: false,
    paused: false,
  })
  assert.equal(torch.phase, 'wet')
  torch = advanceTorch(torch, 500, {
    confirmedExactHold: false,
    rainWet: false,
    paused: false,
  })
  assert.equal(torch.phase, 'spent')
  assert.deepEqual(torch.recentTransitions.map(({ source, target, cause }) => [source, target, cause]), [
    ['lit', 'holding', 'confirmed_exact_hold'],
    ['holding', 'steaming', 'exact_hold_complete'],
    ['steaming', 'wet', 'steam_complete'],
    ['wet', 'spent', 'wet_complete'],
  ])
})

check(() => {
  let torch = createTorchState()
  torch = stepTorch(torch, 250, {
    confirmedExactHold: true,
    rainWet: true,
    paused: false,
  })
  assert.equal(torch.phase, 'wet')
  assert.equal(torch.heldMs, 0)
  assert.equal(torch.recentTransitions.at(-1)?.cause, 'rain')
  assert.equal('noteHit' in torch, false)
  assert.equal('score' in torch, false)
  assert.equal('lockEvent' in torch, false)
})

check(() => {
  const rain = advanceRain(createRainState(), RAINCALL_TIMINGS.chargingMs)
  const pausedRain = stepRain(rain, 250, { paused: true, activated: true })
  assert.deepEqual(pausedRain, rain)
  let torch = createTorchState()
  torch = stepTorch(torch, 250, { confirmedExactHold: true, rainWet: false })
  const pausedTorch = stepTorch(torch, 250, { confirmedExactHold: false, rainWet: true, paused: true })
  assert.deepEqual(pausedTorch, torch)
  assert.ok(rain.recentTransitions.length <= MAX_RECENT_RAIN_TRANSITIONS)
  assert.ok(torch.recentTransitions.length <= MAX_RECENT_TORCH_TRANSITIONS)
})

check(() => {
  // Dropped-frame recovery cannot leap more than the 250 ms game-frame cap.
  const rain = stepRain(createRainState(), 10_000)
  assert.equal(rain.elapsedMs, MAX_RAIN_STEP_MS)
  const torch = stepTorch(createTorchState(), 10_000, { confirmedExactHold: true })
  assert.equal(torch.heldMs, MAX_RAIN_STEP_MS)
})

console.log(`pitchforks rain ecology state machines: ${checks}/${checks} PASS`)
