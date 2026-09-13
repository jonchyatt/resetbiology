import assert from 'node:assert/strict'

import {
  armPitchforksCloseSmash,
  completePitchforksCloseSmashSettle,
  consumePitchforksCloseSmash,
  createPitchforksCloseSmashState,
  presentPitchforksCloseSmashContact,
  settlePitchforksCloseSmash,
} from '../src/components/PitchDefender/pitchforksCloseSmash'

let checks = 0
const check = (run: () => void) => {
  run()
  checks += 1
}

const receipt = (targetKey = 'villager-a:0', lockId = `lock-${targetKey}`) => ({
  lockId,
  targetKey,
  pitch: 'A4',
  villagerId: 'villager-a',
  tineIndex: 0,
})

const arm = (state = createPitchforksCloseSmashState(), targetKey = 'villager-a:0') =>
  armPitchforksCloseSmash(state, {
    receipt: receipt(targetKey),
    existingCloseBoundaryEligible: true,
  })

const smash = (state: ReturnType<typeof createPitchforksCloseSmashState>, logicalTimeMs = 10) =>
  consumePitchforksCloseSmash(state, {
    consumer: 'smash',
    currentTargetKey: state.receipt?.targetKey ?? null,
    logicalTimeMs,
    contactAtMs: 100,
  })

check(() => {
  const initial = createPitchforksCloseSmashState()
  assert.equal(initial.phase, 'idle')
  assert.equal(Object.isFrozen(initial), true)
  assert.equal(Object.isFrozen(initial.seenTargetKeys), true)
  assert.strictEqual(armPitchforksCloseSmash(initial, {
    receipt: { ...receipt(), tineIndex: -1 },
    existingCloseBoundaryEligible: true,
  }), initial)
  assert.strictEqual(armPitchforksCloseSmash(initial, {
    receipt: { ...receipt(), tineIndex: Number.MAX_SAFE_INTEGER + 1 },
    existingCloseBoundaryEligible: true,
  }), initial)
  assert.strictEqual(armPitchforksCloseSmash(initial, {
    receipt: receipt(),
    existingCloseBoundaryEligible: false,
  }), initial)
})

check(() => {
  const state = arm()
  assert.equal(state.phase, 'ready')
  assert.deepEqual(state.receipt, receipt())
  assert.equal(Object.isFrozen(state.receipt), true)
  const duplicateWhileReady = armPitchforksCloseSmash(state, {
    receipt: { ...receipt(), lockId: 'lock-duplicate' },
    existingCloseBoundaryEligible: true,
  })
  assert.strictEqual(duplicateWhileReady, state)
  const pending = { ...state, phase: 'pending' as const }
  assert.strictEqual(armPitchforksCloseSmash(pending, {
    receipt: receipt('villager-b:0', 'lock-b'),
    existingCloseBoundaryEligible: true,
  }), pending)
  const settling = { ...state, phase: 'settle' as const }
  assert.strictEqual(armPitchforksCloseSmash(settling, {
    receipt: receipt('villager-b:0', 'lock-b'),
    existingCloseBoundaryEligible: true,
  }), settling)
})

check(() => {
  const state = arm()
  const first = smash(state)
  assert.equal(first.reason, 'consumed')
  assert.equal(first.intent?.kind, 'smash')
  assert.equal(first.intent?.smash, true)
  assert.equal(first.state.phase, 'pending')
  const second = smash(first.state)
  assert.equal(second.intent, null)
  assert.equal(second.reason, 'already-consumed')
  assert.strictEqual(second.state, first.state)
})

check(() => {
  const state = arm()
  const stale = consumePitchforksCloseSmash(state, {
    consumer: 'smash',
    currentTargetKey: 'villager-other:0',
    logicalTimeMs: 10,
    contactAtMs: 100,
  })
  assert.equal(stale.intent, null)
  assert.equal(stale.reason, 'stale-target')
  assert.equal(stale.state.phase, 'idle')
  assert.equal(stale.state.receipt, null)
})

check(() => {
  let state = arm()
  const smashFirst = consumePitchforksCloseSmash(state, {
    consumer: 'smash',
    currentTargetKey: 'villager-a:0',
    logicalTimeMs: 100,
    contactAtMs: 100,
  })
  assert.equal(smashFirst.intent?.kind, 'smash')
  const fallbackLoser = consumePitchforksCloseSmash(smashFirst.state, {
    consumer: 'ordinary-fallback',
    currentTargetKey: 'villager-a:0',
    logicalTimeMs: 100,
    deadlineMs: 100,
  })
  assert.equal(fallbackLoser.intent, null)
  assert.equal(fallbackLoser.reason, 'already-consumed')

  state = arm()
  const fallbackFirst = consumePitchforksCloseSmash(state, {
    consumer: 'ordinary-fallback',
    currentTargetKey: 'villager-a:0',
    logicalTimeMs: 100,
    deadlineMs: 100,
  })
  assert.equal(fallbackFirst.intent?.kind, 'ordinary-fallback')
  assert.equal(fallbackFirst.intent?.smash, false)
  assert.equal(fallbackFirst.intent?.pose, 'ordinary')
  const smashLoser = consumePitchforksCloseSmash(fallbackFirst.state, {
    consumer: 'smash',
    currentTargetKey: 'villager-a:0',
    logicalTimeMs: 100,
    contactAtMs: 100,
  })
  assert.equal(smashLoser.intent, null)
  assert.equal(smashLoser.reason, 'already-consumed')
})

check(() => {
  const state = arm()
  const beforeDeadline = consumePitchforksCloseSmash(state, {
    consumer: 'ordinary-fallback',
    currentTargetKey: 'villager-a:0',
    logicalTimeMs: 99,
    deadlineMs: 100,
  })
  assert.equal(beforeDeadline.intent, null)
  assert.equal(beforeDeadline.reason, 'before-deadline')
  assert.strictEqual(beforeDeadline.state, state)
})

check(() => {
  const committed = smash(arm()).state
  const beforeContact = presentPitchforksCloseSmashContact(committed, {
    currentTargetKey: 'villager-a:0',
    logicalTimeMs: 99,
  })
  assert.equal(beforeContact.intent, null)
  assert.equal(beforeContact.reason, 'before-contact-time')
  assert.strictEqual(beforeContact.state, committed)
  const contact = presentPitchforksCloseSmashContact(committed, {
    currentTargetKey: 'villager-a:0',
    logicalTimeMs: 100,
  })
  assert.equal(contact.intent?.kind, 'smash-contact')
  assert.equal(contact.state.contactPresented, true)
  const repeated = presentPitchforksCloseSmashContact(contact.state, {
    currentTargetKey: 'villager-a:0',
    logicalTimeMs: 101,
  })
  assert.equal(repeated.intent, null)
  assert.equal(repeated.reason, 'contact-presented')
})

check(() => {
  // A Smash action committed at t10 with contact designated for t100 cannot
  // enter settle early; the owner must present contact first.
  const committed = smash(arm(), 10).state
  assert.strictEqual(settlePitchforksCloseSmash(committed), committed)
  const contacted = presentPitchforksCloseSmashContact(committed, {
    currentTargetKey: 'villager-a:0',
    logicalTimeMs: 100,
  }).state
  assert.equal(settlePitchforksCloseSmash(contacted).phase, 'settle')
})

check(() => {
  let state = arm()
  const fallback = consumePitchforksCloseSmash(state, {
    consumer: 'ordinary-fallback',
    currentTargetKey: 'villager-a:0',
    logicalTimeMs: 100,
    deadlineMs: 100,
  })
  assert.equal(fallback.intent?.smash, false)
  assert.equal(fallback.intent?.pose, 'ordinary')
  assert.equal(presentPitchforksCloseSmashContact(fallback.state, {
    currentTargetKey: 'villager-a:0',
    logicalTimeMs: 100,
  }).intent, null)
  state = settlePitchforksCloseSmash(fallback.state)
  assert.equal(state.phase, 'settle')
  const blocked = armPitchforksCloseSmash(state, {
    receipt: receipt('villager-b:0', 'lock-b'),
    existingCloseBoundaryEligible: true,
  })
  assert.strictEqual(blocked, state)
  state = completePitchforksCloseSmashSettle(state)
  assert.equal(state.phase, 'idle')
  const next = armPitchforksCloseSmash(state, {
    receipt: receipt('villager-b:0', 'lock-b'),
    existingCloseBoundaryEligible: true,
  })
  assert.equal(next.phase, 'ready')
  assert.equal(next.receipt?.targetKey, 'villager-b:0')
  assert.strictEqual(armPitchforksCloseSmash(next, {
    receipt: receipt('villager-b:0', 'lock-b-duplicate'),
    existingCloseBoundaryEligible: true,
  }), next)
})

check(() => {
  // The runtime owner serializes same-frame requests through the latest state.
  // Whichever request is first wins; the second sees pending and is silent.
  const initial = arm()
  let latest = initial
  const intents = [] as ReturnType<typeof consumePitchforksCloseSmash>['intent'][]
  for (const input of [
    {
      consumer: 'smash' as const,
      currentTargetKey: 'villager-a:0',
      logicalTimeMs: 100,
      contactAtMs: 100,
    },
    {
      consumer: 'ordinary-fallback' as const,
      currentTargetKey: 'villager-a:0',
      logicalTimeMs: 100,
      deadlineMs: 100,
    },
  ]) {
    const decision = consumePitchforksCloseSmash(latest, input)
    latest = decision.state
    if (decision.intent) intents.push(decision.intent)
  }
  assert.equal(intents.length, 1)
  assert.equal(intents[0]?.kind, 'smash')
  assert.equal(latest.phase, 'pending')
})

check(() => {
  const originalReceipt = receipt()
  const state = armPitchforksCloseSmash(createPitchforksCloseSmashState(), {
    receipt: originalReceipt,
    existingCloseBoundaryEligible: true,
  })
  assert.equal(originalReceipt.lockId, 'lock-villager-a:0')
  assert.equal(state.receipt?.lockId, originalReceipt.lockId)
  assert.notStrictEqual(state.receipt, originalReceipt)
})

console.log(`pitchforks Close Smash receipt lifecycle: ${checks}/${checks} PASS`)
