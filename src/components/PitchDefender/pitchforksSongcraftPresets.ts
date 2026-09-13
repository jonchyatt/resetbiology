import {
  isSongcraftPhraseProvenance,
  normalizeComposerPhrase,
  SONGCRAFT_BUILTIN_LICENSE_ID,
  SONGCRAFT_BUILTIN_LICENSE_TEXT,
  SONGCRAFT_PHRASE_NORMALIZATION_VERSION,
  type SongcraftBuiltinPhraseProvenance,
  type SongcraftPhrase,
} from './pitchforksSongcraftPhrase'

/** The checked-in identity and exact source bytes for one bundled exercise. */
export interface SongcraftPresetDescriptor {
  readonly sourceKey: string
  readonly raw: string
  readonly expectedSha256: string
}

/** The metadata passport embedded in a preset's exact source JSON. */
export interface SongcraftPresetMetadata {
  readonly packId: string
  readonly packVersion: string
  readonly presetId: string
  readonly author: string
  readonly licenseId: string
  readonly licenseText: string
  readonly sourceReference: string
}

export type SongcraftPresetRejectionReason =
  | 'invalid-descriptor'
  | 'malformed-source'
  | 'invalid-metadata'
  | 'unsupported-license'
  | 'key-mismatch'
  | 'hash-mismatch'
  | 'duplicate-key'

export interface SongcraftPresetRejection {
  readonly sourceKey: string | null
  readonly reason: SongcraftPresetRejectionReason
  readonly message: string
}

export interface SongcraftPresetLoadResult {
  readonly phrases: readonly SongcraftPhrase[]
  readonly rejections: readonly SongcraftPresetRejection[]
}

/** Alias retained for callers that name the operation before its result. */
export type SongcraftPresetsLoadResult = SongcraftPresetLoadResult

interface ParsedPresetSource {
  readonly metadata: SongcraftPresetMetadata
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim() === value
}

function compareKeys(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function sourceKeyFor(metadata: SongcraftPresetMetadata): string {
  return `builtin:practice:${metadata.packId}:${metadata.packVersion}:${metadata.presetId}`
}

function safeSourceKey(value: unknown): string | null {
  try {
    return isRecord(value) && typeof value.sourceKey === 'string' ? value.sourceKey : null
  } catch {
    return null
  }
}

function rejection(
  sourceKey: string | null,
  reason: SongcraftPresetRejectionReason,
  message: string,
): SongcraftPresetRejection {
  return Object.freeze({ sourceKey, reason, message })
}

function parsePresetSource(raw: string):
  | { readonly ok: true; readonly source: ParsedPresetSource }
  | { readonly ok: false; readonly reason: 'malformed-source' | 'invalid-metadata'; readonly message: string } {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return { ok: false, reason: 'malformed-source', message: 'Preset source is not valid JSON.' }
  }

  if (!isRecord(value)) {
    return { ok: false, reason: 'malformed-source', message: 'Preset source must be a JSON object.' }
  }

  const metadata = value.songcraftPreset
  if (!isRecord(metadata)) {
    return { ok: false, reason: 'invalid-metadata', message: 'Preset source is missing songcraftPreset metadata.' }
  }

  if (!isNonEmptyString(metadata.packId)
    || !isNonEmptyString(metadata.packVersion)
    || !isNonEmptyString(metadata.presetId)
    || !isNonEmptyString(metadata.author)
    || !isNonEmptyString(metadata.licenseId)
    || !isNonEmptyString(metadata.licenseText)
    || !isNonEmptyString(metadata.sourceReference)) {
    return { ok: false, reason: 'invalid-metadata', message: 'Preset metadata is missing a required field.' }
  }

  return {
    ok: true,
    source: {
      metadata: {
        packId: metadata.packId,
        packVersion: metadata.packVersion,
        presetId: metadata.presetId,
        author: metadata.author,
        licenseId: metadata.licenseId,
        licenseText: metadata.licenseText,
        sourceReference: metadata.sourceReference,
      },
    },
  }
}

function builtinProvenance(metadata: SongcraftPresetMetadata): SongcraftBuiltinPhraseProvenance {
  return Object.freeze({
    source: 'builtin' as const,
    normalizationVersion: SONGCRAFT_PHRASE_NORMALIZATION_VERSION,
    packId: metadata.packId,
    packVersion: metadata.packVersion,
    presetId: metadata.presetId,
    author: metadata.author,
    licenseId: metadata.licenseId,
    licenseText: metadata.licenseText,
    sourceReference: metadata.sourceReference,
  })
}

function frozenResult(
  phrases: readonly SongcraftPhrase[],
  rejections: readonly SongcraftPresetRejection[],
): SongcraftPresetLoadResult {
  return Object.freeze({
    phrases: Object.freeze([...phrases]),
    rejections: Object.freeze([...rejections]),
  })
}

/**
 * Validate and normalize checked-in built-ins through Composer's existing
 * parser. The adapter reads exact source strings only; it owns no storage,
 * grading, admission, or transposition policy.
 */
export async function loadSongcraftPresets(
  descriptors: readonly SongcraftPresetDescriptor[],
): Promise<SongcraftPresetLoadResult> {
  if (!Array.isArray(descriptors)) {
    return frozenResult([], [rejection(null, 'invalid-descriptor', 'Preset descriptors must be an array.')])
  }

  const ordered = descriptors
    .map((descriptor, index) => ({ descriptor: descriptor as unknown, index }))
    .sort((left, right) => {
      const leftKey = safeSourceKey(left.descriptor) ?? ''
      const rightKey = safeSourceKey(right.descriptor) ?? ''
      return compareKeys(leftKey, rightKey) || left.index - right.index
    })

  const keyCounts = new Map<string, number>()
  for (const entry of ordered) {
    const sourceKey = safeSourceKey(entry.descriptor)
    if (sourceKey !== null) keyCounts.set(sourceKey, (keyCounts.get(sourceKey) ?? 0) + 1)
  }

  const phrases: SongcraftPhrase[] = []
  const rejections: SongcraftPresetRejection[] = []

  for (const entry of ordered) {
    const sourceKey = safeSourceKey(entry.descriptor)
    let descriptor: SongcraftPresetDescriptor
    try {
      if (!isRecord(entry.descriptor)
        || typeof entry.descriptor.sourceKey !== 'string'
        || typeof entry.descriptor.raw !== 'string'
        || typeof entry.descriptor.expectedSha256 !== 'string'
        || entry.descriptor.raw.length === 0
        || !/^[a-f0-9]{64}$/i.test(entry.descriptor.expectedSha256)) {
        rejections.push(rejection(sourceKey, 'invalid-descriptor', 'Preset descriptor must contain sourceKey, raw, and a 64-character SHA-256 pin.'))
        continue
      }
      descriptor = {
        sourceKey: entry.descriptor.sourceKey,
        raw: entry.descriptor.raw,
        expectedSha256: entry.descriptor.expectedSha256,
      }
    } catch {
      rejections.push(rejection(sourceKey, 'invalid-descriptor', 'Preset descriptor could not be read.'))
      continue
    }

    if ((keyCounts.get(descriptor.sourceKey) ?? 0) > 1) {
      rejections.push(rejection(descriptor.sourceKey, 'duplicate-key', 'Preset sourceKey is duplicated.'))
      continue
    }

    const parsed = parsePresetSource(descriptor.raw)
    if (!parsed.ok) {
      rejections.push(rejection(descriptor.sourceKey, parsed.reason, parsed.message))
      continue
    }
    const metadata = parsed.source.metadata

    if (metadata.licenseId !== SONGCRAFT_BUILTIN_LICENSE_ID
      || metadata.licenseText !== SONGCRAFT_BUILTIN_LICENSE_TEXT) {
      rejections.push(rejection(descriptor.sourceKey, 'unsupported-license', 'Preset license is not the approved bundled-use license.'))
      continue
    }

    // Keep identity-segment rules in one place with the phrase trust-boundary
    // guard. In particular, a colon or whitespace cannot create an ambiguous
    // namespaced key by being smuggled into packId or presetId.
    if (!isSongcraftPhraseProvenance({
      source: 'builtin',
      normalizationVersion: SONGCRAFT_PHRASE_NORMALIZATION_VERSION,
      ...metadata,
    })) {
      rejections.push(rejection(descriptor.sourceKey, 'invalid-metadata', 'Preset identity metadata is malformed.'))
      continue
    }

    const expectedSourceKey = sourceKeyFor(metadata)
    if (descriptor.sourceKey !== expectedSourceKey) {
      rejections.push(rejection(descriptor.sourceKey, 'key-mismatch', `Preset sourceKey must be ${expectedSourceKey}.`))
      continue
    }

    let normalized: SongcraftPhrase | null
    try {
      normalized = await normalizeComposerPhrase(descriptor.raw, descriptor.sourceKey)
    } catch {
      normalized = null
    }
    if (!normalized) {
      rejections.push(rejection(descriptor.sourceKey, 'malformed-source', 'Preset notes are not a valid Composer phrase.'))
      continue
    }

    if (normalized.sourceSha256.toLowerCase() !== descriptor.expectedSha256.toLowerCase()) {
      rejections.push(rejection(descriptor.sourceKey, 'hash-mismatch', 'Preset source hash does not match its pinned SHA-256.'))
      continue
    }

    // normalizeComposerPhrase intentionally stays Composer-provenanced. This
    // fresh envelope records the validated built-in passport without mutating
    // or relabelling the existing normalizer's result in place.
    phrases.push(Object.freeze({
      ...normalized,
      provenance: builtinProvenance(metadata),
    }))
  }

  return frozenResult(phrases, rejections)
}
