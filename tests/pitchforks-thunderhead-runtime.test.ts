import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  advancePitchforksThunderhead,
  createPitchforksThunderheadState,
  getPitchforksThunderheadDebugProjection,
  type PitchforksThunderheadState,
} from '../src/components/PitchDefender/pitchforksThunderhead'
import { advancePitchforksLogicalClock } from '../src/components/PitchDefender/PitchforksIII'

const source = readFileSync(resolve(process.cwd(), 'src/components/PitchDefender/PitchforksIII.tsx'), 'utf8').replace(/\r\n/g, '\n')
const ordinaryCloudSource = source.slice(
  source.indexOf('function drawStormCloudView('),
  source.indexOf('function drawThunderheadCloudView('),
)
const thunderheadCloudSource = source.slice(
  source.indexOf('function drawThunderheadCloudView('),
  source.indexOf('function drawChargeArcView('),
)
const bossChamberSource = source.slice(source.indexOf('function renderBossChamber('))

let checks = 0
const check = (condition: boolean, message: string) => {
  assert.equal(condition, true, message)
  checks += 1
}

const receipt = {
  bankId: 'runtime-bank-a',
  lockId: 'runtime-lock-a',
  targetKey: '41:0',
  pitchClass: 'A',
  // The canonical rune dictionary is unresolved; runtime keeps exact note text
  // as a truthful temporary readable label rather than inventing a glyph.
  rune: 'A4',
  colorToken: 'Cobalt',
  note: 'A4',
  octave: 4,
}

const lifecycleEvent = (type: 'banked' | 'detached' | 'ceiling_travel' | 'strike' | 'consumed', logicalTimeMs: number) => ({
  type,
  logicalTimeMs,
})

const target = (overrides: Partial<{ targetKey: string; note: string; octave: number }> = {}) => ({
  targetKey: receipt.targetKey,
  note: receipt.note,
  octave: receipt.octave,
  ...overrides,
})

const runToTravel = () => {
  let state = createPitchforksThunderheadState()
  state = advancePitchforksThunderhead(state, { type: 'lock_confirmed', logicalTimeMs: 300, receipt }).state
  state = advancePitchforksThunderhead(state, lifecycleEvent('banked', 300)).state
  state = advancePitchforksThunderhead(state, lifecycleEvent('detached', 300)).state
  return advancePitchforksThunderhead(state, lifecycleEvent('ceiling_travel', 300)).state
}

const runToConsumed = (initial: PitchforksThunderheadState = createPitchforksThunderheadState()) => {
  let state = advancePitchforksThunderhead(initial, { type: 'lock_confirmed', logicalTimeMs: 400, receipt }).state
  state = advancePitchforksThunderhead(state, lifecycleEvent('banked', 401)).state
  state = advancePitchforksThunderhead(state, lifecycleEvent('detached', 402)).state
  state = advancePitchforksThunderhead(state, lifecycleEvent('ceiling_travel', 403)).state
  state = advancePitchforksThunderhead(state, { type: 'target_match', logicalTimeMs: 404, target: target() }).state
  state = advancePitchforksThunderhead(state, lifecycleEvent('strike', 405)).state
  return advancePitchforksThunderhead(state, lifecycleEvent('consumed', 406)).state
}

check(
    source.includes("data-testid=\"pf3-thunderhead-arm\"") &&
    source.includes("data-testid=\"pf3-thunderhead-release\"") &&
    source.includes("data-testid=\"pf3-thunderhead-status\"") &&
    source.includes('getPitchforksThunderheadDebugProjection(thunderheadStateRef.current)') &&
    source.includes('const thunderheadDebugProjection: ThunderheadDebugProjection') &&
    source.includes('thunderhead: thunderheadDebugProjection'),
  'private demo exposes stable actual controls and a read-only Thunderhead projection',
)
check(
  source.includes('!demoRef.current') &&
    source.includes("inputModeRef.current !== 'voice'") &&
    source.includes('thunderheadArmRequestedRef.current') &&
    source.includes("type: 'lock_confirmed'") &&
    source.includes("type: 'banked'"),
  'arming is private/demo voice-only and waits for the real lock before banking',
)
check(
  source.includes('if (lockProgressRef.current >= 1)') &&
    source.includes('confirmThunderheadLock(target, thunderheadClockMsRef.current)') &&
    source.includes('if (thunderheadArmRequestedRef.current)') &&
    source.includes('confirmThunderheadLock(target, thunderheadClockMsRef.current)\n          return'),
  'no Thunderhead charge can be confirmed before the existing exact 300 ms hold',
)
check(
  source.includes("current.phase === 'banked'") &&
    source.includes('thunderheadReleaseRequestedRef.current = false') &&
    source.includes("type: 'detached'") &&
    source.includes("type: 'ceiling_travel'"),
  'one bank has one deliberate release request and enters the controlled ceiling path once',
)
check(
  source.includes('activeTargetForThunderheadReceipt(runtimeRef.current.villagers, receipt)') &&
    source.includes('liveTarget.key !== receipt.targetKey') &&
    source.includes("cancelThunderhead('stale-target')") &&
    source.includes("cancelThunderhead('octave-mismatch')"),
  'travel and strike stay pinned to exact target key/note/octave and cancel stale targets',
)
check(
  source.includes("const strike = transitionThunderhead({ type: 'strike'") &&
    source.includes("strikeActiveTine(liveTarget, true, 'thunderhead')") &&
    source.includes("const consumed = transitionThunderhead({ type: 'consumed'") &&
    source.includes('transitionThunderhead') &&
    source.includes('commitThunderheadState'),
  'the existing strike/review authority is called once after a published strike state, then consumed',
)
check(
  source.includes('resetThunderhead()') &&
    source.includes('resetThunderhead(false)') &&
    source.includes('const beginBossPreview') &&
    source.includes('const quitToMenu'),
  'new run, boss chamber entry, quit, and unmount clear pending Thunderhead state and requests',
)
check(
  source.includes("rune: target.note") &&
    source.includes("const THUNDERHEAD_RUNE_STATUS = 'unresolved-canonical-rune'") &&
    source.includes('data-thunderhead-rune-status={THUNDERHEAD_RUNE_STATUS}') &&
    !thunderheadCloudSource.includes("fillText('RUNE UNRESOLVED'") &&
    thunderheadCloudSource.includes('getPitchforksThunderheadCaptionRect({ x: cloudX, y: cloudY }, labelWidth, W)') &&
    thunderheadCloudSource.includes('const labelHeight = caption.height') &&
    thunderheadCloudSource.includes('const labelY = caption.top') &&
    thunderheadCloudSource.includes('ctx.fillText(note, labelCenterX') &&
    source.includes("ctx.font = 'bold 24px monospace'") &&
    source.includes('const hue = hueForNote(note)') &&
    source.includes('swatchSize') &&
    thunderheadCloudSource.includes('drawStormHeart(ctx, stormHeartState, cloudX, cloudY, stormHeart)') &&
    source.includes('drawCircuitLeg'),
  'visual travel keeps a compact exact-note caption and hue swatch, while unresolved rune metadata stays explicit in diagnostics',
)
check(
  (source.match(/getPitchforksThunderheadPathPosition\(/g) ?? []).length === 2 &&
    source.includes('const THUNDERHEAD_CEILING_Y = PITCHFORKS_THUNDERHEAD_CLEAR_LANE_Y') &&
    source.includes('const THUNDERHEAD_BANK_X_OFFSET = -8') &&
    source.includes('thunderheadStrikeOriginRef.current = Object.freeze({ x: targetPoint.x, y: targetPoint.y })'),
  'view and diagnostics share the clearance path and the discharge uses the stored endpoint',
)
check(
  source.includes("a.stormHeart = await loadImage(`${ASSET_BASE}/storm_heart_nano.png`).catch(() => undefined)") &&
    ordinaryCloudSource.includes('drawStormHeart(ctx, state, cloudX, cloudY, assets.stormHeart)') &&
    thunderheadCloudSource.includes('drawStormHeart(ctx, stormHeartState, cloudX, cloudY, stormHeart)') &&
    source.includes('drawThunderheadCloudView(ctx, view, assets.stormHeart)') &&
    bossChamberSource.includes('FRANK_CLOUD_Y, assets.stormHeart)'),
  'optional Storm Heart art loads safely and is passed through ordinary, detached, and boss-chamber render paths',
)
check(
  source.includes("if (b.presentation === 'thunderhead')") &&
    source.includes("bolt?.presentation === 'thunderhead'") &&
    source.includes('reducedMotion'),
  'Thunderhead uses a distinct jagged strike presentation while preserving reduced-motion causality',
)
check(
  source.includes('const thunderheadClockMsRef = useRef(0)') &&
    source.includes('advancePitchforksLogicalClock(') &&
    source.includes('thunderheadPausedAtFrameStart') &&
    source.includes('thunderheadClockMsRef.current = thunderheadLogicalNowMs') &&
    source.includes('thunderheadClockMs - thunderheadTravelStartedAtMs'),
  'Thunderhead travel and deadlines use a pause-aware active clock without freezing the ordinary battlefield clock',
)
check(
  source.includes("strikeActiveTine(target)") &&
    source.includes("strikeActiveTine(contactTarget, true, 'close-smash')") &&
    source.includes("data-testid=\"pf3-close-smash-action\""),
  'ordinary strike and Close Smash paths remain present alongside the private route',
)

let activeClockMs = 0
const renderSource = source.slice(source.indexOf('function renderView('), source.indexOf('function renderView(') + 12000)
check(
  renderSource.indexOf('drawRainArchitecture(ctx,') < renderSource.indexOf('drawThunderheadCloudView(ctx, view, assets.stormHeart)') &&
    renderSource.includes('ctx.fillText(view.prompt.text, W / 2, 20)') &&
    renderSource.includes('ctx.fillText(`${view.hud.streak}x COMBO`, 16, 18)'),
  'presentation source guard: cloud draws above gutter and status/combo occupy separate header positions',
)
activeClockMs = advancePitchforksLogicalClock(activeClockMs, 820, false)
const travelStartMs = activeClockMs
const pausedClockMs = advancePitchforksLogicalClock(activeClockMs, 600, true)
check(pausedClockMs === travelStartMs, 'paused Thunderhead active clock does not consume travel time')
const resumedClockMs = advancePitchforksLogicalClock(pausedClockMs, 120, false)
check(resumedClockMs === travelStartMs + 120, 'resumed Thunderhead active clock advances the shared dt once')

const initial = createPitchforksThunderheadState()
const noCharge = advancePitchforksThunderhead(initial, lifecycleEvent('banked', 1))
check(noCharge.reason === 'insufficient-charge' && noCharge.intent === null && noCharge.state === initial, 'banking without a confirmed lock is rejected')

const travel = runToTravel()
check(travel.phase === 'ceiling_travel' && travel.bank?.targetKey === receipt.targetKey, 'confirmed receipt reaches ceiling travel with target identity retained')

const wrongTarget = advancePitchforksThunderhead(travel, {
  type: 'target_match',
  logicalTimeMs: 500,
  target: target({ targetKey: '42:0' }),
})
check(wrongTarget.reason === 'stale-target' && wrongTarget.intent === null && wrongTarget.state === travel, 'changed target key cannot redirect credit')

const wrongNote = advancePitchforksThunderhead(travel, {
  type: 'target_match',
  logicalTimeMs: 500,
  target: target({ note: 'B4' }),
})
check(wrongNote.reason === 'note-mismatch' && wrongNote.intent === null && wrongNote.state === travel, 'changed note cannot redirect credit')

const wrongOctave = advancePitchforksThunderhead(travel, {
  type: 'target_match',
  logicalTimeMs: 500,
  target: target({ note: 'A5', octave: 5 }),
})
check(wrongOctave.reason === 'note-mismatch' && wrongOctave.intent === null && wrongOctave.state === travel, 'wrong octave cannot resolve the bank')

const consumed = runToConsumed()
const projection = getPitchforksThunderheadDebugProjection(consumed)
check(
  consumed.phase === 'consumed' &&
    consumed.bank?.consumedAt === 406 &&
    consumed.consumedLockIds.length === 1 &&
    consumed.consumedBankIds.length === 1 &&
    projection.eventSequence.join('→') === 'lock_confirmed→banked→detached→ceiling_travel→target_match→strike→consumed',
  'one consumed identity produces one complete lifecycle and one strike receipt',
)

const duplicateRelease = advancePitchforksThunderhead(consumed, {
  type: 'lock_confirmed',
  logicalTimeMs: 407,
  receipt,
})
check(duplicateRelease.reason === 'duplicate-lock' && duplicateRelease.state === consumed, 'replaying the same bank/lock cannot create a second charge')

const freshBank = advancePitchforksThunderhead(consumed, {
  type: 'lock_confirmed',
  logicalTimeMs: 407,
  receipt: { ...receipt, bankId: 'runtime-bank-b', lockId: 'runtime-lock-b' },
})
check(freshBank.accepted === true && freshBank.state.phase === 'lock_confirmed', 'a new exact lock may be armed after the prior bank was consumed')

console.log(`pitchforks Thunderhead runtime integration/source regression: ${checks}/${checks} PASS`)
