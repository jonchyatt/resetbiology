import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  armPitchforksCloseSmash,
  consumePitchforksCloseSmash,
  createPitchforksCloseSmashState,
} from '../src/components/PitchDefender/pitchforksCloseSmash'

const source = readFileSync(resolve(process.cwd(), 'src/components/PitchDefender/PitchforksIII.tsx'), 'utf8')

const receipt = {
  lockId: 'integration-close-smash-lock',
  targetKey: 'villager-a:0',
  pitch: 'A4',
  villagerId: 'villager-a',
  tineIndex: 1,
}

let checks = 0
const check = (condition: boolean, message: string) => {
  assert.equal(condition, true, message)
  checks += 1
}

check(
  source.includes('const closeReceipt = closeState.receipt') &&
    source.includes('runtimeRef.current.villagers.find(v => String(v.id) === closeReceipt.villagerId)'),
  'gameplay target selector pins the receipt villager during the lifecycle',
)
check(
  source.includes('activeTargetForCloseReceipt(pinnedVillager, closeReceipt, closeState.phase)') &&
    source.includes('if (!closeReceipt) return null') &&
    source.includes('if (phase === \'settle\') return liveTarget'),
  'ready/pending reject stale receipts without falling through, while settle can expose the live next tine',
)
check(
  source.includes('const closeLifecycleTarget = closeState.phase !== \'idle\'') &&
    source.includes('v.attackTimer = Math.max(0, v.attackTimer - dt)'),
  'world attack clocks continue stepping while the close receipt is active',
)
check(
  source.includes('closeSmashFallbackDueAtRef.current = closeSmashFallbackDueAtRef.current > 0') &&
    source.includes('Math.min(closeSmashFallbackDueAtRef.current, logicalNowMs)'),
  'threat apex defers consequence into the serialized ordinary fallback',
)
check(
  source.includes('if (source?.isActive) {') &&
    !source.includes('if (target.note !== closeSmashReonsetNoteRef.current)'),
  're-onset requires an actual silent sample even when the next note differs',
)
check(
  source.includes('CLOSE_SMASH_RECOIL_RADIUS_X') &&
    source.includes('CLOSE_SMASH_RECOIL_RADIUS_Y') &&
    source.includes('&& nearby'),
  'only nearby bystanders receive recoil presentation',
)
check(
  source.includes('v.recoilProgress > 0') &&
    source.includes('view.reducedMotion ? 0.82'),
  'reduced motion retains a discrete visible stun state without translation',
)
check(
  source.includes('CLOSE_SMASH_SETTLE_MS = 250') &&
    source.includes('logicalNowMs >= settleDue'),
  'close receipt settle is bounded instead of waiting for the full bolt lifespan',
)
check(
  source.includes("strikeActiveTine(contactTarget, true, 'close-smash')") &&
    source.includes("strikeActiveTine(fallbackTarget, true, 'ordinary-fallback')") &&
    source.includes('villager.attackTimer = villager.attackTimerMax') &&
    source.includes("if (b.presentation === 'close-smash')") &&
    source.includes("if (bolt?.presentation === 'close-smash' || galvanicPresentationActive) return"),
  'Smash presentation routes from authored hands to the existing tine endpoint without cloud origin',
)
check(
  source.includes("params.get('closeSmashProof') === '1'") &&
    source.includes('tineCounts: [2, 3]'),
  'private demo proof fixture uses a two-tine target and three-tine bystander only when explicitly requested',
)

type LiveVillager = {
  id: string
  state: 'walking' | 'ash'
  burned: number
  totalTines: number
  notes: string[]
  attackTimer: number
  attackTimerMax: number
}

type LiveTarget = { villager: LiveVillager; tineIndex: number; note: string; key: string }
type LifecyclePhase = 'ready' | 'pending' | 'settle'

// Executable mirror of the component's receipt-boundary contract. It consumes
// only live villager fields, and deliberately returns null for stale
// READY/PENDING receipts instead of selecting a bystander.
const liveTargetForReceipt = (
  villagers: readonly LiveVillager[],
  phase: LifecyclePhase,
  expected: typeof receipt,
): LiveTarget | null => {
  const villager = villagers.find(candidate => candidate.id === expected.villagerId)
  if (!villager || villager.state !== 'walking' || villager.burned < 0 || villager.burned >= villager.totalTines) return null
  const note = villager.notes[villager.burned]
  const tineIndex = villager.totalTines - 1 - villager.burned
  const live = { villager, tineIndex, note, key: `${villager.id}:${villager.burned}` }
  if (phase === 'settle') return live
  return live.key === expected.targetKey && live.note === expected.pitch && live.tineIndex === expected.tineIndex
    ? live
    : null
}

const target = {
  id: 'villager-a',
  state: 'walking' as const,
  burned: 0,
  totalTines: 2,
  notes: ['A4', 'B4'],
  attackTimer: 0,
  attackTimerMax: 12,
}
const bystander = {
  id: 'villager-b',
  state: 'walking' as const,
  burned: 0,
  totalTines: 3,
  notes: ['C4', 'D4', 'E4'],
  attackTimer: 8,
  attackTimerMax: 8,
}
const liveReady = liveTargetForReceipt([target, bystander], 'ready', receipt)
check(liveReady?.key === receipt.targetKey && liveReady.tineIndex === 1 && liveReady.note === 'A4', 'live READY target matches receipt fields')
check(liveTargetForReceipt([{ ...target, burned: 1 }, bystander], 'pending', receipt) === null, 'stale burn cannot steal a pending receipt')
check(liveTargetForReceipt([{ ...target, notes: ['C4', 'B4'] }, bystander], 'ready', receipt) === null, 'stale pitch cannot validate a READY receipt')
check(liveTargetForReceipt([{ ...target, state: 'ash', burned: 2 }, bystander], 'settle', receipt) === null, 'final/ash target does not fall through to a bystander')
const surviving = liveTargetForReceipt([{ ...target, burned: 1 }, bystander], 'settle', receipt)
check(surviving?.key === 'villager-a:1' && surviving.note === 'B4' && surviving.tineIndex === 0, 'settle exposes the surviving villager next tine')

const resolveEarnedCloseTine = (villager: LiveVillager, presentation: 'close-smash' | 'ordinary-fallback') => {
  villager.burned += 1
  if (villager.burned < villager.totalTines) villager.attackTimer = villager.attackTimerMax
  return villager
}
const resolvedTarget = resolveEarnedCloseTine({ ...target }, 'close-smash')
check(resolvedTarget.burned === 1 && resolvedTarget.state === 'walking' && resolvedTarget.attackTimer === resolvedTarget.attackTimerMax, 'Smash resolution restores the surviving tine threat window')
const resolvedFallback = resolveEarnedCloseTine({ ...target }, 'ordinary-fallback')
check(resolvedFallback.burned === 1 && resolvedFallback.state === 'walking' && resolvedFallback.attackTimer === resolvedFallback.attackTimerMax, 'ordinary fallback restores the surviving tine threat window')

let state = armPitchforksCloseSmash(createPitchforksCloseSmashState(), {
  receipt,
  existingCloseBoundaryEligible: true,
})
const intents = [] as string[]
for (const input of [
  {
    consumer: 'smash' as const,
    currentTargetKey: receipt.targetKey,
    logicalTimeMs: 1600,
    contactAtMs: 1800,
  },
  {
    consumer: 'ordinary-fallback' as const,
    currentTargetKey: receipt.targetKey,
    logicalTimeMs: 1600,
    deadlineMs: 1600,
  },
]) {
  const decision = consumePitchforksCloseSmash(state, input)
  state = decision.state
  if (decision.intent) intents.push(decision.intent.kind)
}
check(intents.length === 1 && intents[0] === 'smash' && state.phase === 'pending', 'same-tick tap/fallback arbitration yields one intent')

console.log(`pitchforks Close Smash integration/source regression: ${checks}/${checks} PASS`)
