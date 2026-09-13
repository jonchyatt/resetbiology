import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import {
  normalizeComposerPhrase,
  SONGCRAFT_BUILTIN_LICENSE_ID,
  SONGCRAFT_BUILTIN_LICENSE_TEXT,
} from '../src/components/PitchDefender/pitchforksSongcraftPhrase'
import {
  SONGCRAFT_PRESET_CATALOG,
  type SongcraftPresetDescriptor,
} from '../src/components/PitchDefender/pitchforksSongcraftPresetCatalog'

const EXPECTED_PAIRS = [
  { low: 'C3', high: 'D3', lowSemi: -12, highSemi: -10, titles: ['Lantern Steps', 'Lantern Answer', 'Lantern Echo'], slug: 'lantern-steps-c3-d3' },
  { low: 'D3', high: 'E3', lowSemi: -10, highSemi: -8, titles: ['Pebble Reply', 'Pebble Answer', 'Pebble Echo'], slug: 'pebble-reply-d3-e3' },
  { low: 'E3', high: 'F3', lowSemi: -8, highSemi: -7, titles: ['Meadow Hinge', 'Meadow Answer', 'Meadow Echo'], slug: 'meadow-hinge-e3-f3' },
  { low: 'F3', high: 'G3', lowSemi: -7, highSemi: -5, titles: ['Cedar Glide', 'Cedar Answer', 'Cedar Echo'], slug: 'cedar-glide-f3-g3' },
  { low: 'G3', high: 'A3', lowSemi: -5, highSemi: -3, titles: ['River Turn', 'River Answer', 'River Echo'], slug: 'river-turn-g3-a3' },
  { low: 'A3', high: 'B3', lowSemi: -3, highSemi: -1, titles: ['Cloud Ladder', 'Cloud Answer', 'Cloud Echo'], slug: 'cloud-ladder-a3-b3' },
  { low: 'B3', high: 'C4', lowSemi: -1, highSemi: 0, titles: ['Bell Threshold', 'Bell Answer', 'Bell Echo'], slug: 'bell-threshold-b3-c4' },
  { low: 'C4', high: 'D4', lowSemi: 0, highSemi: 2, titles: ['Hearth Steps', 'Hearth Answer', 'Hearth Echo'], slug: 'hearth-steps-c4-d4' },
  { low: 'D4', high: 'E4', lowSemi: 2, highSemi: 4, titles: ['Copper Drift', 'Copper Answer', 'Copper Echo'], slug: 'copper-drift-d4-e4' },
  { low: 'E4', high: 'F4', lowSemi: 4, highSemi: 5, titles: ['Quiet Orbit', 'Quiet Answer', 'Quiet Echo'], slug: 'quiet-orbit-e4-f4' },
  { low: 'F4', high: 'G4', lowSemi: 5, highSemi: 7, titles: ['Mossy Window', 'Mossy Answer', 'Mossy Echo'], slug: 'mossy-window-f4-g4' },
  { low: 'G4', high: 'A4', lowSemi: 7, highSemi: 9, titles: ['Rain Thread', 'Rain Answer', 'Rain Echo'], slug: 'rain-thread-g4-a4' },
  { low: 'A4', high: 'B4', lowSemi: 9, highSemi: 11, titles: ['Amber Pair', 'Amber Answer', 'Amber Echo'], slug: 'amber-pair-a4-b4' },
  { low: 'B4', high: 'C5', lowSemi: 11, highSemi: 12, titles: ['Frosted Gate', 'Frosted Answer', 'Frosted Echo'], slug: 'frosted-gate-b4-c5' },
] as const

const LICENSE_ID = SONGCRAFT_BUILTIN_LICENSE_ID
const LICENSE_TEXT = SONGCRAFT_BUILTIN_LICENSE_TEXT

interface RawNote {
  readonly semitones?: number
  readonly beats: number
  readonly pitchName?: string
  readonly isRest?: boolean
}

interface RawMetadata {
  readonly packId: string
  readonly packVersion: string
  readonly presetId: string
  readonly author: string
  readonly licenseId: string
  readonly licenseText: string
  readonly sourceReference: string
}

interface RawPreset {
  readonly title: string
  readonly notes: readonly RawNote[]
  readonly songcraftPreset: RawMetadata
}

interface ExpectedNote {
  readonly semitones?: number
  readonly beats: number
  readonly pitchName?: string
  readonly isRest?: boolean
}

function expectedNotes(
  pair: typeof EXPECTED_PAIRS[number],
  variant: number,
): readonly ExpectedNote[] {
  const low = { semitones: pair.lowSemi, beats: 1, pitchName: pair.low }
  const high = { semitones: pair.highSemi, beats: 1, pitchName: pair.high }
  if (variant === 1) {
    return [
      { ...high, beats: 0.5 },
      { ...low, beats: 0.5 },
      { isRest: true, beats: 1 },
      high,
      { ...high, beats: 0.5 },
      low,
      { isRest: true, beats: 0.5 },
    ]
  }
  if (variant === 2) {
    return [
      { isRest: true, beats: 0.5 },
      low,
      { ...high, beats: 0.5 },
      { ...low, beats: 0.5 },
      { isRest: true, beats: 1 },
      high,
      { ...low, beats: 0.5 },
      high,
    ]
  }
  return [
    low,
    high,
    { isRest: true, beats: 1 },
    { ...low, beats: 0.5 },
    high,
    low,
  ]
}

function expectedPairSequence(): readonly string[] {
  return EXPECTED_PAIRS.flatMap(pair => (
    [1, 2, 3].map(() => `${pair.low}–${pair.high}`)
  ))
}

function expectedTitleSequence(): readonly string[] {
  return EXPECTED_PAIRS.flatMap(pair => (
    pair.titles.flatMap(title => `${title} · ${pair.low}–${pair.high}`)
  ))
}

function expectedIdSequence(): readonly string[] {
  return EXPECTED_PAIRS.flatMap(pair => (
    [1, 2, 3].map(variant => `${pair.slug}-v${variant}`)
  ))
}

function sha256(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex')
}

function parseRaw(raw: string): RawPreset {
  return JSON.parse(raw) as RawPreset
}

let checks = 0
const check = (run: () => void) => {
  run()
  checks += 1
}

async function main(): Promise<void> {
  check(() => assert.equal(SONGCRAFT_PRESET_CATALOG.length, 42))
  check(() => assert.deepEqual(
    SONGCRAFT_PRESET_CATALOG.map(descriptor => {
      const title = parseRaw(descriptor.raw).title
      const match = title.match(/ · ([A-G]\d)–([A-G]\d)$/u)
      if (!match) throw new Error(`missing pair title: ${title}`)
      return `${match[1]}–${match[2]}`
    }),
    expectedPairSequence(),
  ))
  check(() => assert.deepEqual(
    SONGCRAFT_PRESET_CATALOG.map(descriptor => parseRaw(descriptor.raw).title),
    expectedTitleSequence(),
  ))
  check(() => assert.deepEqual(
    SONGCRAFT_PRESET_CATALOG.map(descriptor => parseRaw(descriptor.raw).songcraftPreset.presetId),
    expectedIdSequence(),
  ))
  check(() => assert.equal(new Set(SONGCRAFT_PRESET_CATALOG.map(descriptor => parseRaw(descriptor.raw).title)).size, 42))
  check(() => assert.equal(new Set(SONGCRAFT_PRESET_CATALOG.map(descriptor => descriptor.sourceKey)).size, 42))
  check(() => assert.equal(Object.isFrozen(SONGCRAFT_PRESET_CATALOG), true))
  check(() => assert.equal(SONGCRAFT_PRESET_CATALOG.every(descriptor => Object.isFrozen(descriptor)), true))

  for (let index = 0; index < SONGCRAFT_PRESET_CATALOG.length; index += 1) {
    const descriptor: SongcraftPresetDescriptor = SONGCRAFT_PRESET_CATALOG[index]
    const pair = EXPECTED_PAIRS[Math.floor(index / 3)]
    const variant = index % 3
    const raw = parseRaw(descriptor.raw)
    const expectedId = `${pair.slug}-v${variant + 1}`
    const expectedPair = `${pair.low}–${pair.high}`

    check(() => assert.deepEqual(Object.keys(descriptor).sort(), ['expectedSha256', 'raw', 'sourceKey']))
    check(() => assert.match(descriptor.expectedSha256, /^[a-f0-9]{64}$/))
    check(() => assert.equal(sha256(descriptor.raw), descriptor.expectedSha256))
    check(() => assert.match(descriptor.sourceKey, /^builtin:practice:storm-studies:1:[a-z0-9-]+$/))
    check(() => assert.equal(descriptor.sourceKey, `builtin:practice:storm-studies:1:${expectedId}`))

    check(() => assert.deepEqual(Object.keys(raw).sort(), ['notes', 'songcraftPreset', 'title']))
    check(() => assert.equal(raw.songcraftPreset.packId, 'storm-studies'))
    check(() => assert.equal(raw.songcraftPreset.packVersion, '1'))
    check(() => assert.equal(raw.songcraftPreset.presetId, expectedId))
    check(() => assert.equal(raw.songcraftPreset.author, 'Pitchforks III original practice'))
    check(() => assert.equal(raw.songcraftPreset.licenseId, LICENSE_ID))
    check(() => assert.equal(raw.songcraftPreset.licenseText, LICENSE_TEXT))
    check(() => assert.equal(raw.songcraftPreset.sourceReference, `project:pitchforks-iii/storm-studies/1/${expectedId}`))
    check(() => assert.equal(raw.title.endsWith(expectedPair), true))
    check(() => assert.equal(raw.notes.length, 6 + variant))
    check(() => assert.equal(raw.notes.some(note => note.isRest === true), true))

    check(() => assert.deepEqual(
      raw.notes.map(note => note.isRest === true
        ? { isRest: true, beats: note.beats }
        : { semitones: note.semitones, beats: note.beats, pitchName: note.pitchName }),
      expectedNotes(pair, variant),
    ))
    check(() => assert.equal(raw.notes.every(note => (
      note.isRest === true
        ? note.semitones === undefined && note.pitchName === undefined
        : note.semitones === pair.lowSemi || note.semitones === pair.highSemi
    )), true))
    check(() => assert.equal(raw.notes.every(note => note.isRest === true || (
      note.pitchName === pair.low || note.pitchName === pair.high
    )), true))
    check(() => assert.equal(raw.notes.every(note => !('lyric' in note)), true))

    const pitches = raw.notes
      .filter(note => note.isRest !== true)
      .map(note => note.semitones)
    check(() => assert.equal(pitches.every((semitone, noteIndex) => (
      noteIndex === 0 || Math.abs(semitone! - pitches[noteIndex - 1]!) <= 2
    )), true))

    const normalized = await normalizeComposerPhrase(descriptor.raw, descriptor.sourceKey)
    if (!normalized) throw new Error(`expected normalized preset: ${descriptor.sourceKey}`)
    check(() => assert.equal(normalized.sourceKey, descriptor.sourceKey))
    check(() => assert.equal(normalized.title, raw.title))
    check(() => assert.equal(normalized.sourceSha256, descriptor.expectedSha256))
    check(() => assert.equal(normalized.occurrences.length, raw.notes.length))
    check(() => assert.deepEqual(
      normalized.occurrences.map(note => note.isRest
        ? { isRest: true, beats: note.beats, pitchName: note.pitchName, semi: note.semi }
        : { isRest: false, beats: note.beats, pitchName: note.pitchName, semi: note.semi }),
      raw.notes.map(note => note.isRest === true
        ? { isRest: true, beats: note.beats, pitchName: null, semi: null }
        : { isRest: false, beats: note.beats, pitchName: note.pitchName, semi: note.semitones }),
    ))
  }

  const catalogSource = readFileSync(
    new URL('../src/components/PitchDefender/pitchforksSongcraftPresetCatalog.ts', import.meta.url),
    'utf8',
  )
  check(() => assert.doesNotMatch(catalogSource, /JSON\.(?:parse|stringify)/))
  check(() => assert.doesNotMatch(catalogSource, /(?:transpose|constructed|user-dependent)/i))
  check(() => assert.doesNotMatch(catalogSource, /HASH_/))
  check(() => assert.equal((catalogSource.match(/expectedSha256: '[a-f0-9]{64}'/g) ?? []).length, 42))

  console.log(`pitchforks songcraft preset catalog: ${checks}/${checks} PASS`)
}

void main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
