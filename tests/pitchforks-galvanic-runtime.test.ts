import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  createPitchforksGalvanicState,
  planPitchforksGalvanicSweep,
  type PitchforksGalvanicLock,
  type PitchforksGalvanicRequest,
  type PitchforksGalvanicTarget,
} from '../src/components/PitchDefender/pitchforksGalvanic'
import {
  createPitchforksThunderheadState,
  PITCHFORKS_THUNDERHEAD_MAX_BANK_CAPACITY,
} from '../src/components/PitchDefender/pitchforksThunderhead'

// This is a runtime-source integration check: helper plans are executable,
// while component assertions prove the real import and dispatch seams. It does
// not claim mounted gameplay or browser acceptance.
const source = readFileSync(resolve(process.cwd(), 'src/components/PitchDefender/PitchforksIII.tsx'), 'utf8').replace(/\r\n/g, '\n')

let checks = 0
const check = (condition: boolean, message: string) => {
  assert.equal(condition, true, message)
  checks += 1
}

const tine = (overrides: Partial<PitchforksGalvanicTarget> = {}): PitchforksGalvanicTarget => ({
  targetKey: 'villager-a:0',
  note: 'C4',
  octave: 4,
  ...overrides,
})

const lock = (overrides: Partial<PitchforksGalvanicLock> = {}): PitchforksGalvanicLock => ({
  lockId: 'galvanic-lock-a',
  battleId: 'galvanic-proof-battle',
  targetKey: 'villager-a:0',
  note: 'C4',
  octave: 4,
  ...overrides,
})

const requestFor = (
  state: ReturnType<typeof createPitchforksGalvanicState>,
  overrides: Partial<PitchforksGalvanicRequest> = {},
): PitchforksGalvanicRequest => ({
  battleId: state.battleId,
  attackId: 'galvanic-attack-1',
  expectedVersion: state.version,
  tines: [tine()],
  locks: [lock()],
  ...overrides,
})

check(
  source.includes("from './pitchforksGalvanic'") &&
    source.includes('createPitchforksGalvanicState') &&
    source.includes('planPitchforksGalvanicSweep(state, request)') &&
    source.includes('type PitchforksGalvanicLock'),
  'component imports and calls the accepted Galvanic helper through the real runtime seam',
)

const proofState = createPitchforksGalvanicState('galvanic-proof-battle')
const proofTines = [
  tine({ targetKey: 'villager-a:0', note: 'C4', octave: 4 }),
  tine({ targetKey: 'villager-b:0', note: 'C4', octave: 4 }),
  tine({ targetKey: 'villager-c:0', note: 'E4', octave: 4 }),
]
const proofLocks = [
  lock({ lockId: 'galvanic-lock-a', targetKey: 'villager-a:0', note: 'C4', octave: 4 }),
  lock({ lockId: 'galvanic-lock-b', targetKey: 'villager-b:0', note: 'C4', octave: 4 }),
]
const full = planPitchforksGalvanicSweep(proofState, requestFor(proofState, {
  attackId: 'galvanic-full-release',
  tines: proofTines,
  locks: proofLocks,
}))
check(
  full.accepted &&
    full.outcomes.length === 3 &&
    full.outcomes[0]?.kind === 'strike' &&
    full.outcomes[0]?.targetKey === 'villager-a:0' &&
    full.outcomes[1]?.kind === 'strike' &&
    full.outcomes[1]?.targetKey === 'villager-b:0' &&
    full.outcomes[2]?.kind === 'recoil' &&
    full.outcomes[2]?.targetKey === 'villager-c:0' &&
    full.nextState.consumedLockIds.join('|') === 'galvanic-lock-a|galvanic-lock-b' &&
    full.nextState.processedAttackIds.includes('galvanic-full-release'),
  'full two-bank sweep produces two strikes and a third-target presentation recoil',
)

const partialState = createPitchforksGalvanicState('galvanic-partial-battle')
const partial = planPitchforksGalvanicSweep(partialState, requestFor(partialState, {
  attackId: 'galvanic-partial-release',
  tines: proofTines,
  locks: [lock({ battleId: partialState.battleId })],
}))
check(
  partial.accepted &&
    partial.outcomes.filter(outcome => outcome.kind === 'strike').length === 1 &&
    partial.outcomes.filter(outcome => outcome.kind === 'recoil').length === 2 &&
    partial.nextState.consumedLockIds.length === 1,
  'partial one-bank sweep produces one strike and two revalidated unbacked recoils',
)

const mismatchCases: Array<{ label: string; target: PitchforksGalvanicTarget; receipt: PitchforksGalvanicLock }> = [
  {
    label: 'wrong note',
    target: tine({ note: 'D4' }),
    receipt: lock({ note: 'C4' }),
  },
  {
    label: 'wrong octave',
    target: tine({ note: 'C5', octave: 5 }),
    receipt: lock({ note: 'C4', octave: 4 }),
  },
  {
    label: 'wrong target',
    target: tine({ targetKey: 'villager-b:0' }),
    receipt: lock({ targetKey: 'villager-a:0' }),
  },
]
for (const mismatch of mismatchCases) {
  const state = createPitchforksGalvanicState(`galvanic-${mismatch.label.replace(' ', '-')}`)
  const result = planPitchforksGalvanicSweep(state, requestFor(state, {
    attackId: `galvanic-${mismatch.label.replace(' ', '-')}`,
    tines: [mismatch.target],
    locks: [{ ...mismatch.receipt, battleId: state.battleId }],
  }))
  check(
    result.accepted && result.outcomes.length === 1 && result.outcomes[0]?.kind === 'recoil' && result.nextState.consumedLockIds.length === 0,
    `${mismatch.label} cannot convert a bank into a strike`,
  )
}

const staleState = createPitchforksGalvanicState('galvanic-stale-battle')
const stale = planPitchforksGalvanicSweep(staleState, requestFor(staleState, {
  attackId: 'galvanic-stale-release',
  // The dead/burned target is absent from the live snapshot; only the live
  // target is eligible for a recoil presentation.
  tines: [tine({ targetKey: 'villager-live:0', note: 'E4' })],
  locks: [lock({ targetKey: 'villager-dead:0', note: 'C4', battleId: staleState.battleId })],
}))
check(
  stale.accepted && stale.outcomes[0]?.kind === 'recoil' && stale.outcomes[0]?.targetKey === 'villager-live:0' && stale.nextState.consumedLockIds.length === 0,
  'stale/dead/burned receipts cannot retarget a live tine or consume the stale lock',
)

const cancelledState = createPitchforksGalvanicState('galvanic-cancel-battle')
const cancelled = planPitchforksGalvanicSweep(cancelledState, requestFor(cancelledState, { cancelled: true }))
check(
  !cancelled.accepted && cancelled.reason === 'cancelled' && cancelled.nextState === cancelledState && cancelled.outcomes.length === 0,
  'cancel produces no helper effects and preserves the current ledger identity',
)

const duplicateState = createPitchforksGalvanicState('galvanic-duplicate-battle')
const firstRelease = planPitchforksGalvanicSweep(duplicateState, requestFor(duplicateState, {
  attackId: 'galvanic-duplicate-release',
}))
const duplicateRelease = planPitchforksGalvanicSweep(firstRelease.nextState, requestFor(firstRelease.nextState, {
  attackId: 'galvanic-duplicate-release',
}))
check(
  firstRelease.accepted && !duplicateRelease.accepted && duplicateRelease.reason === 'duplicate-attack' && duplicateRelease.nextState === firstRelease.nextState && duplicateRelease.outcomes.length === 0,
  'duplicate release is rejected before any second effect can run',
)

const zeroBankState = createPitchforksGalvanicState('galvanic-zero-bank-battle')
const zeroBank = planPitchforksGalvanicSweep(zeroBankState, requestFor(zeroBankState, {
  attackId: 'galvanic-zero-bank-release',
  tines: proofTines,
  locks: [],
}))
check(
  zeroBank.accepted && zeroBank.outcomes.every(outcome => outcome.kind === 'recoil') && zeroBank.nextState.consumedLockIds.length === 0,
  'zero-bank release has no strike activation and only returns presentation recoils',
)

const processSource = source.slice(
  source.indexOf('const processLock = useCallback'),
  source.indexOf('const updateGame = useCallback'),
)
const getActiveTargetSource = source.slice(
  source.indexOf('const getActiveTarget = useCallback'),
  source.indexOf('const syncRainSnapshot = useCallback'),
)
const sourceSample = processSource.indexOf('const source =')
const suppressionGate = processSource.indexOf('if (matchingSuppressedNow()) return')
const silenceGate = processSource.indexOf('if (galvanicAwaitingSilenceRef.current)')
const exactGalvanicBranch = processSource.indexOf('if (galvanicArmRequestedRef.current)')
const ordinaryCredit = processSource.indexOf('strikeActiveTine(target)')
check(
  sourceSample >= 0 && suppressionGate > sourceSample && silenceGate > suppressionGate &&
    processSource.includes('if (source?.isActive)') &&
    processSource.includes("galvanicAwaitingSilenceRef.current = false") &&
    exactGalvanicBranch >= 0 &&
    processSource.includes('confirmGalvanicLock(target)') &&
    processSource.indexOf('confirmGalvanicLock(target)') < ordinaryCredit &&
    processSource.includes("galvanicRouteAvailable() && galvanicBanksRef.current.length > 0") &&
    processSource.includes("return\n        }\n        // A Thunderhead arming request"),
  're-onset samples after target-change/suppression and the armed Galvanic branch returns before ordinary credit',
)
check(
  processSource.includes('galvanicArmRequestedRef.current = false') &&
    processSource.includes("galvanicLastReasonRef.current = 'stale-target'") &&
    processSource.includes('publishGalvanicProjection()'),
    'a lost armed target disarms instead of freezing or falling through to ordinary play',
)
check(
  getActiveTargetSource.includes('const candidates = liveGalvanicTargets') &&
    getActiveTargetSource.includes('return candidates.find(target => !bankedKeys.has(target.key)) ?? null') &&
    !getActiveTargetSource.includes('length >= GALVANIC_BANK_CAPACITY) return null') &&
    processSource.includes('if (galvanicRouteAvailable() && galvanicBanksRef.current.length >= GALVANIC_BANK_CAPACITY)') &&
    processSource.includes('this frame cannot mint a third'),
  'full-bank processing keeps an upstream next unbanked live target for real source/re-onset sampling while blocking third and ordinary credit',
)

const proofControlsSource = source.slice(
  source.indexOf('const galvanicAvailable = galvanicRouteAvailable()'),
  source.indexOf('const rainPhaseCopy = rainState.phase'),
)
const closeSmashArmSource = source.slice(
  source.indexOf('const armCloseSmash = useCallback'),
  source.indexOf('const setActiveCueContextSnapshot'),
)
const closeSmashRequestSource = source.slice(
  source.indexOf('const requestCloseSmash = useCallback'),
  source.indexOf('const requestThunderheadArm = useCallback'),
)
const thunderheadArmSource = source.slice(
  source.indexOf('const requestThunderheadArm = useCallback'),
  source.indexOf('const requestThunderheadRelease = useCallback'),
)
const galvanicArmSource = source.slice(
  source.indexOf('const requestGalvanicArm = useCallback'),
  source.indexOf('const requestGalvanicRelease = useCallback'),
)
const galvanicReleaseSource = source.slice(
  source.indexOf('const requestGalvanicRelease = useCallback'),
  source.indexOf('const advanceGalvanicRelease = useCallback'),
)
check(
  proofControlsSource.includes('const thunderheadArmDisabled =') &&
    proofControlsSource.includes('!thunderheadArmReady || galvanicBusy') &&
    thunderheadArmSource.includes('galvanicOwnsInput()') &&
    galvanicArmSource.includes('thunderheadArmPending') &&
    galvanicArmSource.includes('thunderheadArmRequestedRef.current') &&
    galvanicReleaseSource.includes('thunderheadArmRequestedRef.current') &&
    closeSmashArmSource.includes('galvanicOwnsInput()') &&
    closeSmashRequestSource.includes('galvanicOwnsInput()'),
  'active Galvanic ownership disables the competing Thunderhead affordance and rejects both pending Thunderhead and Close Smash handler paths',
)

check(
  proofControlsSource.includes('galvanicProjection.bankCount >= GALVANIC_BANK_CAPACITY') &&
    proofControlsSource.includes('`2 BANKS · ${galvanicBankLabels} · RELEASE SWEEP`') &&
    proofControlsSource.includes('const galvanicCoachCopy') &&
    proofControlsSource.includes('galvanicStatusCopy') &&
    source.slice(source.indexOf('const updatePitchBarState'), source.indexOf('const acceptBossResult')).includes('const presentationFeedback = galvanicBanked') &&
    source.slice(source.indexOf('const updatePitchBarState'), source.indexOf('const acceptBossResult')).includes('GALVANIC READY') &&
    source.slice(source.indexOf('const updatePitchBarState'), source.indexOf('const acceptBossResult')).includes('BANKED · ${bankedGalvanicNotes} · RELEASE OR BANK AGAIN'),
  'full and partial bank states override the existing tuner and first-minute guidance surfaces without changing ordinary feedback',
)

const releaseSource = source.slice(
  source.indexOf('const advanceGalvanicRelease = useCallback'),
  source.indexOf('const answerWithButton = useCallback'),
)
const banksCleared = releaseSource.indexOf('galvanicBanksRef.current = []')
const publishedNextState = releaseSource.indexOf('publishGalvanicProjection()', banksCleared)
const firstGalvanicEffect = releaseSource.indexOf("strikeActiveTine(live, true, 'galvanic')")
check(
  releaseSource.includes('battleId: state.battleId') &&
    releaseSource.includes('expectedVersion: state.version') &&
    releaseSource.includes('attackId: `galvanic-attack:') &&
    releaseSource.includes('tines: snapshot.map') &&
    releaseSource.includes('locks: banks') &&
    releaseSource.includes('generation !== runGenerationRef.current') &&
    releaseSource.includes('galvanicStateRef.current !== state') &&
    banksCleared >= 0 && publishedNextState > banksCleared && firstGalvanicEffect > publishedNextState,
  'release passes the live battle/version/attack/tine/receipt snapshot and publishes consumption before effects',
)
check(
  releaseSource.includes('liveGalvanicTargets(runtimeRef.current.villagers).find') &&
    releaseSource.includes('candidate.key === outcome.targetKey') &&
    releaseSource.includes('candidate.note === outcome.note') &&
    releaseSource.includes('identity?.octave === outcome.octave') &&
    releaseSource.includes('closeSmashRecoilUntilRef.current.set') &&
    releaseSource.includes("strikeActiveTine(live, true, 'galvanic')"),
  'each outcome revalidates an exact live target; only strikes mutate and recoils use the existing visual projection',
)

const visualSource = source.slice(source.indexOf('function drawBoltView('), source.indexOf('function drawVillagerView('))
check(
  visualSource.includes("b.presentation === 'galvanic'") &&
    visualSource.includes('drawCircuitLeg(ctx, b.fromX, b.fromY, b.toX, b.toY') &&
    source.includes("presentation === 'close-smash' || presentation === 'galvanic'") &&
    source.includes('galvanicPresentationActive') &&
    source.includes('const closeSmashPose = closeSmashAction || galvanicContact'),
  'Galvanic has a distinct direct joined-hand jagged bolt and reuses the provisional Close Smash pose',
)

const galvanicPoseSource = source.slice(
  source.indexOf('const closeSmashAction ='),
  source.indexOf('const chargePose ='),
)
check(
  galvanicPoseSource.includes("const galvanicContact = view.bolts.some(b => b.presentation === 'galvanic')") &&
    !galvanicPoseSource.includes('STRIKE_RECEIPT_END') &&
    galvanicPoseSource.includes('const closeSmashPose = closeSmashAction || galvanicContact') &&
    galvanicPoseSource.includes('const closeSmashContact = (closeSmashAction && view.closeSmash.contactPresented) || galvanicContact'),
  'Frank keeps the provisional joined-hand pose for every visible Galvanic bolt, including the post-contact lifetime and reduced-motion path',
)

check(
  source.includes("params.get('galvanicProof') === '1'") &&
    source.includes('return { wave, count: 3') &&
    source.includes('tineCounts: [2, 2, 2]') &&
    source.includes("const GALVANIC_PROOF_FIRST_NOTES = ['C4', 'C4', 'E4']") &&
    source.includes('const GALVANIC_PROOF_X = [220, 395, 570]') &&
    source.includes('!closeSmashProofRef.current') &&
    source.includes('!(galvanicProofRef.current && rt.wave === 1)'),
  'the explicit demo+Galvanic flag selects only the deterministic three-actor proof fixture',
)

check(
  source.includes('data-testid="pf3-galvanic-bank"') &&
    source.includes('data-testid="pf3-galvanic-release"') &&
    source.includes('data-testid="pf3-galvanic-cancel"') &&
    source.includes('{galvanicAvailable && <section') &&
    source.includes('galvanicProjection.bankCount === 1') &&
    source.includes('2 BANKS') &&
    source.includes('bank.note'),
  'earned-route or explicit proof controls are readable, focusable, touch-sized, and label one/two exact bank notes',
)

check(
  source.includes('enabled: boolean') &&
    source.includes('battleId: string') &&
    source.includes('awaitingSilence: boolean') &&
    source.includes('consumedLockIds: readonly string[]') &&
    source.includes('processedAttackIds: readonly string[]') &&
    source.includes('lastOutcomes: readonly PitchforksGalvanicOutcome[]') &&
    source.includes('lastReason: PitchforksGalvanicPlanReason | string | null') &&
    source.includes('galvanic: buildGalvanicDebugProjection(') &&
    !source.includes('galvanic: { set') &&
    source.includes('resetGalvanic(false)'),
  'the read-only debug projection exposes the stable Galvanic ledger and no credit-awarding setter',
)

check(
  source.includes('resetGalvanic()') &&
    source.includes('const beginPlaying') &&
    source.includes('const beginBossPreview') &&
    source.includes('const quitToMenu') &&
    source.includes('resetGalvanic(false)') &&
    source.includes('return () => {') &&
    PITCHFORKS_THUNDERHEAD_MAX_BANK_CAPACITY === 1 &&
    createPitchforksThunderheadState().phase === 'idle',
  'new run, wave, chamber, quit, cancel, and unmount reset the separate ledger while Thunderhead remains capacity one',
)

console.log(`pitchforks Galvanic runtime integration/source regression: ${checks}/${checks} PASS`)
