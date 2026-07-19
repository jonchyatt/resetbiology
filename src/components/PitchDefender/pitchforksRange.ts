import { noteToFreq } from './pitchMath'
import { KEYBOARD_ORDER } from './types'

export const PITCHFORKS_RANGE_PROFILE_KEY = 'pitchforks3_comfortable_range_v1'
export const PITCHFORKS_RANGE_PROFILE_VERSION = 1 as const
export const PITCHFORKS_RANGE_NOTES = [...KEYBOARD_ORDER] as readonly string[]

export type PitchforksRangeSource = 'guided' | 'manual'

export type PitchforksRangeProfile = Readonly<{
  version: typeof PITCHFORKS_RANGE_PROFILE_VERSION
  lowNote: string
  highNote: string
  anchorNote: string
  source: PitchforksRangeSource
  assessedAt: string
}>

type CreateRangeProfileArgs = Readonly<{
  lowNote: string
  highNote: string
  anchorNote?: string
  source: PitchforksRangeSource
  assessedAt?: string
}>

function noteIndex(note: string): number {
  return PITCHFORKS_RANGE_NOTES.indexOf(note)
}

export function nearestPitchforksRangeNote(frequency: number): string | null {
  if (!Number.isFinite(frequency) || frequency <= 0) return null

  let nearest: string | null = null
  let nearestDistance = Number.POSITIVE_INFINITY
  for (const note of PITCHFORKS_RANGE_NOTES) {
    const distance = Math.abs(1200 * Math.log2(frequency / noteToFreq(note)))
    if (distance < nearestDistance) {
      nearest = note
      nearestDistance = distance
    }
  }
  return nearest
}

export function createPitchforksRangeProfile(args: CreateRangeProfileArgs): PitchforksRangeProfile | null {
  const lowIndex = noteIndex(args.lowNote)
  const highIndex = noteIndex(args.highNote)
  if (lowIndex < 0 || highIndex < 0 || lowIndex >= highIndex) return null

  const requestedAnchorIndex = args.anchorNote ? noteIndex(args.anchorNote) : -1
  const anchorIndex = requestedAnchorIndex >= lowIndex && requestedAnchorIndex <= highIndex
    ? requestedAnchorIndex
    : Math.floor((lowIndex + highIndex) / 2)
  const assessedAt = args.assessedAt ?? new Date().toISOString()
  if (!Number.isFinite(Date.parse(assessedAt))) return null

  return {
    version: PITCHFORKS_RANGE_PROFILE_VERSION,
    lowNote: PITCHFORKS_RANGE_NOTES[lowIndex],
    highNote: PITCHFORKS_RANGE_NOTES[highIndex],
    anchorNote: PITCHFORKS_RANGE_NOTES[anchorIndex],
    source: args.source,
    assessedAt,
  }
}

export function parsePitchforksRangeProfile(raw: string | null): PitchforksRangeProfile | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<PitchforksRangeProfile>
    if (
      value.version !== PITCHFORKS_RANGE_PROFILE_VERSION ||
      (value.source !== 'guided' && value.source !== 'manual') ||
      typeof value.lowNote !== 'string' ||
      typeof value.highNote !== 'string' ||
      typeof value.anchorNote !== 'string' ||
      typeof value.assessedAt !== 'string'
    ) return null

    return createPitchforksRangeProfile({
      lowNote: value.lowNote,
      highNote: value.highNote,
      anchorNote: value.anchorNote,
      source: value.source,
      assessedAt: value.assessedAt,
    })
  } catch {
    return null
  }
}

export function starterPairForRange(profile: PitchforksRangeProfile): [string, string] {
  const lowIndex = noteIndex(profile.lowNote)
  const highIndex = noteIndex(profile.highNote)
  const anchorIndex = noteIndex(profile.anchorNote)
  let bestStart = lowIndex
  let bestDistance = Number.POSITIVE_INFINITY

  for (let index = lowIndex; index < highIndex; index++) {
    const midpoint = index + 0.5
    const distance = Math.abs(midpoint - anchorIndex)
    if (distance <= bestDistance) {
      bestStart = index
      bestDistance = distance
    }
  }

  return [PITCHFORKS_RANGE_NOTES[bestStart], PITCHFORKS_RANGE_NOTES[bestStart + 1]]
}

export function presentationOrderForRange(profile: PitchforksRangeProfile): string[] {
  const [first, second] = starterPairForRange(profile)
  const lowIndex = noteIndex(profile.lowNote)
  const highIndex = noteIndex(profile.highNote)
  const anchorIndex = noteIndex(profile.anchorNote)
  let unlockedLow = noteIndex(first)
  let unlockedHigh = noteIndex(second)
  const order = [first, second]

  while (unlockedLow > lowIndex || unlockedHigh < highIndex) {
    const lowerCandidate = unlockedLow > lowIndex ? unlockedLow - 1 : null
    const higherCandidate = unlockedHigh < highIndex ? unlockedHigh + 1 : null
    if (lowerCandidate === null && higherCandidate === null) break

    if (
      lowerCandidate !== null &&
      (higherCandidate === null || Math.abs(lowerCandidate - anchorIndex) < Math.abs(higherCandidate - anchorIndex))
    ) {
      unlockedLow = lowerCandidate
      order.push(PITCHFORKS_RANGE_NOTES[lowerCandidate])
    } else if (higherCandidate !== null) {
      unlockedHigh = higherCandidate
      order.push(PITCHFORKS_RANGE_NOTES[higherCandidate])
    }
  }

  return order
}

export function adjacentRangeNote(note: string, direction: 'lower' | 'higher'): string | null {
  const index = noteIndex(note)
  if (index < 0) return null
  const nextIndex = direction === 'lower' ? index - 1 : index + 1
  return PITCHFORKS_RANGE_NOTES[nextIndex] ?? null
}

export function isNoteInsideRange(note: string, profile: PitchforksRangeProfile): boolean {
  const index = noteIndex(note)
  return index >= noteIndex(profile.lowNote) && index <= noteIndex(profile.highNote)
}
