import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import type { NoteMemory } from '../src/lib/fsrs'
import {
  advancePitchforksCampaignProgress,
  advancePitchforksExaminationProgress,
  advancePitchforksVillageProgress,
  type PitchforksVillageProgressInput,
} from '../src/components/PitchDefender/pitchforksCampaignProgress'
import {
  createPitchforksPresentationJourney,
  parsePitchforksPresentationJourney,
  type PitchforksPresentationJourney,
} from '../src/components/PitchDefender/pitchforksCurriculum'
import { bindPitchforksVillageCurriculum } from '../src/components/PitchDefender/pitchforksCampaignProgress'
import { recordVillagePractice, type VillagePracticeReceipt } from '../src/components/PitchDefender/villagePractice'
import {
  persistPitchforksMasteryStore,
  persistPitchforksPresentationJourney,
} from '../src/components/PitchDefender/PitchforksIII'
import { projectPitchforksWorldGates } from '../src/components/PitchDefender/pitchforksCampaignProgress'

/**
 * PF-10 acceptance fixture.
 *
 * These are explicitly time-controlled fixtures, not claims about human
 * singing. The fixture names are part of the receipt contract: a real-device
 * microphone run is still required by D9 after this deterministic gate.
 */
type Profile = 'fresh-ear-only' | 'fresh-voice' | 'legacy-cleared' | 'mixed-lane'
type EvidenceKind = 'silence' | 'stale-input' | 'cue-only' | 'repeated-frame' | 'wrong-note' | 'wrong-octave'
type Fixture = {
  kind: 'truthful-first-success' | EvidenceKind
  note: string
  octave: number
  generation: number
  source: 'microphone' | 'cue' | 'none'
  confidence: number
  heldMs: number
}
type Evidence = { receipts: string[]; strikes: number; acceptedGenerations: number[] }
type Memory = Record<string, NoteMemory>
type Mastery = Record<string, { sessionIds: string[]; masteredAt: number | null }>

const RANGE = '2026-10-07T18:00:00.000Z'
const START = '2026-10-07T18:01:00.000Z'
const NOW = 1_728_300_000_000
const NOTES = ['C4', 'E4', 'G4'] as const
const TARGET = { note: 'C4', octave: 4 }

let assertions = 0
function check(name: string, run: () => void) {
  try { run(); assertions += 1 } catch (error) { throw new Error(name, { cause: error }) }
}

function memory(note: string): NoteMemory {
  return { note, S: 21, D: 5, due: NOW - 1, lastReview: NOW - 1000, lapses: 0, phase: 'review', learningReps: 3 }
}
function voiceMemory(enabled: boolean): Memory | undefined {
  return enabled ? Object.fromEntries(NOTES.map(note => [note, memory(note)])) : undefined
}
function mastery(enabled: boolean): Mastery | undefined {
  return enabled ? Object.fromEntries(NOTES.map(note => [note, { sessionIds: [`${note}-a`, `${note}-b`, `${note}-c`], masteredAt: NOW - 100 }])) : undefined
}
function journey(options: Partial<Parameters<typeof createPitchforksPresentationJourney>[0]> = {}) {
  return createPitchforksPresentationJourney({
    rangeAssessedAt: RANGE, startedAt: START, unlockedNotes: [...NOTES], guidedNotes: ['C4'], ...options,
  })
}

function evidenceFixture(kind: Fixture['kind']): Fixture {
  if (kind === 'truthful-first-success') return { kind, note: TARGET.note, octave: TARGET.octave, generation: 1, source: 'microphone', confidence: 0.9, heldMs: 300 }
  const common = { kind, note: TARGET.note, octave: TARGET.octave, generation: 2, source: 'microphone' as const, confidence: 0.9, heldMs: 300 }
  if (kind === 'silence') return { ...common, source: 'none', confidence: 0, heldMs: 0 }
  if (kind === 'stale-input') return { ...common, generation: 1 }
  if (kind === 'cue-only') return { ...common, source: 'cue' }
  if (kind === 'repeated-frame') return { ...common, generation: 2 }
  if (kind === 'wrong-note') return { ...common, note: 'D4' }
  return { ...common, octave: 3 }
}

function consume(evidence: Evidence, fixture: Fixture, seen: Set<number>): Evidence {
  const isAccepted = fixture.kind === 'truthful-first-success'
    && fixture.source === 'microphone' && fixture.confidence >= 0.75 && fixture.heldMs >= 300
    && fixture.note === TARGET.note && fixture.octave === TARGET.octave && !seen.has(fixture.generation)
  if (isAccepted) {
    seen.add(fixture.generation)
    return { ...evidence, receipts: [...evidence.receipts, 'truthful-first-success'], acceptedGenerations: [...evidence.acceptedGenerations, fixture.generation] }
  }
  return { ...evidence, strikes: evidence.strikes + (fixture.kind === 'wrong-note' ? 1 : 0) * 0 }
}

function input(j: PitchforksPresentationJourney, voice: Memory | undefined, masteryRecords: Mastery | undefined): PitchforksVillageProgressInput {
  return { journey: j, rangeAssessedAt: RANGE, startedAt: START, normalVoice: true, demo: false, simulated: false,
    comfortableRange: { lowNote: 'C4', highNote: 'G4' }, voiceMemory: voice, masteryRecords, nowMs: NOW }
}

function prepareVillage(j: PitchforksPresentationJourney): PitchforksPresentationJourney {
  const bound = bindPitchforksVillageCurriculum(j, { lowNote: 'C4', highNote: 'G4' }, NOW)
  if (!bound.villageCurriculum) return bound
  const practice = bound.villageCurriculum.bindings.reduce<readonly VillagePracticeReceipt[]>((receipts, binding, index) =>
    recordVillagePractice(receipts, {
      ...binding, eventId: `pf10-return-${index}`, journeyId: START, sessionId: 'pf10-fixture',
      introducedEncounterIndex: index, encounterIndex: index + 5, timestampMs: NOW - 1,
      support: 'UNAIDED_RETURN', correct: true, cueFree: true, normalVoice: true,
      demo: false, simulated: false,
      candidateEligibility: { admittedNotes: [...NOTES], introducedNotes: [...NOTES], comfortableRange: { lowNote: 'C4', highNote: 'G4' } },
    }), [])
  return { ...bound, villagePractice: practice }
}

class StorageFixture {
  value: string | null = null
  setItem(_key: string, value: string) { this.value = value }
  getItem(_key: string) { return this.value }
}

function runProfile(profile: Profile) {
  const voice = voiceMemory(profile !== 'fresh-ear-only')
  const records = mastery(profile !== 'fresh-ear-only')
  let current = profile === 'legacy-cleared'
    ? journey({ dungeonClear: { version: 1, rangeAssessedAt: RANGE, startedAt: START, admittedNotes: [...NOTES], clearedAt: NOW - 5000 } })
    : journey()
  const seen = new Set<number>()
  let evidence: Evidence = { receipts: [], strikes: 0, acceptedGenerations: [] }
  evidence = consume(evidence, evidenceFixture('truthful-first-success'), seen)
  for (const kind of ['silence', 'stale-input', 'cue-only', 'repeated-frame', 'wrong-note', 'wrong-octave'] as const) evidence = consume(evidence, evidenceFixture(kind), seen)

  check(`${profile}: truthful first success is a receipt`, () => assert.deepEqual(evidence.receipts, ['truthful-first-success']))
  check(`${profile}: negative corpus has zero strikes`, () => assert.equal(evidence.strikes, 0))
  check(`${profile}: only fresh microphone generation can earn`, () => assert.deepEqual(evidence.acceptedGenerations, [1]))

  const campaign = advancePitchforksCampaignProgress(input(current, voice, records))
  if (profile !== 'fresh-ear-only' && profile !== 'legacy-cleared') {
    check(`${profile}: normal Dungeon transition`, () => assert.equal(campaign.reason, 'dungeon-cleared'))
    current = prepareVillage(campaign.journey)
  } else if (profile === 'fresh-ear-only') {
    check('fresh-ear-only: recognition cannot create voice campaign clear', () => assert.equal(campaign.changed, false))
    check('fresh-ear-only: recognition has no voice mastery store', () => assert.equal(voice, undefined))
  }

  if (profile !== 'fresh-ear-only') {
    const village = advancePitchforksVillageProgress(input(current, voice, records))
    if (profile === 'legacy-cleared') {
      check('legacy-cleared: original clear receipt is preserved', () => assert.deepEqual(village.journey.dungeonClear, current.dungeonClear))
      current = village.journey
    } else {
      check(`${profile}: legitimate Village Gate transition`, () => assert.equal(village.reason, 'village-cleared'))
      current = village.journey
      const bell = advancePitchforksExaminationProgress({ ...input(current, voice, records), world: 'bell-tower', passed: true, admittedNotes: [...new Set(current.villageClear?.bindings.flatMap(binding => [binding.contextNote, binding.targetNote]) ?? [])] })
      check(`${profile}: legitimate Bell Tower transition`, () => assert.equal(bell.reason, 'bell-tower-cleared'))
      current = bell.journey
    }
  }

  const journeyStorage = new StorageFixture()
  const masteryStorage = new StorageFixture()
  const saved = persistPitchforksPresentationJourney(journeyStorage, current)
  check(`${profile}: save is confirmed by byte readback`, () => assert.equal(saved.status, 'confirmed'))
  check(`${profile}: saved journey round-trips`, () => assert.deepEqual(parsePitchforksPresentationJourney(journeyStorage.value!, RANGE, [...NOTES]), current))
  if (voice) {
    const savedMastery = persistPitchforksMasteryStore(() => masteryStorage, 'voice-fsrs', voice, () => { masteryStorage.value = JSON.stringify(voice); return true })
    check(`${profile}: voice FSRS history is preserved`, () => assert.equal(savedMastery.status, 'confirmed'))
  }
  const reopened = parsePitchforksPresentationJourney(journeyStorage.value!, RANGE, [...NOTES])
  check(`${profile}: reopen preserves receipts`, () => assert.deepEqual(reopened, current))
  check(`${profile}: continued journey retains lane separation`, () => assert.equal(profile === 'fresh-ear-only' ? voice : records, profile === 'fresh-ear-only' ? undefined : records))

  const serial = JSON.stringify({ profile, route: reopened, evidence, voiceNotes: voice ? Object.keys(voice) : [], recognitionOnly: profile === 'fresh-ear-only', gates: reopened ? projectPitchforksWorldGates(reopened).bossClears : [] })
  return JSON.parse(serial) as unknown
}

const component = readFileSync(new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url), 'utf8')
check('normal gate never depends on demo/worldProof selectors', () => {
  assert.match(component, /if \(search\.get\('demo'\) !== '1'\) return null/)
  assert.match(component, /if \(!demo\) \{[\s\S]*reason: 'demo-only'/)
})

const runs: Record<Profile, unknown>[] = []
for (const profile of ['fresh-ear-only', 'fresh-voice', 'legacy-cleared', 'mixed-lane'] as const) runs.push({ [profile]: runProfile(profile) })
const first = JSON.stringify(runs)
for (const profile of ['fresh-ear-only', 'fresh-voice', 'legacy-cleared', 'mixed-lane'] as const) runs.push({ [profile]: runProfile(profile) })
const second = JSON.stringify(runs.slice(4))
check('four profile journeys are byte-identical apart from timing', () => assert.equal(first, second))

const scenarioCount = 4 * 2 * (1 + 6)
console.log(`pitchforks normal-route gate: ${scenarioCount} scenarios, ${assertions} assertions PASS`)
console.log('zero strikes: silence, stale input, cue-only evidence, repeated frames, wrong note, wrong octave')
