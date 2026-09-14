import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

import React from 'react'

import { createNote } from '../src/lib/fsrs'
import { FSRS_EAR_KEY, FSRS_VOICE_KEY, migrate } from '../src/lib/fsrsFamily'
import {
  PITCHFORKS_PRESENTATION_JOURNEY_KEY,
  createPitchforksPresentationJourney,
} from '../src/components/PitchDefender/pitchforksCurriculum'
import {
  PITCHFORKS_RANGE_PROFILE_KEY,
  createPitchforksRangeProfile,
} from '../src/components/PitchDefender/pitchforksRange'
import {
  createPitchforksBossRecital,
  type PitchforksBossRecitalStorage,
} from '../src/components/PitchDefender/pitchforksBossRecital'

// Load the production boundary used by PitchforksIII. The test intentionally
// exercises its storage selector and boss controller instead of scanning source.
const require = createRequire(import.meta.url)
require.extensions['.css'] = () => undefined
;(globalThis as { React?: typeof React }).React = React
const {
  selectPitchforksBossRecitalStorage,
  shouldStartPitchforksBossMicrophone,
} = require('../src/components/PitchDefender/PitchforksIII') as typeof import('../src/components/PitchDefender/PitchforksIII')

class ProfileStorage {
  private readonly values = new Map<string, string>()

  constructor(initial: Record<string, string> = {}) {
    for (const [key, value] of Object.entries(initial)) this.values.set(key, value)
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  snapshot(): Array<[string, string]> {
    return [...this.values.entries()].sort(([left], [right]) => left.localeCompare(right))
  }
}

function durableStorage(profile: ProfileStorage, key: string): PitchforksBossRecitalStorage {
  return {
    loadStore: () => migrate(key, profile.getItem(key)),
    saveStore: (_, store) => {
      profile.setItem(key, JSON.stringify(store))
      return true
    },
    readback: (_, note) => migrate(key, profile.getItem(key))[note] ?? null,
  }
}

function resolveCurrent(controller: ReturnType<typeof createPitchforksBossRecital>) {
  const state = controller.state()
  if (!state.currentNote || !state.claimId) throw new Error('expected an active recital claim')
  return controller.resolve({
    attempt: state.attempt,
    lane: state.lane,
    note: state.currentNote,
    cursor: state.cursor,
    claimId: state.claimId,
    correct: true,
    latencyMs: 800,
  })
}

function assertProfileUnchanged(profile: ProfileStorage, before: Array<[string, string]>, phase: string): void {
  assert.deepEqual(profile.snapshot(), before, `persistent profile changed during ${phase}`)
}

function seededProfile(): ProfileStorage {
  const assessedAt = '2026-09-14T04:00:00.000Z'
  const range = createPitchforksRangeProfile({
    lowNote: 'C4',
    highNote: 'G4',
    anchorNote: 'E4',
    source: 'guided',
    assessedAt,
  })
  if (!range) throw new Error('expected a valid range fixture')
  const journey = createPitchforksPresentationJourney({
    rangeAssessedAt: assessedAt,
    startedAt: assessedAt,
    unlockedNotes: ['C4', 'A4'],
    guidedNotes: ['C4'],
  })
  return new ProfileStorage({
    [FSRS_EAR_KEY]: JSON.stringify({ C4: createNote('C4') }),
    [FSRS_VOICE_KEY]: JSON.stringify({ A4: createNote('A4') }),
    [PITCHFORKS_RANGE_PROFILE_KEY]: JSON.stringify(range),
    [PITCHFORKS_PRESENTATION_JOURNEY_KEY]: JSON.stringify(journey),
  })
}

function assertPersistedSuccess(result: ReturnType<typeof resolveCurrent>): void {
  assert.equal(result.kind, 'persisted')
  if (result.kind !== 'persisted') return
  assert.equal(result.outcome, 'success')
  assert.equal(result.receipt.persisted, true)
}

const practiceWorlds = ['dungeon', 'village-gate'] as const
for (const practiceWorld of practiceWorlds) {
  const profile = seededProfile()
  const beforeEntry = profile.snapshot()
  const storage = selectPitchforksBossRecitalStorage(
    true,
    durableStorage(profile, FSRS_EAR_KEY),
  )

  // This is the exact EAR practice entry decision. It must never request a mic,
  // even when the chamber is identified by a world.
  let microphoneStarts = 0
  if (shouldStartPitchforksBossMicrophone({ lane: 'ear', earnedWorld: null, practiceWorld })) microphoneStarts += 1
  assert.equal(microphoneStarts, 0, `${practiceWorld} EAR practice must not start microphone capture`)
  assert.deepEqual(storage.loadStore('ear'), {}, `${practiceWorld} practice must begin with a local empty store`)
  assertProfileUnchanged(profile, beforeEntry, `${practiceWorld} EAR entry`)

  const recital = createPitchforksBossRecital({
    attempt: `ear-practice:${practiceWorld}`,
    lane: 'ear',
    sequence: ['E4', 'F4'],
    admittedNotes: ['C4', 'E4', 'F4'],
    storage,
  })
  const beforeAnswer = profile.snapshot()
  const answer = resolveCurrent(recital)
  assertPersistedSuccess(answer)
  assert.equal(recital.state().cursor, 1, `${practiceWorld} EAR answer may advance the local encounter`)
  assert.ok(storage.loadStore('ear').E4, `${practiceWorld} answer should remain available inside this recital`)
  assertProfileUnchanged(profile, beforeAnswer, `${practiceWorld} EAR answer`)

  const beforeExit = profile.snapshot()
  const exit = recital.handle({ type: 'navigation' })
  assert.equal(exit.kind, 'ignored')
  if (exit.kind === 'ignored') assert.equal(exit.reason, 'navigation')
  assert.equal(recital.state().status, 'cancelled')
  assertProfileUnchanged(profile, beforeExit, `${practiceWorld} EAR exit`)

  const beforeReload = profile.snapshot()
  const reloadedStorage = selectPitchforksBossRecitalStorage(
    true,
    durableStorage(profile, FSRS_EAR_KEY),
  )
  const reloadedRecital = createPitchforksBossRecital({
    attempt: `ear-practice-reload:${practiceWorld}`,
    lane: 'ear',
    sequence: ['E4', 'F4'],
    admittedNotes: ['C4', 'E4', 'F4'],
    storage: reloadedStorage,
  })
  assert.equal(reloadedRecital.state().cursor, 0)
  assert.deepEqual(reloadedStorage.loadStore('ear'), {}, `${practiceWorld} practice answer must not survive reload`)
  assertProfileUnchanged(profile, beforeReload, `${practiceWorld} EAR reload`)
}

// Genuine earned voice still uses the durable family store and still starts the
// microphone path. This test proves the positive control without claiming that
// a real device microphone was observed in Terra's 3016 run.
const earnedProfile = seededProfile()
const earnedVoiceStorage = selectPitchforksBossRecitalStorage(
  false,
  durableStorage(earnedProfile, FSRS_VOICE_KEY),
)
let earnedMicrophoneStarts = 0
if (shouldStartPitchforksBossMicrophone({ lane: 'voice', earnedWorld: 'bell-tower', practiceWorld: null })) earnedMicrophoneStarts += 1
assert.equal(earnedMicrophoneStarts, 1, 'earned voice campaign must retain microphone startup')

const beforeEarnedVoice = earnedProfile.snapshot()
const earnedVoiceRecital = createPitchforksBossRecital({
  attempt: 'earned-voice:bell-tower',
  lane: 'voice',
  sequence: ['E4'],
  admittedNotes: ['C4', 'E4'],
  storage: earnedVoiceStorage,
})
const earnedVoiceAnswer = resolveCurrent(earnedVoiceRecital)
assertPersistedSuccess(earnedVoiceAnswer)
assert.notDeepEqual(earnedProfile.snapshot(), beforeEarnedVoice, 'earned voice answer must change durable progress')
assert.ok(migrate(FSRS_VOICE_KEY, earnedProfile.getItem(FSRS_VOICE_KEY)).E4, 'earned voice answer must persist in voice storage')

const reloadedEarnedVoiceStorage = selectPitchforksBossRecitalStorage(
  false,
  durableStorage(earnedProfile, FSRS_VOICE_KEY),
)
assert.ok(reloadedEarnedVoiceStorage.loadStore('voice').E4, 'earned voice progress must be visible after reload')

console.log('pitchforks practice progress isolation: EAR entry/answer/exit/reload isolated; earned voice persists: PASS')
