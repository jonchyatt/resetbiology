import { extractMelodyFromComposition, type ExtractedNote } from './composerExtract'

/**
 * Version the read-side shape independently of Composer's storage format. A
 * future adapter can add a new version without changing the meaning of an
 * already captured phrase.
 */
export const SONGCRAFT_PHRASE_NORMALIZATION_VERSION = 'songcraft-phrase/1' as const

export type SongcraftPhraseNormalizationVersion =
  typeof SONGCRAFT_PHRASE_NORMALIZATION_VERSION

export interface SongcraftPhraseOccurrence {
  readonly ordinal: number
  readonly isRest: boolean
  /** Semitones from C4; null keeps a rest from acquiring a pitch identity. */
  readonly semi: number | null
  readonly pitchName: string | null
  readonly octave: number | null
  /** MIDI is deliberately not clamped: authored out-of-range octaves remain exact. */
  readonly midi: number | null
  readonly beats: number
  readonly measureIdx: number
  readonly beatOffset: number
  readonly lyric?: string
}

export const SONGCRAFT_BUILTIN_LICENSE_ID = 'LicenseRef-Pitchforks-Original-Bundled-Use' as const
export const SONGCRAFT_BUILTIN_LICENSE_TEXT = 'Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.' as const

export interface SongcraftComposerPhraseProvenance {
  readonly source: 'composer'
  readonly normalizationVersion: SongcraftPhraseNormalizationVersion
}

export interface SongcraftBuiltinPhraseProvenance {
  readonly source: 'builtin'
  readonly normalizationVersion: SongcraftPhraseNormalizationVersion
  readonly packId: string
  readonly packVersion: string
  readonly presetId: string
  readonly author: string
  readonly licenseId: string
  readonly licenseText: string
  readonly sourceReference: string
}

export type SongcraftPhraseProvenance =
  | SongcraftComposerPhraseProvenance
  | SongcraftBuiltinPhraseProvenance

export interface SongcraftPhrase {
  readonly sourceKey: string
  readonly title: string
  /** SHA-256 of the exact UTF-8 source string supplied to the parser. */
  readonly sourceSha256: string
  /** Composer-authored tempo when it is an integer Tempo Encore can play. */
  readonly sourceTempoBpm?: number
  readonly provenance: SongcraftPhraseProvenance
  readonly occurrences: readonly SongcraftPhraseOccurrence[]
}

/** The adapter only needs these three read operations and cannot write storage. */
export type SongcraftPhraseStorage = Pick<Storage, 'length' | 'key' | 'getItem'>

const COMPOSER_KEYS = /^(?:[a-g])(?:#|b)?\/-?\d+$/i
const PITCH_NAME = /^(?:[A-G])(?:#{1,2}|b{1,2})?-?\d+$/
// Composer records an explicit natural as `n`; the canonical extractor owns
// its pitch semantics (which are the same as no accidental adjustment).
const VALID_ACCIDENTALS = new Set(['', '#', 'b', 'n', '##', 'bb'])
const VALID_DURATIONS = new Set(['w', 'h', 'q', '8', '16', '32'])
const BUILTIN_ID_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const BUILTIN_VERSION = /^\d+(?:\.\d+)*$/

interface ComposerSourceShape {
  readonly format: 'measures' | 'legacy'
  readonly eventCount: number
  readonly events: readonly Record<string, unknown>[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Guard the provenance boundary before a phrase can be used for practice.
 * Composer phrases carry only the current normalization version. Built-ins
 * must carry the complete, product-scoped source and license passport; the
 * license text is intentionally exact so an unknown or altered grant cannot
 * be treated as approved bundled content.
 */
export function isSongcraftPhraseProvenance(
  value: unknown,
): value is SongcraftPhraseProvenance {
  try {
    if (!isRecord(value) || value.normalizationVersion !== SONGCRAFT_PHRASE_NORMALIZATION_VERSION) {
      return false
    }
    if (value.source === 'composer') return true
    if (value.source !== 'builtin') return false

    return isNonEmptyString(value.packId)
      && BUILTIN_ID_SEGMENT.test(value.packId)
      && isNonEmptyString(value.packVersion)
      && BUILTIN_VERSION.test(value.packVersion)
      && isNonEmptyString(value.presetId)
      && BUILTIN_ID_SEGMENT.test(value.presetId)
      && isNonEmptyString(value.author)
      && value.licenseId === SONGCRAFT_BUILTIN_LICENSE_ID
      && value.licenseText === SONGCRAFT_BUILTIN_LICENSE_TEXT
      && isNonEmptyString(value.sourceReference)
  } catch {
    return false
  }
}

function isFinitePositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value)
}

function validPitchKey(value: unknown): value is string {
  if (typeof value !== 'string' || !COMPOSER_KEYS.test(value)) return false
  const octaveText = value.slice(value.lastIndexOf('/') + 1)
  return Number.isSafeInteger(Number(octaveText))
}

function validCurrentEvent(event: Record<string, unknown>): boolean {
  if (!VALID_DURATIONS.has(event.duration as string)) return false
  if (event.dotted !== undefined && typeof event.dotted !== 'boolean') return false
  if (event.tripletGroup !== undefined && event.tripletGroup !== null
    && !isSafeInteger(event.tripletGroup)) return false
  if (event.isRest !== undefined && typeof event.isRest !== 'boolean') return false
  if (event.lyric !== undefined && typeof event.lyric !== 'string') return false

  const keys = event.keys
  if (keys !== undefined) {
    if (!Array.isArray(keys) || !keys.every(validPitchKey)) return false
  }
  const accidentals = event.accidentals
  if (accidentals !== undefined) {
    if (!Array.isArray(accidentals) || !accidentals.every(value => (
      typeof value === 'string' && VALID_ACCIDENTALS.has(value)
    ))) return false
    if (Array.isArray(keys) && accidentals.length > keys.length) return false
  }

  // Composer's extractor silently omits a non-rest event without keys. Reject
  // it here so a malformed source can never masquerade as a complete phrase.
  if (event.isRest !== true && (!Array.isArray(keys) || keys.length === 0)) return false
  return true
}

function pitchNameToMidi(pitchName: string): number | null {
  const match = pitchName.match(/^([A-G])((?:#{1,2}|b{1,2})?)(-?\d+)$/)
  if (!match) return null
  const baseSemi: Record<string, number> = {
    C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
  }
  const octave = Number(match[3])
  if (!Number.isSafeInteger(octave)) return null
  let semi = (baseSemi[match[1]] ?? 0) + (octave - 4) * 12
  const accidental = match[2]
  if (accidental === '#') semi += 1
  if (accidental === '##') semi += 2
  if (accidental === 'b') semi -= 1
  if (accidental === 'bb') semi -= 2
  const midi = 60 + semi
  return Number.isSafeInteger(midi) ? midi : null
}

function validLegacyEvent(event: Record<string, unknown>): boolean {
  if (!isFinitePositiveNumber(event.beats)) return false
  if (event.isRest !== undefined && typeof event.isRest !== 'boolean') return false
  if (event.lyric !== undefined && typeof event.lyric !== 'string') return false
  if (event.isRest === true) return true

  // The legacy extractor defaults missing semitones to C4. Semitones are
  // therefore always required, while pitchName is optional in the vocal
  // trainer producer and is derived by the canonical extractor when absent.
  if (!isSafeInteger(event.semitones)) return false
  if (event.pitchName === undefined) return true
  if (typeof event.pitchName !== 'string' || !PITCH_NAME.test(event.pitchName)) return false
  const pitchMidi = pitchNameToMidi(event.pitchName)
  return pitchMidi !== null && pitchMidi === 60 + event.semitones
}

function inspectComposerSource(comp: unknown): ComposerSourceShape | null {
  if (!isRecord(comp)) return null

  if (Array.isArray(comp.measures)) {
    const events: Record<string, unknown>[] = []
    for (const measure of comp.measures) {
      if (!isRecord(measure) || !Array.isArray(measure.notes)) return null
      for (const event of measure.notes) {
        if (!isRecord(event) || !validCurrentEvent(event)) return null
        events.push(event)
      }
    }
    // An empty phrase is not a playable/readable source. A rest-only phrase is
    // valid: it retains an explicit untimed occurrence for the next leaf.
    return events.length > 0 ? { format: 'measures', eventCount: events.length, events } : null
  }

  if (Array.isArray(comp.notes)) {
    const events: Record<string, unknown>[] = []
    for (const event of comp.notes) {
      if (!isRecord(event) || !validLegacyEvent(event)) return null
      events.push(event)
    }
    return events.length > 0 ? { format: 'legacy', eventCount: events.length, events } : null
  }

  return null
}

function validExtraction(
  extracted: readonly ExtractedNote[],
  shape: ComposerSourceShape,
): boolean {
  if (extracted.length !== shape.eventCount) return false
  for (let index = 0; index < extracted.length; index += 1) {
    const note = extracted[index]
    const source = shape.events[index]
    if (!Number.isSafeInteger(note.measureIdx) || note.measureIdx < 1) return false
    if (!Number.isFinite(note.beats) || note.beats <= 0) return false
    if (!Number.isFinite(note.beatOffset) || note.beatOffset < 0) return false
    if (note.isRest !== (source.isRest === true)) return false

    if (note.isRest) {
      // The legacy extractor supplies a meaningless C4/0 placeholder for a
      // rest, while the current extractor supplies an empty name/0. Both are
      // discarded by occurrenceFromNote; only the rest identity matters.
      continue
    }

    if (!Number.isSafeInteger(note.semi) || typeof note.pitchName !== 'string') return false
    if (!PITCH_NAME.test(note.pitchName)) return false
    if (shape.format === 'legacy') {
      if (note.semi !== source.semitones) return false
      if (source.pitchName !== undefined && note.pitchName !== source.pitchName) return false
    }
  }
  return true
}

function occurrenceFromNote(note: ExtractedNote, ordinal: number): SongcraftPhraseOccurrence {
  if (note.isRest) {
    return Object.freeze({
      ordinal,
      isRest: true,
      semi: null,
      pitchName: null,
      octave: null,
      midi: null,
      beats: note.beats,
      measureIdx: note.measureIdx,
      beatOffset: note.beatOffset,
      ...(note.lyric === undefined ? {} : { lyric: note.lyric }),
    })
  }

  const pitchName = note.pitchName
  const octaveMatch = pitchName.match(/(-?\d+)$/)
  const octave = octaveMatch ? Number(octaveMatch[1]) : null
  const midi = note.semi + 60
  return Object.freeze({
    ordinal,
    isRest: false,
    semi: note.semi,
    pitchName,
    octave: Number.isSafeInteger(octave) ? octave : null,
    midi: Number.isSafeInteger(midi) ? midi : null,
    beats: note.beats,
    measureIdx: note.measureIdx,
    beatOffset: note.beatOffset,
    ...(note.lyric === undefined ? {} : { lyric: note.lyric }),
  })
}

async function sha256Hex(raw: string): Promise<string> {
  const bytes = new TextEncoder().encode(raw)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Parse and normalize one exact Composer source. `null` means the source is
 * malformed, empty, internally inconsistent, or cannot be hashed; no
 * fallback pitch or transposed note is returned.
 */
export async function normalizeComposerPhrase(
  raw: string,
  sourceKey: string,
): Promise<SongcraftPhrase | null> {
  if (typeof raw !== 'string' || raw.length === 0 || typeof sourceKey !== 'string' || sourceKey.length === 0) {
    return null
  }

  let comp: unknown
  try {
    comp = JSON.parse(raw)
  } catch {
    return null
  }

  const shape = inspectComposerSource(comp)
  if (!shape) return null

  let extracted: ExtractedNote[]
  try {
    // One canonical parser call; rests are retained for the normalized envelope.
    extracted = extractMelodyFromComposition(comp, { skipRests: false })
  } catch {
    return null
  }
  if (!validExtraction(extracted, shape)) return null

  let sourceSha256: string
  try {
    sourceSha256 = await sha256Hex(raw)
  } catch {
    return null
  }

  const title = isRecord(comp) && typeof comp.title === 'string' && comp.title.trim().length > 0
    ? comp.title
    : 'Untitled'
  const sourceTempoBpm = isRecord(comp) && Number.isSafeInteger(comp.tempoBpm)
    && (comp.tempoBpm as number) >= 30 && (comp.tempoBpm as number) <= 180
    ? comp.tempoBpm as number
    : undefined
  const occurrences = Object.freeze(extracted.map(occurrenceFromNote))
  const provenance = Object.freeze({
    source: 'composer' as const,
    normalizationVersion: SONGCRAFT_PHRASE_NORMALIZATION_VERSION,
  })
  return Object.freeze({
    sourceKey,
    title,
    sourceSha256,
    ...(sourceTempoBpm === undefined ? {} : { sourceTempoBpm }),
    provenance,
    occurrences,
  })
}

function compareKeys(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

/**
 * Read `pd_composed_*` sources in deterministic key order. A failing storage
 * length yields an empty result; a failing key or neighbor read only excludes
 * that entry. This function has no storage write/delete/clear path.
 */
export async function loadSongcraftPhrases(
  storage: SongcraftPhraseStorage,
): Promise<readonly SongcraftPhrase[]> {
  let length: number
  try {
    length = storage.length
  } catch {
    return Object.freeze([])
  }
  if (!Number.isSafeInteger(length) || length < 0) return Object.freeze([])

  const keys = new Set<string>()
  for (let index = 0; index < length; index += 1) {
    try {
      const key = storage.key(index)
      if (typeof key === 'string' && key.startsWith('pd_composed_')) keys.add(key)
    } catch {
      // One broken storage slot must not hide healthy Composer neighbors.
    }
  }

  const phrases: SongcraftPhrase[] = []
  for (const key of [...keys].sort(compareKeys)) {
    let raw: string | null
    try {
      raw = storage.getItem(key)
    } catch {
      continue
    }
    if (typeof raw !== 'string') continue
    const phrase = await normalizeComposerPhrase(raw, key)
    if (phrase) phrases.push(phrase)
  }
  return Object.freeze(phrases)
}
