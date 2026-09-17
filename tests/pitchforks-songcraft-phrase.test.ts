import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import {
  loadSongcraftPhrases,
  normalizeComposerPhrase,
  SONGCRAFT_PHRASE_NORMALIZATION_VERSION,
  type SongcraftPhrase,
  type SongcraftPhraseStorage,
} from '../src/components/PitchDefender/pitchforksSongcraftPhrase'

let checks = 0
const check = (run: () => void) => { run(); checks += 1 }

function expectedHash(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex')
}

function currentRaw(title = 'Octave and Rest', tempo = 96): string {
  return JSON.stringify({
    title,
    tempoBpm: tempo,
    measures: [
      {
        notes: [
          { keys: ['c/-1'], accidentals: [''], duration: 'q', dotted: false },
          { keys: ['c/4', 'e/4'], accidentals: ['n', ''], duration: '8' },
          { isRest: true, duration: 'h', dotted: true },
          { keys: ['g#/6'], duration: 'q' },
          { keys: ['c/-1'], duration: 'q' },
        ],
      },
      { notes: [{ keys: ['f/5'], duration: '16', tripletGroup: 7 }] },
    ],
  })
}

function legacyRaw(title = 'Legacy Octaves'): string {
  return JSON.stringify({
    title,
    notes: [
      { semitones: -12, pitchName: 'C3', beats: 1 },
      { isRest: true, beats: 2 },
      { semitones: 31, pitchName: 'G6', beats: 0.5 },
      { semitones: -12, pitchName: 'C3', beats: 1 },
    ],
  })
}

// Actual extractNotesFromAudio.publishToSynthesia output: semitones and beats
// only, with the canonical extractor deriving the scientific pitch name.
function producerLegacyRaw(): string {
  return JSON.stringify({
    title: 'Vocal Trainer Producer',
    notes: [
      { semitones: -12, beats: 1 },
      { isRest: true, beats: 2 },
      { semitones: 31, beats: 0.5 },
      { semitones: -12, beats: 1 },
    ],
  })
}

interface StorageOptions {
  readonly throwGetItemKeys?: ReadonlySet<string>
  readonly throwKeyIndexes?: ReadonlySet<number>
  readonly throwOnLength?: boolean
}

function makeStorage(
  entries: readonly (readonly [string, string])[],
  options: StorageOptions = {},
) {
  const values = new Map(entries)
  let setItemCalls = 0
  let removeItemCalls = 0
  let clearCalls = 0
  const storage: SongcraftPhraseStorage = {
    get length() {
      if (options.throwOnLength) throw new Error('storage length unavailable')
      return values.size
    },
    key(index) {
      if (options.throwKeyIndexes?.has(index)) throw new Error(`key failed: ${index}`)
      return [...values.keys()][index] ?? null
    },
    getItem(key) {
      if (options.throwGetItemKeys?.has(key)) throw new Error(`read failed: ${key}`)
      return values.get(key) ?? null
    },
  }
  return {
    storage,
    values,
    setItem: () => { setItemCalls += 1 },
    removeItem: () => { removeItemCalls += 1 },
    clear: () => { clearCalls += 1 },
    writes: () => ({ setItemCalls, removeItemCalls, clearCalls }),
  }
}

function phraseOrThrow(value: SongcraftPhrase | null): SongcraftPhrase {
  if (!value) throw new Error('expected a normalized phrase')
  return value
}

async function main() {
  const currentSource = currentRaw()
  const current = phraseOrThrow(await normalizeComposerPhrase(currentSource, 'pd_composed_current'))

  check(() => assert.equal(current.sourceKey, 'pd_composed_current'))
  check(() => assert.equal(current.title, 'Octave and Rest'))
  check(() => assert.equal(current.sourceTempoBpm, 96))
  check(() => assert.equal(current.sourceSha256, expectedHash(currentSource)))
  check(() => assert.deepEqual(current.provenance, {
    source: 'composer',
    normalizationVersion: SONGCRAFT_PHRASE_NORMALIZATION_VERSION,
  }))
  check(() => assert.equal(current.occurrences.length, 6))
  check(() => assert.deepEqual(current.occurrences.map(note => note.ordinal), [0, 1, 2, 3, 4, 5]))
  check(() => assert.deepEqual(current.occurrences.map(note => note.pitchName), [
    'C-1', 'E4', null, 'G#6', 'C-1', 'F5',
  ]))
  check(() => assert.deepEqual(current.occurrences.map(note => note.semi), [-60, 4, null, 32, -60, 17]))
  check(() => assert.deepEqual(current.occurrences.map(note => note.octave), [-1, 4, null, 6, -1, 5]))
  check(() => assert.deepEqual(current.occurrences.map(note => note.midi), [0, 64, null, 92, 0, 77]))
  check(() => assert.deepEqual(current.occurrences.map(note => note.isRest), [false, false, true, false, false, false]))
  check(() => assert.deepEqual(current.occurrences.map(note => note.beats), [1, 0.5, 3, 1, 1, 1 / 6]))
  check(() => assert.deepEqual(current.occurrences.map(note => note.measureIdx), [1, 1, 1, 1, 1, 2]))
  check(() => assert.deepEqual(current.occurrences.map(note => note.beatOffset), [0, 1, 1.5, 4.5, 5.5, 6.5]))
  check(() => assert.equal(current.occurrences[2]?.pitchName, null))
  check(() => assert.equal(current.occurrences[2]?.midi, null))
  check(() => assert.equal(current.occurrences[0]?.midi, 0))
  check(() => assert.equal(current.occurrences[3]?.midi, 92))
  check(() => assert.deepEqual(
    [current.occurrences[0]?.pitchName, current.occurrences[0]?.midi],
    [current.occurrences[4]?.pitchName, current.occurrences[4]?.midi],
  ))
  check(() => assert.equal(Object.isFrozen(current), true))
  check(() => assert.equal(Object.isFrozen(current.provenance), true))
  check(() => assert.equal(Object.isFrozen(current.occurrences), true))
  check(() => assert.equal(Object.isFrozen(current.occurrences[0]), true))

  const repeated = phraseOrThrow(await normalizeComposerPhrase(currentSource, 'pd_composed_current'))
  check(() => assert.deepEqual(repeated, current))

  const legacySource = legacyRaw()
  const legacy = phraseOrThrow(await normalizeComposerPhrase(legacySource, 'pd_composed_legacy'))
  check(() => assert.equal(legacy.title, 'Legacy Octaves'))
  check(() => assert.equal(legacy.sourceSha256, expectedHash(legacySource)))
  check(() => assert.deepEqual(legacy.occurrences.map(note => note.pitchName), ['C3', null, 'G6', 'C3']))
  check(() => assert.deepEqual(legacy.occurrences.map(note => note.semi), [-12, null, 31, -12]))
  check(() => assert.deepEqual(legacy.occurrences.map(note => note.octave), [3, null, 6, 3]))
  check(() => assert.deepEqual(legacy.occurrences.map(note => note.midi), [48, null, 91, 48]))
  check(() => assert.deepEqual(legacy.occurrences.map(note => note.beats), [1, 2, 0.5, 1]))
  check(() => assert.deepEqual(legacy.occurrences.map(note => note.beatOffset), [0, 1, 3, 3.5]))

  const producerSource = producerLegacyRaw()
  const producerPhrase = phraseOrThrow(await normalizeComposerPhrase(producerSource, 'pd_composed_vocal_trainer'))
  check(() => assert.equal(producerPhrase.sourceSha256, expectedHash(producerSource)))
  check(() => assert.deepEqual(producerPhrase.occurrences.map(note => note.pitchName), ['C3', null, 'G6', 'C3']))
  check(() => assert.deepEqual(producerPhrase.occurrences.map(note => note.midi), [48, null, 91, 48]))
  check(() => assert.deepEqual(producerPhrase.occurrences.map(note => note.beatOffset), [0, 1, 3, 3.5]))
  const producerRepeat = phraseOrThrow(await normalizeComposerPhrase(producerSource, 'pd_composed_vocal_trainer'))
  check(() => assert.deepEqual(producerRepeat, producerPhrase))

  const restOnly = phraseOrThrow(await normalizeComposerPhrase(
    JSON.stringify({ title: 'Untimed Silence', measures: [{ notes: [{ isRest: true, duration: 'q' }] }] }),
    'pd_composed_rest_only',
  ))
  check(() => assert.equal(restOnly.occurrences.length, 1))
  check(() => assert.equal(restOnly.occurrences[0]?.isRest, true))
  check(() => assert.equal(restOnly.occurrences[0]?.pitchName, null))
  check(() => assert.equal(restOnly.occurrences[0]?.midi, null))
  const emptyPhrase = await normalizeComposerPhrase(
    JSON.stringify({ title: 'Empty', measures: [{ notes: [] }] }),
    'pd_composed_empty',
  )
  check(() => assert.equal(emptyPhrase, null))

  const metadataSource = currentRaw('Octave and Rest', 120)
  const metadataPhrase = phraseOrThrow(await normalizeComposerPhrase(metadataSource, 'pd_composed_current'))
  check(() => assert.notEqual(metadataPhrase.sourceSha256, current.sourceSha256))
  check(() => assert.equal(metadataPhrase.sourceSha256, expectedHash(metadataSource)))
  check(() => assert.deepEqual(metadataPhrase.occurrences, current.occurrences))
  check(() => assert.equal(metadataPhrase.sourceTempoBpm, 120))

  for (const tempoBpm of [undefined, 29, 181, 96.5, '96']) {
    const source = JSON.stringify({
      title: 'Invalid tempo',
      ...(tempoBpm === undefined ? {} : { tempoBpm }),
      measures: [{ notes: [{ keys: ['c/4'], duration: 'q' }] }],
    })
    const phrase = phraseOrThrow(await normalizeComposerPhrase(source, 'pd_composed_invalid_tempo'))
    check(() => assert.equal(phrase.sourceTempoBpm, undefined))
    check(() => assert.equal(phrase.sourceSha256, expectedHash(source)))
  }

  const whitespaceSource = `${JSON.stringify(JSON.parse(currentSource), null, 2)}\n`
  const whitespacePhrase = phraseOrThrow(await normalizeComposerPhrase(whitespaceSource, 'pd_composed_current'))
  check(() => assert.notEqual(whitespacePhrase.sourceSha256, current.sourceSha256))
  check(() => assert.equal(whitespacePhrase.sourceSha256, expectedHash(whitespaceSource)))
  check(() => assert.deepEqual(whitespacePhrase.occurrences, current.occurrences))

  const malformedSources: readonly [string, string][] = [
    ['invalid Vex key', JSON.stringify({ measures: [{ notes: [{ keys: ['h/4'], duration: 'q' }] }] })],
    ['missing current keys', JSON.stringify({ measures: [{ notes: [{ duration: 'q' }] }] })],
    ['invalid duration', JSON.stringify({ measures: [{ notes: [{ keys: ['c/4'], duration: '64' }] }] })],
    ['missing legacy semitones', JSON.stringify({ notes: [{ pitchName: 'C4', beats: 1 }] })],
    ['contradictory legacy pitch', JSON.stringify({ notes: [{ semitones: 0, pitchName: 'D5', beats: 1 }] })],
    ['invalid legacy beats', JSON.stringify({ notes: [{ semitones: 0, pitchName: 'C4', beats: 0 }] })],
    ['malformed JSON', '{broken'],
  ]
  for (const [label, raw] of malformedSources) {
    const result = await normalizeComposerPhrase(raw, `pd_composed_${label.replaceAll(' ', '_')}`)
    check(() => assert.equal(result, null, `${label} must be rejected`))
  }

  const values = [
    ['pd_composed_z', currentSource],
    ['pd_composed_a', legacySource],
    ['pd_composed_vocal_trainer', producerSource],
    ['pd_composed_broken', '{broken'],
    ['pd_composed_empty', JSON.stringify({ measures: [{ notes: [] }] })],
    ['unrelated_setting', currentSource],
  ] as const
  const store = makeStorage(values)
  const loaded = await loadSongcraftPhrases(store.storage)
  check(() => assert.deepEqual(loaded.map(phrase => phrase.sourceKey), [
    'pd_composed_a', 'pd_composed_vocal_trainer', 'pd_composed_z',
  ]))
  check(() => assert.deepEqual(loaded.map(phrase => phrase.title), [
    'Legacy Octaves', 'Vocal Trainer Producer', 'Octave and Rest',
  ]))
  check(() => assert.deepEqual(loaded[0]?.occurrences.map(note => note.pitchName), ['C3', null, 'G6', 'C3']))
  check(() => assert.deepEqual(store.writes(), { setItemCalls: 0, removeItemCalls: 0, clearCalls: 0 }))
  check(() => assert.deepEqual([...store.values.entries()], values))
  check(() => assert.equal(Object.isFrozen(loaded), true))

  const throwingNeighbor = makeStorage(values, {
    throwGetItemKeys: new Set(['pd_composed_broken']),
  })
  const afterNeighborFailure = await loadSongcraftPhrases(throwingNeighbor.storage)
  check(() => assert.deepEqual(afterNeighborFailure.map(phrase => phrase.sourceKey), [
    'pd_composed_a', 'pd_composed_vocal_trainer', 'pd_composed_z',
  ]))
  check(() => assert.deepEqual(throwingNeighbor.writes(), { setItemCalls: 0, removeItemCalls: 0, clearCalls: 0 }))

  const throwingKey = makeStorage(values, { throwKeyIndexes: new Set([0]) })
  const afterKeyFailure = await loadSongcraftPhrases(throwingKey.storage)
  check(() => assert.deepEqual(afterKeyFailure.map(phrase => phrase.sourceKey), [
    'pd_composed_a', 'pd_composed_vocal_trainer',
  ]))
  check(() => assert.deepEqual(throwingKey.writes(), { setItemCalls: 0, removeItemCalls: 0, clearCalls: 0 }))

  const unavailable = makeStorage([['pd_composed_good', currentSource]], { throwOnLength: true })
  const unavailableResult = await loadSongcraftPhrases(unavailable.storage)
  check(() => assert.deepEqual(unavailableResult, []))
  check(() => assert.deepEqual(unavailable.writes(), { setItemCalls: 0, removeItemCalls: 0, clearCalls: 0 }))

  const adapterSource = readFileSync(
    new URL('../src/components/PitchDefender/pitchforksSongcraftPhrase.ts', import.meta.url),
    'utf8',
  )
  check(() => assert.match(adapterSource, /extractMelodyFromComposition\(comp, \{ skipRests: false \}\)/))
  check(() => assert.doesNotMatch(adapterSource, /localStorage|\.setItem\(|\.removeItem\(|\.clear\(/))
  check(() => assert.equal((adapterSource.match(/JSON\.parse\(raw\)/g) ?? []).length, 1))
  check(() => assert.equal((adapterSource.match(/sha256Hex\(raw\)/g) ?? []).length, 1))

  console.log(`pitchforks songcraft phrase: ${checks}/${checks} PASS`)
}

void main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
