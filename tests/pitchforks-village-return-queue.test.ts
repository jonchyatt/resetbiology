import assert from 'node:assert/strict'

import {
  createVillageReturnQueue,
  enqueueVillageReturn,
  selectVillageReturnOffer,
  resolveVillageReturnOffer,
  VILLAGE_RETURN_DELAY_MS,
  VILLAGE_RETURN_REQUIRED_OTHER_ENCOUNTERS,
  type VillageReturnQueueState,
} from '../src/components/PitchDefender/villageReturnQueue'

const range = { lowNote: 'D4', highNote: 'A4' } as const
const allAdmitted = ['D4', 'F4', 'A4'] as const
const allEligibility = {
  admittedNotes: allAdmitted,
  introducedNotes: allAdmitted,
  comfortableRange: range,
} as const
const contextOnlyEligibility = {
  admittedNotes: ['F4'],
  introducedNotes: ['D4', 'F4'],
  comfortableRange: range,
} as const

type EnqueueInput = Parameters<typeof enqueueVillageReturn>[1]
type SelectionInput = Parameters<typeof selectVillageReturnOffer>[1]

const enqueueInput = (overrides: Record<string, unknown> = {}): EnqueueInput => ({
  runId: 'run-1',
  objective: 'minor-third',
  contextNote: 'D4',
  targetNote: 'F4',
  completedEncounterCount: 1,
  nowMs: 1_000,
  support: 'SUPPORTED',
  candidateEligibility: allEligibility,
  ...overrides,
})

const selectionInput = (overrides: Record<string, unknown> = {}): SelectionInput => ({
  runId: 'run-1',
  targetNote: 'F4',
  completedEncounterCount: 1 + VILLAGE_RETURN_REQUIRED_OTHER_ENCOUNTERS,
  nowMs: 1_000 + VILLAGE_RETURN_DELAY_MS,
  candidateEligibility: allEligibility,
  ...overrides,
})

const dueSelection = (state: VillageReturnQueueState, overrides: Record<string, unknown> = {}) =>
  selectVillageReturnOffer(state, selectionInput(overrides))

let checks = 0
const check = (run: () => void): void => {
  run()
  checks += 1
}

check(() => {
  const queue = createVillageReturnQueue('run-1')
  assert.deepEqual(queue, { runId: 'run-1', nextRevision: 1, entries: [] })
  assert.equal(Object.isFrozen(queue), true)
  assert.equal(Object.isFrozen(queue.entries), true)
  assert.throws(() => createVillageReturnQueue(''), /runId/)
  assert.throws(() => createVillageReturnQueue(' run-1'), /runId/)
})

check(() => {
  const queue = createVillageReturnQueue('run-1')
  const next = enqueueVillageReturn(queue, enqueueInput())
  assert.equal(next.entries.length, 1)
  assert.deepEqual(next.entries[0], {
    runId: 'run-1',
    objective: 'minor-third',
    contextNote: 'D4',
    targetNote: 'F4',
    enqueuedAtCompletedEncounterCount: 1,
    enqueuedAtMs: 1_000,
    revision: 1,
    attempt: 'initial',
    status: 'pending',
  })
  assert.equal(Object.isFrozen(next.entries[0]), true)
  assert.notStrictEqual(next, queue)
  assert.strictEqual(queue.entries.length, 0)
})

check(() => {
  let queue = enqueueVillageReturn(createVillageReturnQueue('run-1'), enqueueInput())
  const originalEntry = queue.entries[0]
  const duplicate = enqueueVillageReturn(queue, enqueueInput({
    completedEncounterCount: 99,
    nowMs: 99_000,
  }))
  assert.strictEqual(duplicate, queue)
  assert.strictEqual(duplicate.entries[0], originalEntry)
  assert.equal(duplicate.entries[0].enqueuedAtCompletedEncounterCount, 1)
  assert.equal(duplicate.entries[0].enqueuedAtMs, 1_000)
  assert.equal(duplicate.entries[0].revision, 1)

  for (const malformed of [
    { runId: 'other-run' },
    { support: 'UNAIDED_RETURN' },
    { completedEncounterCount: -1 },
    { completedEncounterCount: 1.5 },
    { nowMs: Number.NaN },
    { nowMs: -1 },
    { objective: 'perfect-fourth' },
    { targetNote: 'H4' },
    { contextNote: 'D4', targetNote: 'F4', candidateEligibility: contextOnlyEligibility },
    { contextNote: 'C4', targetNote: 'E4' },
    { contextNote: 'D4', targetNote: 'F5' },
    { objective: 'major-third' },
  ]) {
    assert.strictEqual(enqueueVillageReturn(queue, enqueueInput(malformed)), queue)
  }
})

check(() => {
  let queue = createVillageReturnQueue('run-1')
  queue = enqueueVillageReturn(queue, enqueueInput())
  assert.equal(dueSelection(queue, { completedEncounterCount: 3, nowMs: 1_000 + VILLAGE_RETURN_DELAY_MS }), undefined)
  assert.equal(dueSelection(queue, { completedEncounterCount: 4, nowMs: 1_000 + VILLAGE_RETURN_DELAY_MS - 1 }), undefined)
  const offer = dueSelection(queue)
  assert.deepEqual(offer, {
    kind: 'village-return',
    runId: 'run-1',
    objective: 'minor-third',
    contextNote: 'D4',
    targetNote: 'F4',
    revision: 1,
    attempt: 'initial',
    support: 'UNAIDED_RETURN',
    enqueuedAtCompletedEncounterCount: 1,
    enqueuedAtMs: 1_000,
  })
  assert.equal(Object.isFrozen(offer), true)
  assert.equal(dueSelection(queue, { targetNote: 'A4' }), undefined)
  assert.equal(selectVillageReturnOffer(queue, selectionInput({ runId: 'other-run' })), undefined)
  assert.strictEqual(queue.entries[0].status, 'pending')
})

check(() => {
  let queue = createVillageReturnQueue('run-1')
  queue = enqueueVillageReturn(queue, enqueueInput({
    contextNote: 'A4',
    targetNote: 'F4',
    objective: 'major-third',
  }))
  queue = enqueueVillageReturn(queue, enqueueInput({
    contextNote: 'D4',
    targetNote: 'F4',
  }))
  const first = dueSelection(queue)
  assert.equal(first?.contextNote, 'A4', 'shared-target selection keeps insertion order')
  assert.equal(first?.objective, 'major-third')
})

check(() => {
  let queue = enqueueVillageReturn(createVillageReturnQueue('run-1'), enqueueInput())
  const offer = dueSelection(queue)
  assert.ok(offer)
  const resolved = resolveVillageReturnOffer(queue, {
    runId: 'run-1',
    offer,
    completedEncounterCount: 4,
    nowMs: 1_000 + VILLAGE_RETURN_DELAY_MS,
    correct: true,
  })
  assert.equal(resolved.accepted, true)
  assert.equal(resolved.reason, 'done')
  assert.equal(resolved.outcome, 'DONE')
  assert.equal(resolved.support, 'UNAIDED_RETURN')
  assert.equal(resolved.state.entries[0].status, 'done')
  assert.equal(selectVillageReturnOffer(resolved.state, selectionInput()), undefined)

  const duplicate = resolveVillageReturnOffer(resolved.state, {
    runId: 'run-1',
    offer,
    completedEncounterCount: 7,
    nowMs: 100_000,
    correct: true,
  })
  assert.equal(duplicate.accepted, false)
  assert.equal(duplicate.reason, 'stale-offer')
  assert.strictEqual(duplicate.state, resolved.state)
})

check(() => {
  let queue = enqueueVillageReturn(createVillageReturnQueue('run-1'), enqueueInput())
  const offer = dueSelection(queue)
  assert.ok(offer)
  const hinted = resolveVillageReturnOffer(queue, {
    runId: 'run-1',
    offer,
    completedEncounterCount: 4,
    nowMs: 1_000 + VILLAGE_RETURN_DELAY_MS,
    correct: true,
    hinted: true,
  })
  assert.equal(hinted.accepted, true)
  assert.equal(hinted.reason, 'retry-scheduled')
  assert.equal(hinted.outcome, 'RETRY_SCHEDULED')
  assert.equal(hinted.support, 'SUPPORTED', 'a hint downgrades this attempt from unaided')
  assert.equal(hinted.state.entries[0].attempt, 'retry')
  assert.equal(hinted.state.entries[0].revision, 2)
  assert.equal(hinted.state.entries[0].enqueuedAtCompletedEncounterCount, 4)
  assert.equal(hinted.state.entries[0].enqueuedAtMs, 1_000 + VILLAGE_RETURN_DELAY_MS)

  const stale = resolveVillageReturnOffer(hinted.state, {
    runId: 'run-1',
    offer,
    completedEncounterCount: 7,
    nowMs: 100_000,
    correct: false,
  })
  assert.equal(stale.accepted, false)
  assert.equal(stale.reason, 'stale-offer')
  assert.strictEqual(stale.state, hinted.state)

  const retryOffer = dueSelection(hinted.state, {
    completedEncounterCount: 4 + VILLAGE_RETURN_REQUIRED_OTHER_ENCOUNTERS,
    nowMs: 1_000 + VILLAGE_RETURN_DELAY_MS + VILLAGE_RETURN_DELAY_MS,
  })
  assert.equal(retryOffer?.support, 'SUPPORTED')
  const exhausted = resolveVillageReturnOffer(hinted.state, {
    runId: 'run-1',
    offer: retryOffer!,
    completedEncounterCount: 7,
    nowMs: 1_000 + VILLAGE_RETURN_DELAY_MS * 2,
    correct: false,
  })
  assert.equal(exhausted.accepted, true)
  assert.equal(exhausted.reason, 'done')
  assert.equal(exhausted.outcome, 'DONE')
  assert.equal(exhausted.support, 'SUPPORTED')
  assert.equal(exhausted.state.entries[0].status, 'exhausted')
  assert.equal(dueSelection(exhausted.state, {
    completedEncounterCount: 10,
    nowMs: 1_000 + VILLAGE_RETURN_DELAY_MS * 3,
  }), undefined)
})

check(() => {
  let queue = enqueueVillageReturn(createVillageReturnQueue('run-1'), enqueueInput())
  const offer = dueSelection(queue)
  assert.ok(offer)
  const early = resolveVillageReturnOffer(queue, {
    runId: 'run-1',
    offer,
    completedEncounterCount: 4,
    nowMs: 1_000 + VILLAGE_RETURN_DELAY_MS - 1,
    correct: true,
  })
  assert.equal(early.accepted, false)
  assert.equal(early.reason, 'not-due')
  assert.strictEqual(early.state, queue)

  const wrongRun = resolveVillageReturnOffer(queue, {
    runId: 'other-run',
    offer,
    completedEncounterCount: 4,
    nowMs: 1_000 + VILLAGE_RETURN_DELAY_MS,
    correct: true,
  })
  assert.equal(wrongRun.accepted, false)
  assert.equal(wrongRun.reason, 'stale-run')
  assert.strictEqual(wrongRun.state, queue)

  const wrongPair = resolveVillageReturnOffer(queue, {
    runId: 'run-1',
    offer: { ...offer, targetNote: 'A4' },
    completedEncounterCount: 4,
    nowMs: 1_000 + VILLAGE_RETURN_DELAY_MS,
    correct: true,
  })
  assert.equal(wrongPair.accepted, false)
  assert.equal(wrongPair.reason, 'stale-offer')
  assert.strictEqual(wrongPair.state, queue)
})

check(() => {
  const queue = enqueueVillageReturn(createVillageReturnQueue('run-1'), enqueueInput())
  const queueSnapshot = JSON.parse(JSON.stringify(queue))
  const input = enqueueInput()
  const inputSnapshot = JSON.parse(JSON.stringify(input))
  const eligibilitySnapshot = JSON.parse(JSON.stringify(allEligibility))
  const selected = dueSelection(queue)
  resolveVillageReturnOffer(queue, {
    runId: 'run-1',
    offer: selected!,
    completedEncounterCount: 4,
    nowMs: 1_000 + VILLAGE_RETURN_DELAY_MS,
    correct: false,
  })
  enqueueVillageReturn(queue, input)
  selectVillageReturnOffer(queue, selectionInput())
  assert.deepEqual(queue, queueSnapshot)
  assert.deepEqual(input, inputSnapshot)
  assert.deepEqual(allEligibility, eligibilitySnapshot)

  const fresh = createVillageReturnQueue('run-1')
  assert.deepEqual(fresh.entries, [])
  assert.notStrictEqual(fresh, queue)
})

console.log(`village return queue contract: ${checks}/${checks} PASS`)
