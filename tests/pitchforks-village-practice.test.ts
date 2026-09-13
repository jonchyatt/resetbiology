import assert from 'node:assert/strict'

import { recordVillagePractice } from '../src/components/PitchDefender/villagePractice'

type PracticeInput = Parameters<typeof recordVillagePractice>[1]

const range = { lowNote: 'D4', highNote: 'A4' } as const
const supportedEligibility = {
  admittedNotes: ['F4'],
  introducedNotes: ['D4', 'F4'],
  comfortableRange: range,
} as const
const unaidedEligibility = {
  admittedNotes: ['D4', 'F4'],
  introducedNotes: ['D4', 'F4'],
  comfortableRange: range,
} as const

const input = (overrides: Record<string, unknown> = {}): PracticeInput => ({
  eventId: 'event-1',
  journeyId: 'journey-1',
  sessionId: 'session-1',
  encounterIndex: 0,
  introducedEncounterIndex: 0,
  timestampMs: 1_000,
  objective: 'minor-third',
  contextNote: 'D4',
  targetNote: 'F4',
  support: 'SUPPORTED',
  correct: true,
  normalVoice: true,
  demo: false,
  simulated: false,
  cueFree: false,
  candidateEligibility: supportedEligibility,
  ...overrides,
})

let checks = 0
const check = (run: () => void): void => {
  run()
  checks += 1
}

check(() => {
  const result = recordVillagePractice([], input())
  assert.deepEqual(result, [{
    kind: 'practice',
    eventId: 'event-1',
    journeyId: 'journey-1',
    sessionId: 'session-1',
    encounterIndex: 0,
    introducedEncounterIndex: 0,
    timestampMs: 1_000,
    objective: 'minor-third',
    contextNote: 'D4',
    targetNote: 'F4',
    support: 'SUPPORTED',
    cueFree: false,
  }])
  assert.equal(Object.isFrozen(result), true)
  assert.equal(Object.isFrozen(result[0]), true)
  assert.equal('candidateEligibility' in result[0], false)
})

check(() => {
  const supported = recordVillagePractice([], input({ eventId: 'supported' }))
  const result = recordVillagePractice(supported, input({
    eventId: 'return-1',
    sessionId: 'session-2',
    encounterIndex: 2,
    introducedEncounterIndex: 1,
    timestampMs: 2_000,
    support: 'UNAIDED_RETURN',
    cueFree: true,
    candidateEligibility: unaidedEligibility,
  }))
  assert.equal(result.length, 2)
  assert.equal(result[1].kind, 'practice')
  assert.equal(result[1].support, 'UNAIDED_RETURN')
  assert.equal(result[1].cueFree, true)
  assert.equal(result[1].encounterIndex, 2)
  assert.equal(result[1].introducedEncounterIndex, 1)
})

check(() => {
  const previous = recordVillagePractice([], input({ eventId: 'prior' }))
  for (const overrides of [
    { encounterIndex: 1, introducedEncounterIndex: 1, cueFree: true },
    { encounterIndex: 0, introducedEncounterIndex: 1, cueFree: true },
    { encounterIndex: 2, introducedEncounterIndex: 1 },
    { encounterIndex: 2, introducedEncounterIndex: 1, cueFree: false },
  ]) {
    const result = recordVillagePractice(previous, input({
      eventId: `return-${String(overrides.encounterIndex)}-${String(overrides.cueFree)}`,
      support: 'UNAIDED_RETURN',
      candidateEligibility: unaidedEligibility,
      ...overrides,
    }))
    assert.strictEqual(result, previous)
  }
})

check(() => {
  const previous = recordVillagePractice([], input({ eventId: 'prior' }))
  const cases = [
    input({ eventId: 'unadmitted-target', targetNote: 'A4' }),
    input({ eventId: 'unknown-target', targetNote: 'H4' }),
    input({ eventId: 'wrong-octave', targetNote: 'F5' }),
    input({ eventId: 'outside-range', contextNote: 'C4', targetNote: 'E4' }),
  ]
  for (const candidate of cases) {
    assert.strictEqual(recordVillagePractice(previous, candidate), previous)
  }
})

check(() => {
  const previous = recordVillagePractice([], input({ eventId: 'prior' }))
  const result = recordVillagePractice(previous, input({
    eventId: 'context-only-return',
    support: 'UNAIDED_RETURN',
    encounterIndex: 2,
    introducedEncounterIndex: 1,
    cueFree: true,
    candidateEligibility: supportedEligibility,
  }))
  assert.strictEqual(result, previous)
  assert.equal(recordVillagePractice([], input({ eventId: 'context-only-supported' })).length, 1)
})

check(() => {
  const previous = recordVillagePractice([], input({ eventId: 'prior' }))
  for (const [name, overrides] of [
    ['demo', { demo: true }],
    ['simulated', { simulated: true }],
    ['nonvoice', { normalVoice: false }],
    ['incorrect', { correct: false }],
  ] as const) {
    assert.strictEqual(recordVillagePractice(previous, input({ eventId: name, ...overrides })), previous)
  }
})

check(() => {
  const previous = [] as const
  const malformed: readonly Record<string, unknown>[] = [
    input({ eventId: '' }),
    input({ eventId: ' event' }),
    input({ journeyId: ' ' }),
    input({ sessionId: 'session-1 ' }),
    input({ timestampMs: Number.NaN }),
    input({ timestampMs: Number.POSITIVE_INFINITY }),
    input({ timestampMs: -1 }),
    input({ encounterIndex: -1 }),
    input({ encounterIndex: 1.5 }),
    input({ encounterIndex: Number.MAX_SAFE_INTEGER + 1 }),
    input({ introducedEncounterIndex: -1 }),
    input({ introducedEncounterIndex: 1.5 }),
    input({ support: 'HINTED' }),
    input({ cueFree: 'true' }),
  ]
  for (const candidate of malformed) {
    assert.strictEqual(recordVillagePractice(previous, candidate as PracticeInput), previous)
  }
})

check(() => {
  const first = recordVillagePractice([], input({ eventId: 'duplicate' }))
  const replay = recordVillagePractice(first, input({
    eventId: 'duplicate',
    sessionId: 'session-2',
    timestampMs: 9_000,
  }))
  assert.strictEqual(replay, first)
  assert.equal(replay.length, 1)
})

check(() => {
  const prior = [{
    kind: 'practice' as const,
    eventId: 'prior',
    journeyId: 'journey-0',
    sessionId: 'session-0',
    encounterIndex: 0,
    introducedEncounterIndex: 0,
    timestampMs: 500,
    objective: 'minor-third' as const,
    contextNote: 'D4',
    targetNote: 'F4',
    support: 'SUPPORTED' as const,
    cueFree: false,
  }]
  const priorSnapshot = prior.map(row => ({ ...row }))
  const candidateEligibility = {
    admittedNotes: ['F4'],
    introducedNotes: ['D4', 'F4'],
    comfortableRange: { ...range },
  }
  const candidate = input({
    eventId: 'new',
    candidateEligibility,
  })
  const inputSnapshot = {
    ...candidate,
    candidateEligibility: {
      ...candidate.candidateEligibility,
      admittedNotes: [...candidate.candidateEligibility.admittedNotes],
      introducedNotes: [...candidate.candidateEligibility.introducedNotes],
      comfortableRange: { ...candidate.candidateEligibility.comfortableRange },
    },
  }
  const result = recordVillagePractice(prior, candidate)
  assert.notStrictEqual(result, prior)
  assert.deepEqual(prior, priorSnapshot)
  assert.deepEqual(candidate, inputSnapshot)
  assert.equal(Object.isFrozen(result), true)
  assert.equal(Object.isFrozen(result[1]), true)
})

console.log(`village practice receipt contract: ${checks}/${checks} PASS — pure practice-only evidence`)
