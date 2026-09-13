import assert from 'node:assert/strict'

import {
  createPitchforksPresentationJourney,
  parsePitchforksPresentationJourney,
} from '../src/components/PitchDefender/pitchforksCurriculum'
import {
  persistPitchforksPresentationJourney,
  type PitchforksJourneySaveStorage,
} from '../src/components/PitchDefender/PitchforksIII'
import { recordVillagePractice } from '../src/components/PitchDefender/villagePractice'

type PracticeInput = Parameters<typeof recordVillagePractice>[1]

const range = { lowNote: 'D3', highNote: 'A4' } as const
const order = ['D3', 'F3', 'A3', 'D4', 'E4', 'F4', 'A4'] as const
const startedAt = '2026-09-13T18:01:00.000Z'
const rangeAssessedAt = '2026-09-13T18:00:00.000Z'
const eligibility = {
  admittedNotes: [...order],
  introducedNotes: [...order],
  comfortableRange: range,
} as const

const input = (overrides: Record<string, unknown> = {}): PracticeInput => ({
  eventId: 'event-1',
  journeyId: startedAt,
  sessionId: 'session-1',
  encounterIndex: 3,
  introducedEncounterIndex: 1,
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
  candidateEligibility: eligibility,
  ...overrides,
})

function receipt(overrides: Record<string, unknown> = {}) {
  const result = recordVillagePractice([], input(overrides))
  assert.equal(result.length, 1)
  return result[0]
}

const firstReceipt = receipt()
const journey = createPitchforksPresentationJourney({
  rangeAssessedAt,
  startedAt,
  unlockedNotes: [...order],
  guidedNotes: [],
  villagePractice: [firstReceipt],
})

let checks = 0
const check = (run: () => void): void => {
  run()
  checks += 1
}

class JourneyStorage implements PitchforksJourneySaveStorage {
  value: string | null = null

  setItem(_key: string, value: string): void {
    this.value = value
  }

  getItem(_key: string): string | null {
    return this.value
  }
}

check(() => {
  const storage = new JourneyStorage()
  const saved = persistPitchforksPresentationJourney(storage, journey)
  assert.equal(saved.status, 'confirmed')
  const parsed = parsePitchforksPresentationJourney(storage.value, rangeAssessedAt, order)
  assert.deepEqual(parsed, journey)
})

check(() => {
  const legacy = createPitchforksPresentationJourney({
    rangeAssessedAt,
    startedAt,
    unlockedNotes: [...order],
    guidedNotes: [],
  })
  assert.equal('villagePractice' in legacy, false)
  assert.deepEqual(
    parsePitchforksPresentationJourney(JSON.stringify(legacy), rangeAssessedAt, order),
    legacy,
  )
})

const dungeonClear = {
  version: 1 as const,
  rangeAssessedAt,
  startedAt,
  admittedNotes: ['D3', 'F3'],
  clearedAt: 2_000,
}

check(() => {
  const malformed = {
    ...journey,
    dungeonClear,
    villagePractice: [{ ...firstReceipt, cueFree: 'true' }],
  }
  const parsed = parsePitchforksPresentationJourney(
    JSON.stringify(malformed),
    rangeAssessedAt,
    order,
  )
  assert.deepEqual(parsed?.dungeonClear, dungeonClear)
  assert.equal('villagePractice' in (parsed ?? {}), false)
})

check(() => {
  const duplicate = { ...firstReceipt, eventId: 'event-2', timestampMs: 2_000 }
  const parsed = parsePitchforksPresentationJourney(
    JSON.stringify({ ...journey, villagePractice: [firstReceipt, duplicate] }),
    rangeAssessedAt,
    order,
  )
  assert.equal('villagePractice' in (parsed ?? {}), false)
})

check(() => {
  const first = recordVillagePractice([], input({ eventId: 'first', timestampMs: 9_000 }))
  const replay = recordVillagePractice(first, input({ eventId: 'second', timestampMs: 1_000 }))
  assert.strictEqual(replay, first)
  assert.equal(replay[0].eventId, 'first')
  assert.equal(replay[0].timestampMs, 9_000)
})

check(() => {
  const priorJourney = recordVillagePractice([], input({
    eventId: 'shared-event-id',
    journeyId: 'journey-before',
  }))
  const nextJourney = recordVillagePractice(priorJourney, input({
    eventId: 'shared-event-id',
    journeyId: startedAt,
    contextNote: 'F4',
    targetNote: 'D4',
  }))
  assert.equal(nextJourney.length, 2, 'same event id is valid in a new journey')
  assert.equal(nextJourney[1].journeyId, startedAt)

  const sameJourneyReplay = recordVillagePractice(nextJourney, input({
    eventId: 'shared-event-id',
    journeyId: startedAt,
    contextNote: 'A4',
    targetNote: 'F4',
  }))
  assert.strictEqual(sameJourneyReplay, nextJourney, 'same journey event id remains inert')
})

check(() => {
  const supported = recordVillagePractice([], input({ eventId: 'supported' }))
  const unaided = recordVillagePractice(supported, input({
    eventId: 'unaided',
    sessionId: 'session-2',
    encounterIndex: 5,
    introducedEncounterIndex: 1,
    support: 'UNAIDED_RETURN',
    cueFree: true,
  }))
  assert.equal(unaided.length, 2)
  assert.deepEqual(unaided.map(row => row.support), ['SUPPORTED', 'UNAIDED_RETURN'])
})

check(() => {
  const reversed = recordVillagePractice(
    recordVillagePractice([], input({ eventId: 'forward' })),
    input({
      eventId: 'reverse',
      contextNote: 'F4',
      targetNote: 'D4',
    }),
  )
  const exactOctave = recordVillagePractice(reversed, input({
    eventId: 'lower-octave',
    contextNote: 'D3',
    targetNote: 'F3',
  }))
  assert.equal(exactOctave.length, 3)
  assert.deepEqual(exactOctave.map(row => [row.contextNote, row.targetNote]), [
    ['D4', 'F4'],
    ['F4', 'D4'],
    ['D3', 'F3'],
  ])
})

check(() => {
  const previous = recordVillagePractice([], input({ eventId: 'prior' }))
  const malformed: readonly Record<string, unknown>[] = [
    input({ eventId: 'bad-range', candidateEligibility: { ...eligibility, comfortableRange: { lowNote: 'A4', highNote: 'D3' } } }),
    input({ eventId: 'unknown-note', targetNote: 'H4' }),
    input({ eventId: 'wrong-interval', objective: 'major-third' }),
    input({ eventId: 'unsupported-cue', support: 'HINTED' }),
    input({ eventId: 'negative-index', encounterIndex: -1 }),
    input({ eventId: 'duplicate-event' }),
  ]
  for (const candidate of malformed) {
    assert.strictEqual(recordVillagePractice(previous, candidate as PracticeInput), previous)
  }
})

check(() => {
  const invalidRows = [
    { ...firstReceipt, journeyId: 'other-journey' },
    { ...firstReceipt, contextNote: 'H4' },
    { ...firstReceipt, targetNote: 'A4', objective: 'minor-third' },
    { ...firstReceipt, encounterIndex: -1 },
    { ...firstReceipt, cueFree: 1 },
    { ...firstReceipt, kind: 'practice-receipt' },
    { ...firstReceipt, extra: true },
  ]
  for (const row of invalidRows) {
    const parsed = parsePitchforksPresentationJourney(
      JSON.stringify({ ...journey, villagePractice: [row] }),
      rangeAssessedAt,
      order,
    )
    assert.equal('villagePractice' in (parsed ?? {}), false)
  }
})

console.log(`pitchforks Village practice persistence contract: ${checks}/${checks} PASS`)
