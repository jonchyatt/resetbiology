import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import {
  loadHashedComposedSongs,
} from '../src/components/PitchDefender/pitchforks3SongSequence'

let checks = 0
const check = (run: () => void) => { run(); checks += 1 }

const fixture = readFileSync(
  new URL('./fixtures/pd_composed_pitchforks_seed.json', import.meta.url),
  'utf8',
)
const expectedHash = createHash('sha256').update(fixture, 'utf8').digest('hex')
const values = new Map<string, string>([
  ['unrelated_setting', 'leave me alone'],
  ['pd_composed_broken', '{broken'],
  ['pd_composed_pitchforks_seed', fixture],
])
let setItemCalls = 0
let removeItemCalls = 0

const storage: Storage = {
  get length() { return values.size },
  clear: () => { throw new Error('read-side loader must not clear storage') },
  getItem: key => values.get(key) ?? null,
  key: index => [...values.keys()][index] ?? null,
  removeItem: () => { removeItemCalls += 1 },
  setItem: () => { setItemCalls += 1 },
}
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: storage,
})

async function main() {
  const songs = await loadHashedComposedSongs()
  check(() => assert.equal(songs.length, 1))
  check(() => assert.equal(songs[0].key, 'pd_composed_pitchforks_seed'))
  check(() => assert.equal(songs[0].title, "Frank's First Storm"))
  check(() => assert.deepEqual(songs[0].notes.map(note => note.pitchName), ['E4', 'F4', 'G4', 'E4']))
  check(() => assert.equal(songs[0].notes.length, 4))
  check(() => assert.equal(songs[0].sourceSha256, expectedHash))
  check(() => assert.match(songs[0].sourceSha256, /^[a-f0-9]{64}$/))
  check(() => assert.equal(setItemCalls, 0))
  check(() => assert.equal(removeItemCalls, 0))
  check(() => assert.equal(values.get('pd_composed_pitchforks_seed'), fixture))

const loaderSource = readFileSync(
  new URL('../src/components/PitchDefender/pitchforks3SongSequence.ts', import.meta.url),
  'utf8',
)
const hashedLoader = loaderSource.slice(
  loaderSource.indexOf('export async function loadHashedComposedSongs'),
  loaderSource.indexOf('export interface SongSequenceState'),
)
check(() => assert.match(hashedLoader, /extractMelodyFromComposition\(comp, \{ skipRests: true \}\)/))
check(() => assert.match(hashedLoader, /sha256Hex\(raw\)/))
check(() => assert.doesNotMatch(hashedLoader, /\.setItem\(|\.removeItem\(|\.clear\(/))

const componentSource = readFileSync(
  new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url),
  'utf8',
)
const proofStart = componentSource.indexOf('data-testid="pf3-composer-seed-proof"')
const proofEnd = componentSource.indexOf('aria-label="World Map"', proofStart)
const proofPanel = componentSource.slice(proofStart, proofEnd)
check(() => assert.ok(proofStart > 0 && proofEnd > proofStart))
check(() => assert.match(componentSource, /get\('composerSeedProof'\) !== '1'/))
check(() => assert.match(proofPanel, /READ-ONLY COMPOSER CHECK/))
check(() => assert.match(proofPanel, /Proof only — this score does not control this run\./))
check(() => assert.match(proofPanel, /Extracted notes:/))
check(() => assert.match(proofPanel, /Playable notes:/))
check(() => assert.match(proofPanel, /SHA-256:/))
check(() => assert.match(proofPanel, /break-all/))
  check(() => assert.doesNotMatch(proofPanel, /<button|tempo|beat|picker|selected song/i))

  console.log(`pitchforks composer seed: ${checks}/${checks} PASS`)
}

void main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
