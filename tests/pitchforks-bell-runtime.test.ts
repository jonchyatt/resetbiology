import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  advancePitchforksBellWave,
  createPitchforksBellWaveState,
  releasePitchforksBellWave,
  resetPitchforksBellWaveState,
} from '../src/components/PitchDefender/pitchforksBellWave'

const source = readFileSync(resolve(process.cwd(), 'src/components/PitchDefender/PitchforksIII.tsx'), 'utf8').replace(/\r\n/g, '\n')
let checks = 0
const check = (run: () => void): void => {
  run()
  checks += 1
}

const roster = (...villagers: Array<{ stableID: string; x: number; y: number; walking?: boolean }>) => villagers

check(() => {
  assert.match(source, /from ['"]\.\/pitchforksBellWave['"]/, 'runtime imports the pure Bell lifecycle')
  assert.match(source, /from ['"]\.\/pitchforksBellWaveView['"]/, 'runtime imports the pure wave renderer')
  assert.match(source, /params\.get\('worldProof'\) === 'bell-tower'/, 'Bell proof flag remains explicitly selected; normal access is covered by earned-power-access')
  assert.match(source, /const BELL_WAVE_ORIGIN = Object\.freeze\(\{ x: 274\.5, y: 61\.5 \}\)/, 'measured Bell origin is explicit')
  assert.match(source, /data-testid="pf3-bell-arm"/, 'charge control has a stable recorder hook')
  assert.match(source, /data-testid="pf3-bell-release"/, 'release control has a stable recorder hook')
  assert.match(source, /data-bell-phase=\{bellWaveState\.phase\}/, 'phase diagnostic is read-only projection')
  assert.match(source, /data-bell-radius=\{bellWaveProjection\.radius\.toFixed\(1\)\}/, 'radius diagnostic uses the shared projection')
  assert.match(source, /data-bell-contact-count=\{bellWaveState\.contactedStableIDs\.length\}/, 'contact diagnostic uses lifecycle receipts')
  assert.match(source, /bellOwnRingSuppressionUntilRef = useRef\(0\)/, 'own-ring suppression has a dedicated lifetime marker')
  assert.match(source, /bellOwnRingSuppressionUntilRef\.current = ringStartedAtMs \+ ringSuppressMs/, 'own-ring marker uses the exact ring plus echo tail')
  assert.match(source, /sfxVolumeRef\.current > 0 && bellLastRingReceiptIdRef\.current !== decision\.intent\.receiptId/, 'audio side effects are gated by volume and prior receipt')
  assert.match(source, /bellRingCountRef\.current \+= 1/, 'audible-ring diagnostic increments once')
  assert.match(source, /state\.phase !== 'idle' && state\.phase !== 'finished'/, 'Bell can charge again after a finished wave')
  assert.match(source, /current\.phase === 'idle' \|\| current\.phase === 'finished'/, 'Bell can release another unique receipt after finish')
  assert.match(source, /const direction: 1 = 1/, 'Bell knockback always pushes villagers away from Frank')
})

check(() => {
  const bellLifecycle = source.slice(source.indexOf('const advanceBellWaveLifecycle'), source.indexOf('const applyBellKnockback'))
  assert.ok(bellLifecycle.length > 0)
  assert.match(bellLifecycle, /walkingVillagers: releaseRoster/, 'release snapshots the live walking roster')
  assert.match(bellLifecycle, /\.filter\(villager => releaseIDs\.has\(villager\.stableID\)\)/, 'advance filters to release-time stable IDs')
  assert.match(bellLifecycle, /commitBellWaveState\(decision\.state/, 'accepted lifecycle state is published before contact effects')
  assert.doesNotMatch(bellLifecycle, /strikeActiveTine\(/, 'Bell contact path never invokes musical strike authority')
  assert.doesNotMatch(bellLifecycle, /reviewTargetNote\(/, 'Bell contact path never invokes FSRS review authority')
})

check(() => {
  const chargePath = source.slice(source.indexOf('const confirmBellCharge'), source.indexOf('const requestBellArm'))
  assert.match(chargePath, /bellChargeReceiptRef\.current = receipt/, 'exact charge mints one private receipt')
  assert.match(chargePath, /bellArmRequestedRef\.current = false/, 'charge consumes the arm request once')
  assert.doesNotMatch(chargePath, /strikeActiveTine\(/, 'charging does not burn a tine')
  assert.doesNotMatch(chargePath, /reviewTargetNote\(/, 'charging does not grade FSRS')

  const lockPath = source.slice(source.indexOf('const processLock'), source.indexOf('const updateGame'))
  const bellGate = lockPath.indexOf("pauseSparkGuide('bell-lifecycle')")
  const closeGate = lockPath.indexOf("pauseSparkGuide('close-smash-lifecycle')")
  const thunderheadGate = lockPath.indexOf("pauseSparkGuide('thunderhead-lifecycle')")
  assert.ok(bellGate >= 0 && bellGate < closeGate && bellGate < thunderheadGate, 'Bell owns processLock before competing abilities')
  assert.match(lockPath, /confirmBellCharge\(target/, 'exact hold resolves through Bell charge consumer')
  assert.match(lockPath, /return\n\s*}\n\s*if \(galvanicRouteAvailable\(\)/, 'Bell charge returns before Galvanic or ordinary fallback')
})

check(() => {
  const initial = createPitchforksBellWaveState()
  const release = releasePitchforksBellWave(initial, {
    receipt: { receiptId: 'bell-charge:test:1' },
    releaseEligible: true,
    logicalTimeMs: 0,
    bellOrigin: { x: 0, y: 0 },
    waveSpeed: 1,
    waveDurationMs: 160,
    walkingVillagers: roster(
      { stableID: 'near', x: 20, y: 0 },
      { stableID: 'far', x: 80, y: 0 },
    ),
  })
  assert.equal(release.accepted, true)
  const crossed = advancePitchforksBellWave(release.state, {
    logicalTimeMs: 100,
    walkingVillagers: roster(
      { stableID: 'near', x: 12, y: 0 },
      { stableID: 'far', x: 68, y: 0 },
    ),
  })
  assert.deepEqual(crossed.intents.map(intent => intent.stableID), ['near', 'far'])
  assert.deepEqual(crossed.state.contactedStableIDs, ['near', 'far'])
  assert.equal(crossed.intents[0]?.kind, 'bell-wave-contact')
})

check(() => {
  const released = releasePitchforksBellWave(createPitchforksBellWaveState(), {
    receipt: { receiptId: 'bell-charge:test:once' },
    releaseEligible: true,
    logicalTimeMs: 0,
    bellOrigin: { x: 0, y: 0 },
    waveSpeed: 1,
    waveDurationMs: 50,
    walkingVillagers: roster({ stableID: 'release-only', x: 20, y: 0 }),
  }).state
  const lateSpawn = advancePitchforksBellWave(released, {
    logicalTimeMs: 30,
    walkingVillagers: roster(
      { stableID: 'release-only', x: 20, y: 0 },
      { stableID: 'late-spawn', x: 2, y: 0 },
    ),
  })
  assert.deepEqual(lateSpawn.intents.map(intent => intent.stableID), ['release-only'])
  const finished = advancePitchforksBellWave(lateSpawn.state, {
    logicalTimeMs: 80,
    walkingVillagers: roster({ stableID: 'release-only', x: 20, y: 0 }),
  })
  const duplicate = releasePitchforksBellWave(finished.state, {
    receipt: { receiptId: 'bell-charge:test:once' },
    releaseEligible: true,
    logicalTimeMs: 80,
    bellOrigin: { x: 0, y: 0 },
    waveSpeed: 1,
    waveDurationMs: 50,
    walkingVillagers: roster({ stableID: 'release-only', x: 20, y: 0 }),
  })
  assert.equal(duplicate.accepted, false)
  assert.equal(duplicate.reason, 'duplicate-receipt')
  const reset = resetPitchforksBellWaveState(finished.state)
  assert.equal(reset.phase, 'idle')
  assert.deepEqual(reset.consumedReceiptIds, [])
})

check(() => {
  const pausePath = source.slice(source.indexOf('const bellPausedAtFrameStart'), source.indexOf('const bellLogicalNowMs') + 160)
  assert.match(pausePath, /!pageVisible \|\| environmentalClockPausedNow\(bellOwnRingSuppressionActive\)/, 'Bell uses its own pause decision rather than the echo-suppressed environmental clock')
  assert.match(source, /const bellOwnRingSuppressionActive = \(bellWaveStateRef\.current\.phase === 'active' \|\| bellWaveStateRef\.current\.phase === 'finished'\) && bellOwnRingSuppressionUntilRef\.current > performance\.now\(\)/, 'only the own-ring lifetime bypasses matching suppression')
  assert.match(source, /const bellLogicalNowMs = advancePitchforksLogicalClock\(/, 'Bell uses the shared bounded clock primitive')
  assert.match(source, /const resetBellWave = useCallback/, 'Bell lifecycle has explicit reset')
  assert.match(source, /resetBellWave\(\)\n\s*resetRangeMatch/, 'new game reset clears Bell receipt state')
})

check(() => {
  const body = source.match(/const environmentalClockPausedNow = useCallback\(\(ignoreMatchingSuppression = false\) => \{([\s\S]*?)\n  }, \[matchingSuppressedNow\]\)/)?.[1]
  assert.ok(body, 'exercise the actual mounted pause callback body')
  const pause = new Function('ignoreMatchingSuppression', 'inputModeRef', 'demoRef', 'isListeningRef', 'micErrorRef', 'ceremonyRef', 'matchingSuppressedNow', body) as (...args: unknown[]) => boolean
  for (const ownRingActive of [false, true]) for (const suppressed of [false, true]) for (const ceremony of [false, true]) for (const micUnavailable of [false, true]) {
    const actual = pause(ownRingActive, { current: 'voice' }, { current: false }, { current: !micUnavailable }, { current: null }, { current: { active: ceremony } }, () => suppressed)
    assert.equal(actual, ceremony || micUnavailable || (!ownRingActive && suppressed), `own-ring=${ownRingActive}, echo=${suppressed}, ceremony=${ceremony}, unavailable=${micUnavailable}`)
  }
})

check(() => {
  const expression = source.match(/const bellOwnRingSuppressionActive = ([^\n]+)\n\s*const bellPausedAtFrameStart/)?.[1]
  assert.ok(expression, 'extract the mounted own-ring lifetime expression')
  const ownRingActive = new Function('bellWaveStateRef', 'bellOwnRingSuppressionUntilRef', 'nowMs', `const performance = { now: () => nowMs }; return ${expression}`) as (...args: unknown[]) => boolean
  const activeState = { current: { phase: 'active' } }
  const finishedState = { current: { phase: 'finished' } }
  const idleState = { current: { phase: 'idle' } }
  const marker = { current: 1550 }
  assert.equal(ownRingActive(activeState, marker, 1200), true)
  assert.equal(ownRingActive(finishedState, marker, 1500), true)
  assert.equal(ownRingActive(finishedState, marker, 1550), false)
  assert.equal(ownRingActive(idleState, marker, 1200), false)
})

check(() => {
  const audioBlock = source.match(/(if \(sfxVolumeRef\.current > 0 && bellLastRingReceiptIdRef\.current !== decision\.intent\.receiptId\) \{[\s\S]*?\n      \})\n      lockHeldMsRef\.current = 0/)?.[1]
  assert.ok(audioBlock, 'extract the mounted accepted-release audio/count block')
  const runAudioBlock = new Function(
    'sfxVolumeRef',
    'bellLastRingReceiptIdRef',
    'bellRingCountRef',
    'bellOwnRingSuppressionUntilRef',
    'matchingSuppressedUntilRef',
    'decision',
    'receipt',
    'performance',
    'PITCHFORKS_BELL_RING_MS',
    'ECHO_TAIL_MS',
    'markToneEmitted',
    'localSfx',
    `${audioBlock}`,
  ) as (...args: unknown[]) => void
  const sfxVolumeRef = { current: 80 }
  const bellLastRingReceiptIdRef = { current: null as string | null }
  const bellRingCountRef = { current: 0 }
  const bellOwnRingSuppressionUntilRef = { current: 0 }
  const matchingSuppressedUntilRef = { current: 5000 }
  const calls: string[][] = []
  const emitted: number[] = []
  const decision = { intent: { receiptId: 'bell-charge:accepted', } }
  const receipt = { note: 'C4' }
  const run = () => runAudioBlock(
    sfxVolumeRef,
    bellLastRingReceiptIdRef,
    bellRingCountRef,
    bellOwnRingSuppressionUntilRef,
    matchingSuppressedUntilRef,
    decision,
    receipt,
    { now: () => 1000 },
    1200,
    350,
    (suppressMs: number) => emitted.push(suppressMs),
    (...args: unknown[]) => calls.push(args.map(String)),
  )
  run()
  assert.equal(bellRingCountRef.current, 1)
  assert.equal(bellLastRingReceiptIdRef.current, 'bell-charge:accepted')
  assert.equal(bellOwnRingSuppressionUntilRef.current, 2550)
  assert.equal(matchingSuppressedUntilRef.current, 5000, 'a longer existing suppression window is not shortened')
  assert.deepEqual(emitted, [1550])
  assert.deepEqual(calls, [['bell', '80', 'C4']])
  run()
  assert.equal(bellRingCountRef.current, 1, 'same accepted receipt cannot schedule or count twice')
  assert.equal(calls.length, 1)
  sfxVolumeRef.current = 0
  decision.intent.receiptId = 'bell-charge:muted'
  run()
  assert.equal(bellRingCountRef.current, 1, 'muted accepted release is not claimed audible')
  assert.equal(bellLastRingReceiptIdRef.current, 'bell-charge:accepted')
  assert.equal(calls.length, 1)
})

check(() => {
  const knockback = source.slice(source.indexOf('const applyBellKnockback'), source.indexOf('const answerWithButton'))
  assert.match(knockback, /BELL_KNOCKBACK_DISTANCE/, 'contact applies bounded world displacement')
  assert.match(knockback, /villager\.x = clamp\(nextX/, 'knockback mutates the live villager position')
  assert.match(knockback, /villager\.state !== 'walking' \|\| villager\.burned >= villager\.totalTines/, 'contact revalidates walking and unspent state')
  assert.match(source, /drawPitchforksBellWave\(ctx,/, 'render uses the pure wave view')
})

console.log(`pitchforks Bell runtime integration: ${checks}/${checks} PASS (source + pure lifecycle harness)`)
