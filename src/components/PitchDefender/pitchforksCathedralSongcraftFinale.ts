import type { PitchforksPresentationJourney } from './pitchforksCurriculum'
import type { SongcraftPhrase } from './pitchforksSongcraftPhrase'
import type { SongcraftPracticeState } from './pitchforksSongcraftPractice'

export type PitchforksCathedralFinaleLane = 'ear' | 'voice'
export type PitchforksCathedralFinalePhase = 'celebration' | 'saved' | 'return-practice'

export interface PitchforksCathedralFinaleState {
  readonly phase: PitchforksCathedralFinalePhase
  readonly lane: PitchforksCathedralFinaleLane
  readonly sourceKey: string
  readonly sourceSha256: string
  readonly phraseTitle: string
  readonly cathedralClearedAt: number
  readonly voiceEvidence: boolean
  readonly earEvidence: boolean
}

export interface CreatePitchforksCathedralFinaleInput {
  readonly journey: PitchforksPresentationJourney | null | undefined
  readonly phrase: SongcraftPhrase | null | undefined
  readonly practice: SongcraftPracticeState | null | undefined
}

function isComposerPhrase(phrase: SongcraftPhrase | null | undefined): phrase is SongcraftPhrase {
  return !!phrase && phrase.provenance.source === 'composer'
    && phrase.sourceKey.startsWith('pd_composed_')
    && /^[a-f0-9]{64}$/i.test(phrase.sourceSha256)
}

/**
 * Connect the earned Cathedral clear to a completed untimed Songcraft phrase.
 * This is deliberately an in-memory presentation state: the existing journey
 * remains the only progression record, so save/quit/reopen never creates a
 * second progression store.
 */
export function createPitchforksCathedralSongcraftFinale(
  input: CreatePitchforksCathedralFinaleInput,
): PitchforksCathedralFinaleState | null {
  const journey = input?.journey
  const phrase = input?.phrase
  const practice = input?.practice
  if (!journey?.cathedralClear || !isComposerPhrase(phrase) || !practice) return null
  if (practice.status !== 'complete' || !practice.summary.traversalComplete || !practice.summary.unaidedComplete) return null
  if (practice.phrase.sourceKey !== phrase.sourceKey || practice.phrase.sourceSha256 !== phrase.sourceSha256) return null
  if (practice.lane !== 'ear' && practice.lane !== 'voice') return null

  return Object.freeze({
    phase: 'celebration',
    lane: practice.lane,
    sourceKey: phrase.sourceKey,
    sourceSha256: phrase.sourceSha256,
    phraseTitle: phrase.title,
    cathedralClearedAt: journey.cathedralClear.clearedAt,
    // EAR recognition and VOICE production are intentionally separate facts.
    voiceEvidence: practice.lane === 'voice',
    earEvidence: practice.lane === 'ear',
  })
}

export function savePitchforksCathedralSongcraftFinale(
  state: PitchforksCathedralFinaleState,
): PitchforksCathedralFinaleState {
  return Object.freeze({ ...state, phase: 'saved' })
}

export function reopenPitchforksCathedralSongcraftFinale(
  state: PitchforksCathedralFinaleState,
): PitchforksCathedralFinaleState {
  return Object.freeze({ ...state, phase: 'return-practice' })
}

export function hasPitchforksCathedralVoiceEvidence(
  state: PitchforksCathedralFinaleState | null | undefined,
): boolean {
  return state?.voiceEvidence === true && state.earEvidence === false
}
