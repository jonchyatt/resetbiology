import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import {
  isSongcraftPhraseProvenance,
  normalizeComposerPhrase,
  SONGCRAFT_BUILTIN_LICENSE_ID,
  SONGCRAFT_BUILTIN_LICENSE_TEXT,
  SONGCRAFT_PHRASE_NORMALIZATION_VERSION,
  type SongcraftPhrase,
} from '../src/components/PitchDefender/pitchforksSongcraftPhrase'
import {
  loadSongcraftPresets,
  type SongcraftPresetDescriptor,
  type SongcraftPresetMetadata,
} from '../src/components/PitchDefender/pitchforksSongcraftPresets'

let checks = 0
const check = (run: () => void) => {
  run()
  checks += 1
}

function expectedHash(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex')
}

function keyFor(metadata: SongcraftPresetMetadata): string {
  return `builtin:practice:${metadata.packId}:${metadata.packVersion}:${metadata.presetId}`
}

function rawFor(metadata: SongcraftPresetMetadata, title = metadata.presetId): string {
  return JSON.stringify({
    title,
    songcraftPreset: metadata,
    notes: [
      { semitones: 0, pitchName: 'C4', beats: 1 },
      { isRest: true, beats: 0.5 },
      { semitones: 2, pitchName: 'D4', beats: 2 },
    ],
  })
}

function metadata(presetId: string): SongcraftPresetMetadata {
  return {
    packId: 'lantern-steps',
    packVersion: '1',
    presetId,
    author: 'Pitchforks III original practice',
    licenseId: SONGCRAFT_BUILTIN_LICENSE_ID,
    licenseText: SONGCRAFT_BUILTIN_LICENSE_TEXT,
    sourceReference: `project:pitchforks-iii/lantern-steps/1/${presetId}`,
  }
}

function descriptor(
  presetMetadata: SongcraftPresetMetadata,
  options: Partial<SongcraftPresetDescriptor> = {},
): SongcraftPresetDescriptor {
  const raw = options.raw ?? rawFor(presetMetadata)
  return {
    sourceKey: options.sourceKey ?? keyFor(presetMetadata),
    raw,
    expectedSha256: options.expectedSha256 ?? expectedHash(raw),
  }
}

function phraseOrThrow(value: SongcraftPhrase | undefined): SongcraftPhrase {
  if (!value) throw new Error('expected a loaded preset')
  return value
}

async function main(): Promise<void> {
  const composerProvenance = {
    source: 'composer',
    normalizationVersion: SONGCRAFT_PHRASE_NORMALIZATION_VERSION,
  }
  check(() => assert.equal(isSongcraftPhraseProvenance(composerProvenance), true))
  check(() => assert.equal(isSongcraftPhraseProvenance({ ...composerProvenance, normalizationVersion: 'old' }), false))
  check(() => assert.equal(isSongcraftPhraseProvenance({
    source: 'builtin',
    normalizationVersion: SONGCRAFT_PHRASE_NORMALIZATION_VERSION,
    ...metadata('guard-c4-d4'),
  }), true))
  check(() => assert.equal(isSongcraftPhraseProvenance({
    source: 'builtin',
    normalizationVersion: SONGCRAFT_PHRASE_NORMALIZATION_VERSION,
    ...metadata('guard-c4-d4'),
    licenseId: 'CC0',
  }), false))
  for (const invalidIdentity of [
    { ...metadata('guard-c4-d4'), packId: 'Lantern-steps' },
    { ...metadata('guard-c4-d4'), packId: 'lantern:steps' },
    { ...metadata('guard-c4-d4'), packId: 'lantern steps' },
    { ...metadata('guard-c4-d4'), packVersion: 'v1' },
    { ...metadata('guard-c4-d4'), presetId: 'Guard-C4-D4' },
  ]) {
    check(() => assert.equal(isSongcraftPhraseProvenance({
      source: 'builtin',
      normalizationVersion: SONGCRAFT_PHRASE_NORMALIZATION_VERSION,
      ...invalidIdentity,
    }), false))
  }
  check(() => assert.equal(isSongcraftPhraseProvenance(null), false))

  // The source object can be changed after JSON serialization, but the loaded
  // phrase must retain only the exact, validated metadata captured in `raw`.
  const mutableMetadata = metadata('lantern-steps-c4-d4-v1') as {
    packId: string
    packVersion: string
    presetId: string
    author: string
    licenseId: string
    licenseText: string
    sourceReference: string
  }
  const immutableRaw = rawFor(mutableMetadata, 'C4 D4 with a rest')
  const immutableDescriptor = descriptor(mutableMetadata, { raw: immutableRaw })
  mutableMetadata.author = 'caller mutation must not leak'
  const immutableResult = await loadSongcraftPresets([immutableDescriptor])
  const immutablePhrase = phraseOrThrow(immutableResult.phrases[0])

  check(() => assert.equal(immutablePhrase.sourceKey, keyFor({ ...mutableMetadata, author: 'caller mutation must not leak' })))
  check(() => assert.equal(immutablePhrase.title, 'C4 D4 with a rest'))
  check(() => assert.equal(immutablePhrase.sourceSha256, expectedHash(immutableRaw)))
  check(() => assert.deepEqual(immutablePhrase.occurrences.map(occurrence => ({
    isRest: occurrence.isRest,
    pitchName: occurrence.pitchName,
    semi: occurrence.semi,
    midi: occurrence.midi,
    beats: occurrence.beats,
  })), [
    { isRest: false, pitchName: 'C4', semi: 0, midi: 60, beats: 1 },
    { isRest: true, pitchName: null, semi: null, midi: null, beats: 0.5 },
    { isRest: false, pitchName: 'D4', semi: 2, midi: 62, beats: 2 },
  ]))
  check(() => assert.deepEqual(immutablePhrase.provenance, {
    source: 'builtin',
    normalizationVersion: SONGCRAFT_PHRASE_NORMALIZATION_VERSION,
    ...metadata('lantern-steps-c4-d4-v1'),
  }))
  check(() => assert.equal(Object.isFrozen(immutableResult), true))
  check(() => assert.equal(Object.isFrozen(immutableResult.phrases), true))
  check(() => assert.equal(Object.isFrozen(immutablePhrase), true))
  check(() => assert.equal(Object.isFrozen(immutablePhrase.provenance), true))
  check(() => assert.equal(Object.isFrozen(immutablePhrase.occurrences), true))
  check(() => assert.equal(Reflect.set(
    immutablePhrase.provenance as unknown as Record<string, unknown>,
    'author',
    'forged',
  ), false))
  check(() => assert.equal(immutablePhrase.provenance.author, 'Pitchforks III original practice'))

  const first = metadata('lantern-steps-c4-d4-v1')
  const last = metadata('lantern-steps-g4-a4-v1')
  const malformedMetadata = metadata('lantern-steps-malformed-v1')
  const malformedRaw = JSON.stringify({
    title: 'Malformed neighbor',
    songcraftPreset: malformedMetadata,
    notes: [{ pitchName: 'C4', beats: 1 }],
  })
  const unsupportedMetadata = {
    ...metadata('lantern-steps-unsupported-v1'),
    licenseId: 'Unknown-License',
  }
  const hashMetadata = metadata('lantern-steps-hash-v1')
  const keyMetadata = metadata('lantern-steps-key-v1')
  const duplicateMetadata = metadata('lantern-steps-duplicate-v1')

  const descriptors: readonly SongcraftPresetDescriptor[] = [
    descriptor(last),
    descriptor(duplicateMetadata),
    descriptor(malformedMetadata, { raw: malformedRaw }),
    descriptor(unsupportedMetadata),
    descriptor(hashMetadata, { expectedSha256: '0'.repeat(64) }),
    descriptor(keyMetadata, { sourceKey: 'builtin:practice:lantern-steps:1:forged-key-v1' }),
    descriptor(first),
    descriptor(duplicateMetadata),
  ]
  const loaded = await loadSongcraftPresets(descriptors)
  check(() => assert.deepEqual(loaded.phrases.map(phrase => phrase.sourceKey), [keyFor(first), keyFor(last)]))
  check(() => assert.deepEqual(loaded.rejections.map(item => [item.sourceKey, item.reason]), [
    ['builtin:practice:lantern-steps:1:forged-key-v1', 'key-mismatch'],
    [keyFor(duplicateMetadata), 'duplicate-key'],
    [keyFor(duplicateMetadata), 'duplicate-key'],
    [keyFor(hashMetadata), 'hash-mismatch'],
    [keyFor(malformedMetadata), 'malformed-source'],
    [keyFor(unsupportedMetadata), 'unsupported-license'],
  ]))
  check(() => assert.equal(loaded.phrases.every(phrase => phrase.provenance.source === 'builtin'), true))
  check(() => assert.equal(loaded.rejections.every(item => Object.isFrozen(item)), true))

  const invalidIdentityDescriptors = [
    descriptor({ ...metadata('lantern-steps-bad-pack'), packId: 'Lantern-steps' }),
    descriptor({ ...metadata('lantern-steps-bad-colon'), packId: 'lantern:steps' }),
    descriptor({ ...metadata('lantern-steps-bad-space'), packId: 'lantern steps' }),
    descriptor({ ...metadata('lantern-steps-bad-version'), packVersion: 'v1' }),
    descriptor({ ...metadata('lantern-steps-bad-preset'), presetId: 'Bad-Preset' }),
  ]
  const invalidIdentityResult = await loadSongcraftPresets(invalidIdentityDescriptors)
  check(() => assert.deepEqual(invalidIdentityResult.phrases, []))
  check(() => assert.deepEqual(invalidIdentityResult.rejections.map(item => item.reason), [
    'invalid-metadata',
    'invalid-metadata',
    'invalid-metadata',
    'invalid-metadata',
    'invalid-metadata',
  ]))

  // Input order does not affect the accepted/rejected result order.
  const reversed = await loadSongcraftPresets([...descriptors].reverse())
  check(() => assert.deepEqual(reversed.phrases.map(phrase => phrase.sourceKey), loaded.phrases.map(phrase => phrase.sourceKey)))
  check(() => assert.deepEqual(reversed.rejections.map(item => [item.sourceKey, item.reason]), loaded.rejections.map(item => [item.sourceKey, item.reason])))

  const adapterSource = readFileSync(
    new URL('../src/components/PitchDefender/pitchforksSongcraftPresets.ts', import.meta.url),
    'utf8',
  )
  check(() => assert.match(adapterSource, /normalizeComposerPhrase\(descriptor\.raw, descriptor\.sourceKey\)/))
  check(() => assert.doesNotMatch(adapterSource, /localStorage|\.setItem\(|\.removeItem\(|\.clear\(/))
  check(() => assert.doesNotMatch(adapterSource, /transpose|grade|newMusicParser/i))

  // A normal Composer source remains Composer-provenanced; the built-in
  // adapter adds provenance only to its own fresh envelope.
  const composerRaw = JSON.stringify({
    title: 'Existing Composer source',
    notes: [{ semitones: 0, pitchName: 'C4', beats: 1 }],
  })
  const composerPhrase = await normalizeComposerPhrase(composerRaw, 'pd_composed_protected')
  check(() => assert.ok(composerPhrase))
  check(() => assert.deepEqual(composerPhrase?.provenance, composerProvenance))
  check(() => assert.equal(isSongcraftPhraseProvenance(composerPhrase?.provenance), true))

  console.log(`pitchforks songcraft presets: ${checks}/${checks} PASS`)
}

void main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
