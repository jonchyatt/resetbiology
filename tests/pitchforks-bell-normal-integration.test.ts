import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  acceptPitchforksBellPowerActivationNote,
  acceptPitchforksBellPowerCombatResponse,
  acknowledgePitchforksBellPowerWaveRelease,
  cancelPitchforksBellPowerActivation,
  createPitchforksBellPowerState,
  startPitchforksBellPowerActivation,
} from '../src/components/PitchDefender/pitchforksBellPower'
import { selectPitchforksBellTaughtPair } from '../src/components/PitchDefender/PitchforksIII'

const source = readFileSync(
  new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url),
  'utf8',
)

let checks = 0
const check = (run: () => void): void => {
  run()
  checks += 1
}

check(() => {
  assert.match(source, /from ['"]\.\/pitchforksBellPower['"]/) 
  assert.match(source, /const normalBellRouteAvailable = useCallback\(\(\) => \(/)
  assert.match(source, /const resetNormalBellPowerForRun = useCallback\(/)
  assert.match(source, /useRef<PitchforksBellPowerState \| null>\(null\)/)
  assert.match(source, /runId: `bell-power:\$\{runGenerationRef\.current\}`/)
  assert.match(source, /selectedWorldRef\.current === ['"]village-gate['"]/) 
  assert.match(source, /presentationJourneyRef\.current\?\.dungeonClear !== undefined/)
  assert.match(source, /requiredResponses: 3/)
})

check(() => {
  // Source-contract: the lifecycle reset only swaps its run-local Bell state;
  // it must not write campaign, mastery, or learning evidence.
  const resetStart = source.indexOf('const resetNormalBellPowerForRun')
  const resetEnd = source.indexOf('const selectNormalWorld', resetStart)
  assert.ok(resetStart >= 0 && resetEnd > resetStart)
  assert.doesNotMatch(source.slice(resetStart, resetEnd), /savePresentationJourney|saveFsrs|saveMasteryProgress|localStorage/)
})

check(() => {
  const taughtPair = selectPitchforksBellTaughtPair(['C5', 'D4', 'E4'])
  assert.deepEqual(taughtPair, ['D4', 'E4'])
  assert.deepEqual(selectPitchforksBellTaughtPair(['D4', 'E4']), ['D4', 'E4'], 'assessed D4/E4 pool is independent of STARTING_NOTES')
  const tiedPool = ['G4', 'A4', 'C4', 'D4']
  assert.deepEqual(selectPitchforksBellTaughtPair(tiedPool), ['C4', 'D4'])
  assert.deepEqual(selectPitchforksBellTaughtPair([...tiedPool].reverse()), ['C4', 'D4'], 'equal-distance pair ties are canonical across pool permutations')
  assert.equal(selectPitchforksBellTaughtPair(['D4']), null)
  assert.equal(selectPitchforksBellTaughtPair(['D4', 'D5']), null, 'an octave-spanning pair is unavailable rather than an invalid controller')
})

check(() => {
  const config = {
    runId: 'bell-power:7',
    requiredResponses: 3,
    admittedNotes: ['D4', 'E4'],
    taughtPair: ['D4', 'E4'] as const,
  }
  let state = createPitchforksBellPowerState(config)
  for (const [index, note] of ['D4', 'E4', 'D4'].entries()) {
    const decision = acceptPitchforksBellPowerCombatResponse(state, {
      runId: state.runId,
      eventId: `combat:${state.runId}:${index + 1}:0:0`,
      note,
      lane: 'voice',
      source: 'combat',
      correct: true,
    })
    assert.equal(decision.accepted, true)
    state = decision.state
  }
  assert.equal(state.charge, 3)
  assert.equal(state.phase, 'ready')
  assert.deepEqual(state.consumedEventIds, [
    'combat:bell-power:7:1:0:0',
    'combat:bell-power:7:2:0:0',
    'combat:bell-power:7:3:0:0',
  ])
})

check(() => {
  let state = createPitchforksBellPowerState({
    runId: 'normal-guards',
    requiredResponses: 3,
    admittedNotes: ['C4', 'A4'],
    taughtPair: ['C4', 'A4'],
  })
  const accepted = acceptPitchforksBellPowerCombatResponse(state, {
    runId: state.runId,
    eventId: 'target-1',
    note: 'C4',
    lane: 'voice',
    source: 'combat',
    correct: true,
  })
  state = accepted.state
  const duplicate = acceptPitchforksBellPowerCombatResponse(state, {
    runId: state.runId,
    eventId: 'target-1',
    note: 'C4',
    lane: 'voice',
    source: 'combat',
    correct: true,
  })
  assert.equal(duplicate.reason, 'duplicate-event')
  assert.equal(duplicate.state.charge, 1)

  for (const [eventId, patch] of [
    ['demo', { demo: true }],
    ['simulated', { simulated: true }],
    ['wrong-lane', { lane: 'buttons' }],
    ['wrong-source', { source: 'mic' }],
    ['wrong-note', { note: 'A4', correct: false }],
  ] as const) {
    const rejected = acceptPitchforksBellPowerCombatResponse(state, {
      runId: state.runId,
      eventId,
      note: 'C4',
      lane: 'voice',
      source: 'combat',
      correct: true,
      ...patch,
    } as never)
    state = rejected.state
    assert.equal(rejected.accepted, false)
  }
  assert.equal(state.charge, 1)
  assert.equal(state.phase, 'charging')
})

check(() => {
  // A target key may repeat after a new run resets the villager counter; the
  // run identity keeps the old event stale while allowing the fresh event.
  const oldRun = createPitchforksBellPowerState({
    runId: 'bell-power:11',
    requiredResponses: 3,
    admittedNotes: ['D4', 'E4'],
    taughtPair: ['D4', 'E4'],
  })
  const freshRun = createPitchforksBellPowerState({
    runId: 'bell-power:12',
    requiredResponses: 3,
    admittedNotes: ['D4', 'E4'],
    taughtPair: ['D4', 'E4'],
  })
  const stale = acceptPitchforksBellPowerCombatResponse(freshRun, {
    runId: oldRun.runId,
    eventId: `combat:${oldRun.runId}:1:0`,
    note: 'D4',
    lane: 'voice',
    source: 'combat',
    correct: true,
  })
  assert.equal(stale.accepted, false)
  assert.equal(stale.reason, 'stale-run')
  const fresh = acceptPitchforksBellPowerCombatResponse(freshRun, {
    runId: freshRun.runId,
    eventId: `combat:${freshRun.runId}:1:0`,
    note: 'D4',
    lane: 'voice',
    source: 'combat',
    correct: true,
  })
  assert.equal(fresh.accepted, true)
})

check(() => {
  assert.match(source, /if \(lane === ['"]voice['"]\) acceptNormalBellCombatResponse\(target\)/)
  assert.match(source, /const expectedRunId = `bell-power:\$\{runGenerationRef\.current\}`/)
  assert.match(source, /current\.runId !== expectedRunId/)
  assert.match(source, /eventId: `combat:\$\{expectedRunId\}:\$\{target\.key\}`/)
  assert.doesNotMatch(source, /acceptNormalBellCombatResponse\(.*pitchRef\.current/)
  assert.match(source, /if \(decision\.state !== current\) commitBellPowerState\(decision\.state\)/)
  assert.match(source, /resetNormalBellPowerForRun\(normalBellRouteAvailable\(\)\)/)
})

check(() => {
  // Source-contract: normal Village owns the same Bell pixels and a bounded
  // amber dock, with an explicit cancel path for the non-spending lesson.
  assert.match(source, /acceptPitchforksBellPowerActivationNote/)
  assert.match(source, /startPitchforksBellPowerActivation/)
  assert.match(source, /cancelPitchforksBellPowerActivation/)
  assert.match(source, /const cancelBellActivation = useCallback\(/)
  assert.match(source, /data-testid="pf3-bell-pair"/)
  assert.match(source, /data-testid="pf3-bell-step"/)
  assert.match(source, /data-testid="pf3-bell-cancel"/)
  assert.match(source, /renderResting: view\.normalWorld === ['"]village-gate['"]\s*,/)
  assert.match(source, /bellProofRef\.current \|\| \(!demoRef\.current && !fsrsDebugRef\.current\)/)
})

check(() => {
  // Source-contract: activation is fenced by fresh detector generations and
  // the existing mic health/exact-cents/hold authorities. It cannot fall into
  // ordinary review, strike, or tine-credit consumers.
  const activationStart = source.indexOf('const processNormalBellActivation')
  const activationEnd = source.indexOf('const advanceBellWaveLifecycle', activationStart)
  assert.ok(activationStart >= 0 && activationEnd > activationStart)
  const activationSource = source.slice(activationStart, activationEnd)
  for (const token of [
    'observePitchforksSongcraftGeneration',
    'micSourceHealthRef.current',
    'pitchforksMicUnreliable',
    'pitchRef.current',
    'exactCents',
    'HOLD_MS',
    'observation.generationAdvanced',
  ]) assert.match(activationSource, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.doesNotMatch(activationSource, /reviewTargetNote|strikeActiveTine|acceptNormalBellCombatResponse/)
})

check(() => {
  // Wrong input and cancellation clear only the teaching attempt. The earned
  // three-response charge remains until one accepted pair release.
  const config = {
    runId: 'bell-power:activation-negative',
    requiredResponses: 3,
    admittedNotes: ['D4', 'E4'],
    taughtPair: ['D4', 'E4'] as const,
  }
  let state = createPitchforksBellPowerState(config)
  for (const [index, note] of ['D4', 'E4', 'D4'].entries()) {
    state = acceptPitchforksBellPowerCombatResponse(state, {
      runId: state.runId,
      eventId: `combat:${index}`,
      note,
      lane: 'voice',
      source: 'combat',
      correct: true,
    }).state
  }
  state = startPitchforksBellPowerActivation(state).state
  const wrong = acceptPitchforksBellPowerActivationNote(state, {
    runId: state.runId,
    eventId: 'activation:wrong-order',
    note: 'E4',
    confirmed: true,
  })
  assert.equal(wrong.accepted, false)
  assert.equal(wrong.reason, 'wrong-order')
  assert.equal(wrong.state.phase, 'ready')
  assert.equal(wrong.state.charge, 3)

  state = startPitchforksBellPowerActivation(wrong.state).state
  const cancelled = cancelPitchforksBellPowerActivation(state)
  assert.equal(cancelled.accepted, true)
  assert.equal(cancelled.state.phase, 'ready')
  assert.equal(cancelled.state.charge, 3)
  assert.equal(cancelled.state.pendingReceipt, null)
})

check(() => {
  // A correct ordered pair mints one receipt. Failed acknowledgement keeps
  // that receipt/charge for retry; only success spends it, once.
  let state = createPitchforksBellPowerState({
    runId: 'bell-power:activation-positive',
    requiredResponses: 3,
    admittedNotes: ['D4', 'E4'],
    taughtPair: ['D4', 'E4'],
  })
  for (const [index, note] of ['D4', 'E4', 'D4'].entries()) {
    state = acceptPitchforksBellPowerCombatResponse(state, {
      runId: state.runId,
      eventId: `combat:${index}`,
      note,
      lane: 'voice',
      source: 'combat',
      correct: true,
    }).state
  }
  state = startPitchforksBellPowerActivation(state).state
  state = acceptPitchforksBellPowerActivationNote(state, {
    runId: state.runId,
    eventId: 'activation:first',
    note: 'D4',
    confirmed: true,
  }).state
  const completed = acceptPitchforksBellPowerActivationNote(state, {
    runId: state.runId,
    eventId: 'activation:second',
    note: 'E4',
    confirmed: true,
  })
  assert.equal(completed.accepted, true)
  assert.equal(completed.completed, true)
  assert.equal(completed.state.phase, 'pending')
  assert.ok(completed.state.pendingReceipt)
  assert.equal(completed.state.charge, 3)

  const failed = acknowledgePitchforksBellPowerWaveRelease(completed.state, {
    runId: completed.state.runId,
    receiptId: completed.state.pendingReceipt!.receiptId,
    released: false,
  })
  assert.equal(failed.accepted, true)
  assert.equal(failed.spent, false)
  assert.equal(failed.state.phase, 'pending')
  assert.equal(failed.state.charge, 3)
  assert.ok(failed.state.pendingReceipt)

  const released = acknowledgePitchforksBellPowerWaveRelease(failed.state, {
    runId: failed.state.runId,
    receiptId: failed.state.pendingReceipt!.receiptId,
    released: true,
  })
  assert.equal(released.accepted, true)
  assert.equal(released.spent, true)
  assert.equal(released.state.phase, 'charging')
  assert.equal(released.state.charge, 0)
  assert.equal(released.state.pendingReceipt, null)

  const duplicate = acknowledgePitchforksBellPowerWaveRelease(released.state, {
    runId: released.state.runId,
    receiptId: completed.state.pendingReceipt!.receiptId,
    released: true,
  })
  assert.equal(duplicate.accepted, false)
  assert.equal(duplicate.reason, 'duplicate-acknowledgement')
})

check(() => {
  // Source-contract: empty rosters and rejected release decisions return
  // before normal acknowledgement, so retry remains possible.
  const lifecycleStart = source.indexOf('const advanceBellWaveLifecycle')
  const lifecycleEnd = source.indexOf('const applyBellKnockback', lifecycleStart)
  assert.ok(lifecycleStart >= 0 && lifecycleEnd > lifecycleStart)
  const lifecycleSource = source.slice(lifecycleStart, lifecycleEnd)
  assert.match(lifecycleSource, /releaseRoster\.length === 0/)
  assert.match(lifecycleSource, /acknowledgePitchforksBellPowerWaveRelease/)
  assert.match(lifecycleSource, /if \(acknowledgement\.spent\)/)
  assert.match(lifecycleSource, /normalReceipt && normalState/)
})

console.log(`pitchforks normal Bell integration seam: ${checks}/${checks} PASS (harness only; source-contract checks are not visible acceptance)`)
