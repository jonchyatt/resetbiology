import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  getVillageLessonCandidates,
  selectVillageLessonCandidate,
} from '../src/components/PitchDefender/villageLessonSelector'
import {
  createPitchforksPresentationJourney,
  parsePitchforksPresentationJourney,
} from '../src/components/PitchDefender/pitchforksCurriculum'
import {
  persistPitchforksPresentationJourney,
  type PitchforksJourneySaveStorage,
} from '../src/components/PitchDefender/PitchforksIII'
import { recordVillagePractice } from '../src/components/PitchDefender/villagePractice'

const source = readFileSync(
  new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url),
  'utf8',
)

let checks = 0
const check = (run: () => void): void => {
  run()
  checks += 1
}

const spawnStart = source.indexOf('const spawnVillager')
const spawnEnd = source.indexOf('const startWave', spawnStart)
assert.ok(spawnStart >= 0 && spawnEnd > spawnStart, 'spawn seam must remain present')
const spawn = source.slice(spawnStart, spawnEnd)
const reviewStart = source.indexOf('const reviewTargetNote')
const reviewEnd = source.indexOf('const playVillagerSequence', reviewStart)
assert.ok(reviewStart >= 0 && reviewEnd > reviewStart, 'review seam must remain present')
const review = source.slice(reviewStart, reviewEnd)
const sequenceStart = source.indexOf('const playVillagerSequence')
const sequenceEnd = source.indexOf('\n  useEffect', sequenceStart)
assert.ok(sequenceStart >= 0 && sequenceEnd > sequenceStart, 'sequence seam must remain present')
const sequence = source.slice(sequenceStart, sequenceEnd)

check(() => {
  const candidates = getVillageLessonCandidates({
    admittedNotes: ['F4'],
    introducedNotes: ['D4'],
    comfortableRange: { lowNote: 'D4', highNote: 'A4' },
  })
  assert.deepEqual(candidates, [{
    objective: 'minor-third',
    contextNote: 'D4',
    targetNote: 'F4',
    bothVoiceAdmitted: false,
  }])
  assert.deepEqual(selectVillageLessonCandidate({
    admittedNotes: ['F4'],
    introducedNotes: ['D4'],
    comfortableRange: { lowNote: 'D4', highNote: 'A4' },
    targetNote: 'F4',
    encounterIndex: 0,
  }), candidates[0])
})

check(() => {
  assert.match(spawn, /const range = rangeProfileRef\.current/)
  assert.match(spawn, /const journey = presentationJourneyRef\.current/)
  assert.match(spawn, /normalBellRouteAvailable\(\)\s*&&[\s\S]*inputModeRef\.current === ['"]voice['"][\s\S]*totalTines === 1[\s\S]*!!range/)
  assert.match(spawn, /admittedNotes:\s*unlockedNotesRef\.current/)
  assert.match(spawn, /introducedNotes:\s*\[\.\.\.journey\.guidedNotes, \.\.\.journey\.unlockedNotes\]/)
  assert.match(spawn, /comfortableRange:\s*range/)
  assert.match(spawn, /selectVillageLessonCandidate\(\{[\s\S]*targetNote,[\s\S]*encounterIndex,[\s\S]*\}\)/)
  assert.match(spawn, /const targetNote = notes\[0\]/)
  assert.match(spawn, /const encounterIndex = presentationVisitCountByTargetRef\.current\.get\(targetNote\) \?\? 0/)
})

check(() => {
  const alternatingArgs = {
    admittedNotes: ['F4', 'G4'],
    introducedNotes: ['D4', 'A4', 'C5', 'C4', 'E4', 'B4'],
    comfortableRange: { lowNote: 'C4', highNote: 'C5' },
  } as const
  const visits = new Map<string, number>()
  const targets = ['F4', 'G4', 'F4', 'G4', 'F4', 'G4', 'F4', 'G4']
  const selected = targets.map(targetNote => {
    const encounterIndex = visits.get(targetNote) ?? 0
    const candidate = selectVillageLessonCandidate({ ...alternatingArgs, targetNote, encounterIndex })
    if (candidate) visits.set(targetNote, encounterIndex + 1)
    return `${targetNote}:${candidate?.contextNote ?? 'none'}`
  })
  assert.deepEqual(selected, [
    'F4:D4', 'G4:E4', 'F4:A4', 'G4:B4',
    'F4:C5', 'G4:C4', 'F4:D4', 'G4:E4',
  ])
  assert.deepEqual([...visits], [['F4', 4], ['G4', 4]])
})

check(() => {
  assert.match(source, /const presentationVisitCountByTargetRef = useRef<Map<string, number>>\(new Map\(\)\)/)
  assert.match(spawn, /if \(supportedLesson\) \{[\s\S]*presentationVisitCountByTargetRef\.current\.set\([\s\S]*encounterIndex >= Number\.MAX_SAFE_INTEGER \? 0 : encounterIndex \+ 1/)
  assert.match(source.slice(source.indexOf('const beginPlaying'), source.indexOf('const startGame')), /presentationVisitCountByTargetRef\.current\.clear\(\)/)
  assert.match(source.slice(source.indexOf('const quitToMenu'), source.indexOf('const beginSongcraft')), /presentationVisitCountByTargetRef\.current\.clear\(\)/)
  const waveStart = source.indexOf('const startWave')
  const waveEnd = source.indexOf('const addBolt', waveStart)
  assert.ok(waveStart >= 0 && waveEnd > waveStart, 'wave seam must remain present')
  assert.doesNotMatch(source.slice(waveStart, waveEnd), /presentationVisitCountByTargetRef\.current\.clear\(\)/)
})

check(() => {
  assert.match(spawn, /supportedLesson\?: SupportedVillageLesson|supportedLesson:/)
  assert.match(spawn, /supportedLesson:\s*\{[\s\S]*objective:\s*supportedLesson\.objective[\s\S]*contextNote:\s*supportedLesson\.contextNote[\s\S]*targetNote:\s*supportedLesson\.targetNote/)
  assert.match(spawn, /\.\.\.\(supportedLesson \? \{[\s\S]*supportedLesson:/)
  assert.doesNotMatch(spawn, /notes\s*=\s*\[|notes\s*=\s*pickNextNote/)
})

check(() => {
  const noPair = selectVillageLessonCandidate({
    admittedNotes: ['D4'],
    introducedNotes: ['D4'],
    comfortableRange: { lowNote: 'D4', highNote: 'A4' },
    targetNote: 'D4',
    encounterIndex: 0,
  })
  assert.equal(noPair, undefined, 'no interval candidate leaves the original target unchanged')
  assert.match(spawn, /: undefined/)
})

check(() => {
  assert.match(review, /const supportedVillageLesson = normalBellRouteAvailable\(\)[\s\S]*lane === ['"]voice['"][\s\S]*target\.villager\.totalTines === 1[\s\S]*target\.villager\.supportedLesson\?\.targetNote === target\.note/)
  assert.match(review, /supportedVillageLesson \|\| demoRef\.current \|\| support === ['"]guided['"]/
  )
})

check(() => {
  const supportedStart = review.indexOf('if (supportedVillageLesson)')
  const supportedEnd = review.indexOf('if (lane === \'buttons\')', supportedStart)
  assert.ok(supportedStart >= 0 && supportedEnd > supportedStart, 'supported early-return seam must precede ordinary grading')
  const supported = review.slice(supportedStart, supportedEnd)
  assert.match(supported, /if \(correct\)[\s\S]*waveNotesSungRef\.current\.add\(target\.note\)[\s\S]*acceptNormalBellCombatResponse\(target\)[\s\S]*\}\s*return true/)
  assert.match(supported, /cueSupportByTargetRef\.current\.delete\(target\.key\)/)
  assert.match(supported, /hintedTargetKeysRef\.current\.delete\(target\.key\)/)
  assert.doesNotMatch(supported, /gradeVoice|gradeEar|saveFsrs|recordMasteryProgressForReview|reconcileCampaignProgress|completeJourneyGuidanceForNote|saveCueSupport|recordCueSupportOutcome|cueSupportProfileRef\.current\s*=|cueSupportProfileRef\.current\.notes/)
})

check(() => {
  const supportedStart = review.indexOf('if (supportedVillageLesson)')
  const supportedEnd = review.indexOf('if (lane === \'buttons\')', supportedStart)
  assert.ok(supportedStart >= 0 && supportedEnd > supportedStart)
  const supported = review.slice(supportedStart, supportedEnd)
  assert.match(supported, /if \(correct\)/)
  assert.match(supported, /acceptNormalBellCombatResponse\(target\)/)
  const ordinary = review.slice(supportedEnd)
  assert.match(ordinary, /gradeEar\(earFsrsRef\.current/)
  assert.match(ordinary, /gradeVoice\(fsrsRef\.current/)
  assert.match(ordinary, /saveFsrs\(['"]voice['"]\)/)
  assert.match(ordinary, /saveCueSupport\(\)/)
  assert.match(ordinary, /recordMasteryProgressForReview\(target\.note\)/)
  assert.match(ordinary, /reconcileCampaignProgress\(\)/)
})

check(() => {
  const supportedStart = review.indexOf('if (supportedVillageLesson)')
  const supportedEnd = review.indexOf('if (lane === \'buttons\')', supportedStart)
  assert.ok(supportedStart >= 0 && supportedEnd > supportedStart)
  const supported = review.slice(supportedStart, supportedEnd)
  assert.match(supported, /recordVillagePractice\(currentVillagePractice, \{[\s\S]*objective: supportedVillageLesson\.objective[\s\S]*contextNote: supportedVillageLesson\.contextNote[\s\S]*targetNote: supportedVillageLesson\.targetNote/)
  assert.match(supported, /support: ['"]SUPPORTED['"][\s\S]*cueFree: false/)
  assert.match(supported, /normalVoice: normalBellRouteAvailable\(\) && lane === ['"]voice['"]/)
  assert.match(supported, /demo: demoRef\.current[\s\S]*simulated: bossSimulatingRef\.current/)
  assert.match(supported, /journeyId: journey\.startedAt[\s\S]*sessionId: practiceSessionId/)
  assert.match(supported, /getMasterySessionId\(\)[\s\S]*runGenerationRef\.current/)
  assert.match(supported, /eventId: `village-practice:\$\{practiceSessionId\}:\$\{target\.key\}`/)
  assert.match(supported, /encounterIndex: target\.villager\.id[\s\S]*introducedEncounterIndex: target\.villager\.id/)
  assert.match(supported, /timestampMs: Date\.now\(\)/)
  assert.match(supported, /admittedNotes: unlockedNotesRef\.current[\s\S]*introducedNotes: \[\.\.\.journey\.guidedNotes, \.\.\.journey\.unlockedNotes\][\s\S]*comfortableRange: range/)
  assert.match(supported, /if \(nextVillagePractice !== currentVillagePractice\) \{[\s\S]*const nextJourney = \{ \.\.\.journey, villagePractice: nextVillagePractice \}[\s\S]*presentationJourneyRef\.current = nextJourney[\s\S]*setPresentationJourney\(nextJourney\)[\s\S]*savePresentationJourney\(nextJourney\)/)
  assert.doesNotMatch(supported, /UNAIDED_RETURN|gradeVoice|gradeEar|saveFsrs|recordMasteryProgressForReview|reconcileCampaignProgress|completeJourneyGuidanceForNote|saveCueSupport|recordCueSupportOutcome|cueSupportProfileRef\.current\s*=|cueSupportProfileRef\.current\.notes/)
})

const supportedRange = { lowNote: 'D4', highNote: 'A4' } as const
const supportedOrder = ['D4', 'F4', 'A4'] as const
const supportedRangeAssessedAt = '2026-09-13T19:00:00.000Z'
const supportedJourneyStartedAt = '2026-09-13T19:01:00.000Z'
const supportedJourney = {
  ...createPitchforksPresentationJourney({
    rangeAssessedAt: supportedRangeAssessedAt,
    startedAt: supportedJourneyStartedAt,
    unlockedNotes: ['D4', 'F4'],
    guidedNotes: ['D4'],
  }),
  currentLevel: 4,
  dungeonClear: {
    version: 1 as const,
    rangeAssessedAt: supportedRangeAssessedAt,
    startedAt: supportedJourneyStartedAt,
    admittedNotes: ['D4', 'F4'],
    clearedAt: 2_500,
  },
}
const supportedPracticeInput = (overrides: Record<string, unknown> = {}) => ({
  eventId: 'village-practice:mastery:run:7:12:0',
  journeyId: supportedJourneyStartedAt,
  sessionId: 'mastery:run:7',
  encounterIndex: 12,
  introducedEncounterIndex: 12,
  timestampMs: 3_000,
  objective: 'minor-third' as const,
  contextNote: 'D4',
  targetNote: 'F4',
  support: 'SUPPORTED' as const,
  correct: true,
  normalVoice: true,
  demo: false,
  simulated: false,
  cueFree: false,
  candidateEligibility: {
    admittedNotes: ['D4', 'F4'],
    introducedNotes: [...supportedJourney.guidedNotes, ...supportedJourney.unlockedNotes],
    comfortableRange: supportedRange,
  },
  ...overrides,
})

check(() => {
  const practice = recordVillagePractice(supportedJourney.villagePractice ?? [], supportedPracticeInput())
  assert.equal(practice.length, 1)
  assert.deepEqual(practice[0], {
    kind: 'practice',
    eventId: 'village-practice:mastery:run:7:12:0',
    journeyId: supportedJourneyStartedAt,
    sessionId: 'mastery:run:7',
    encounterIndex: 12,
    introducedEncounterIndex: 12,
    timestampMs: 3_000,
    objective: 'minor-third',
    contextNote: 'D4',
    targetNote: 'F4',
    support: 'SUPPORTED',
    cueFree: false,
  })

  const nextJourney = { ...supportedJourney, villagePractice: practice }
  class MemoryJourneyStorage implements PitchforksJourneySaveStorage {
    private readonly values = new Map<string, string>()

    setItem(key: string, value: string): void {
      this.values.set(key, value)
    }

    getItem(key: string): string | null {
      return this.values.get(key) ?? null
    }
  }

  const storage = new MemoryJourneyStorage()
  const saved = persistPitchforksPresentationJourney(storage, nextJourney)
  assert.equal(saved.status, 'confirmed')
  const parsed = parsePitchforksPresentationJourney(
    storage.getItem('pitchforks3_presentation_journey_v1'),
    supportedRangeAssessedAt,
    supportedOrder,
  )
  assert.deepEqual(parsed, nextJourney)
  assert.equal(parsed?.currentLevel, 4)
  assert.deepEqual(parsed?.dungeonClear, supportedJourney.dungeonClear)
  assert.deepEqual(parsed?.guidedNotes, supportedJourney.guidedNotes)
  assert.deepEqual(parsed?.unlockedNotes, supportedJourney.unlockedNotes)
})

check(() => {
  const first = recordVillagePractice(supportedJourney.villagePractice ?? [], supportedPracticeInput())
  const duplicate = recordVillagePractice(first, supportedPracticeInput({
    eventId: 'village-practice:mastery:run:8:12:0',
    sessionId: 'mastery:run:8',
    timestampMs: 4_000,
  }))
  assert.strictEqual(duplicate, first, 'one supported receipt per journey and directed pair')
  assert.equal(duplicate.length, 1)

  const incorrect = recordVillagePractice(first, supportedPracticeInput({
    eventId: 'village-practice:mastery:run:9:12:0',
    correct: false,
  }))
  assert.strictEqual(incorrect, first, 'incorrect supported responses never append practice evidence')
})

check(() => {
  // The context lesson is an exact normal Village voice-only projection of
  // the already-selected target; every other branch keeps ordinary playback.
  assert.match(sequence, /const supportedLesson = normalBellRouteAvailable\(\)[\s\S]*inputModeRef\.current === ['"]voice['"][\s\S]*villager\.totalTines === 1[\s\S]*liveNotes\.length === 1[\s\S]*villager\.supportedLesson\?\.contextNote[\s\S]*villager\.supportedLesson\.targetNote === liveNotes\[0\]/)
  assert.match(sequence, /const playbackNotes = supportedLesson\s*\?\s*\[supportedLesson\.contextNote, supportedLesson\.targetNote\]\s*:\s*liveNotes/)
  assert.doesNotMatch(sequence, /villager\.notes\s*=|liveNotes\s*=\s*\[/)
})

check(() => {
  // Tone scheduling owns a separate playback index while both supported
  // tones retain the actual target tine key.
  assert.match(sequence, /const toneWindowMs = \(playbackNotes\.length - 1\) \* TONE_SPACING_MS \+ TONE_MS/)
  assert.match(sequence, /playbackNotes\.forEach\(\(note, toneIndex\)/)
  assert.match(sequence, /const tineIndex = supportedLesson \? villager\.burned : villager\.burned \+ toneIndex/)
  assert.match(sequence, /const promptOwnerKey = `\$\{villager\.id\}:\$\{tineIndex\}`/)
  assert.doesNotMatch(sequence, /const index = villager\.burned \+ toneIndex/)
})

check(() => {
  // The copy describes the authored interval and direction without making the
  // context tone an answer or changing the existing final target prompt.
  assert.match(sequence, /supportedLesson\?\.objective\.replace\('-', ' '\)/)
  assert.match(sequence, /noteToFreq\(supportedLesson\.targetNote\) > noteToFreq\(supportedLesson\.contextNote\)/)
  assert.match(sequence, /Listen \$\{supportedLesson\.contextNote\}, then sing \$\{supportedLesson\.targetNote\} comfortably/)
  assert.match(sequence, /starting note \$\{note\}/)
  assert.match(sequence, /const note = villager\.notes\[villager\.burned\]/)
})

check(() => {
  // Context and target use the established timer, piano, and global echo
  // suppression authorities; muted/audio-off playback still exits earlier.
  assert.match(sequence, /const suppressMs = toneWindowMs \+ ECHO_TAIL_MS/)
  assert.match(sequence, /clearCueTimers\(\)/)
  assert.match(sequence, /setPianoVolume\(cueVolumeRef\.current\)/)
  assert.match(sequence, /playPianoNote\(note, \{ exact: true \}\)/)
  assert.match(sequence, /matchingSuppressedUntilRef\.current = performance\.now\(\) \+ TONE_SUPPRESS_MS/)
  assert.match(sequence, /markToneEmitted\(TONE_SUPPRESS_MS\)/)
  assert.match(sequence, /for \(const note of liveNotes\) waveNotesHeardRef\.current\.add\(note\)/)
})

check(() => {
  // The two existing callers remain the only admission/replay entry points.
  assert.match(source, /playVillagerSequence\(target\.villager, ['"]cue['"]\)/)
  assert.match(source, /playVillagerSequence\(active\.villager, ['"]replay['"]\)/)
  assert.match(sequence, /: liveNotes/)
})

console.log(`pitchforks supported Village review seam: ${checks}/${checks} PASS (source/harness only; mounted route remains unverified)`)
