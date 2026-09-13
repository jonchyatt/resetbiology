import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { loadHashedComposedSongs } from '../src/components/PitchDefender/pitchforks3SongSequence'

let checks = 0
const check = (run: () => void) => { run(); checks += 1 }

const originalLocalStorage = globalThis.localStorage
const baseKeys = ['e/4', 'f/4', 'g/4', 'e/4']
const changedKeys = ['e/4', 'f/4', 'a/4', 'e/4']

function compositionRaw(keys: readonly string[], tempo = 96): string {
  return JSON.stringify({
    title: 'Integrity fixture',
    tempo,
    measures: [{
      notes: keys.map(key => ({ keys: [key], duration: 'q' })),
    }],
  })
}

function expectedHash(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex')
}

interface StorageOptions {
  throwGetItemKeys?: ReadonlySet<string>
  throwOnLength?: boolean
}

function installStorage(values: Map<string, string>, options: StorageOptions = {}) {
  let setItemCalls = 0
  let removeItemCalls = 0
  let clearCalls = 0
  const storage: Storage = {
    get length() {
      if (options.throwOnLength) throw new Error('storage length unavailable')
      return values.size
    },
    clear: () => { clearCalls += 1 },
    getItem: key => {
      if (options.throwGetItemKeys?.has(key)) throw new Error(`read failed: ${key}`)
      return values.get(key) ?? null
    },
    key: index => [...values.keys()][index] ?? null,
    removeItem: () => { removeItemCalls += 1 },
    setItem: () => { setItemCalls += 1 },
  }
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: storage,
  })
  return { setItemCalls: () => setItemCalls, removeItemCalls: () => removeItemCalls, clearCalls: () => clearCalls }
}

function assertNoWrites(counters: ReturnType<typeof installStorage>) {
  check(() => assert.equal(counters.setItemCalls(), 0))
  check(() => assert.equal(counters.removeItemCalls(), 0))
  check(() => assert.equal(counters.clearCalls(), 0))
}

async function main() {
  const baseRaw = compositionRaw(baseKeys)
  const changedRaw = compositionRaw(changedKeys)

  try {
    const values = new Map<string, string>([
      ['pd_composed_integrity', baseRaw],
      ['pd_composed_broken', '{broken'],
      ['pd_composed_empty', JSON.stringify({ title: 'Empty', measures: [{ notes: [{ keys: [], duration: 'q' }] }] })],
    ])
    const counters = installStorage(values)
    const first = await loadHashedComposedSongs()
    const second = await loadHashedComposedSongs()

    check(() => assert.equal(first.length, 1))
    check(() => assert.equal(first[0]?.key, 'pd_composed_integrity'))
    check(() => assert.deepEqual(first[0]?.notes.map(note => note.pitchName), ['E4', 'F4', 'G4', 'E4']))
    check(() => assert.deepEqual(first, second))
    check(() => assert.equal(first[0]?.sourceSha256, expectedHash(baseRaw)))
    check(() => assert.match(first[0]?.sourceSha256 ?? '', /^[a-f0-9]{64}$/))
    check(() => assert.equal(values.get('pd_composed_integrity'), baseRaw))
    assertNoWrites(counters)

    values.set('pd_composed_integrity', changedRaw)
    const changed = await loadHashedComposedSongs()
    check(() => assert.deepEqual(changed[0]?.notes.map(note => note.pitchName), ['E4', 'F4', 'A4', 'E4']))
    check(() => assert.notEqual(changed[0]?.sourceSha256, first[0]?.sourceSha256))
    check(() => assert.equal(changed[0]?.sourceSha256, expectedHash(changedRaw)))
    check(() => assert.equal(values.get('pd_composed_integrity'), changedRaw))

    const metadataRaw = compositionRaw(baseKeys, 120)
    values.set('pd_composed_integrity', metadataRaw)
    const metadataMutation = await loadHashedComposedSongs()
    check(() => assert.deepEqual(metadataMutation[0]?.notes.map(note => note.pitchName), ['E4', 'F4', 'G4', 'E4']))
    check(() => assert.notEqual(metadataMutation[0]?.sourceSha256, first[0]?.sourceSha256))
    check(() => assert.equal(metadataMutation[0]?.sourceSha256, expectedHash(metadataRaw)))

    const whitespaceRaw = `${JSON.stringify(JSON.parse(baseRaw), null, 2)}\n`
    values.set('pd_composed_integrity', whitespaceRaw)
    const whitespaceMutation = await loadHashedComposedSongs()
    check(() => assert.deepEqual(whitespaceMutation[0]?.notes.map(note => note.pitchName), ['E4', 'F4', 'G4', 'E4']))
    check(() => assert.notEqual(whitespaceMutation[0]?.sourceSha256, first[0]?.sourceSha256))
    check(() => assert.equal(whitespaceMutation[0]?.sourceSha256, expectedHash(whitespaceRaw)))

    const throwingValues = new Map<string, string>([
      ['pd_composed_good', baseRaw],
      ['pd_composed_throwing', changedRaw],
      ['unrelated_setting', 'leave me alone'],
    ])
    const throwingSnapshot = [...throwingValues.entries()]
    const throwingCounters = installStorage(throwingValues, {
      throwGetItemKeys: new Set(['pd_composed_throwing']),
    })
    const afterThrowingGetItem = await loadHashedComposedSongs()
    check(() => assert.deepEqual(afterThrowingGetItem.map(song => song.key), ['pd_composed_good']))
    check(() => assert.deepEqual([...throwingValues.entries()], throwingSnapshot))
    assertNoWrites(throwingCounters)

    const unavailableValues = new Map<string, string>([['pd_composed_good', baseRaw]])
    const unavailableSnapshot = [...unavailableValues.entries()]
    const unavailableCounters = installStorage(unavailableValues, { throwOnLength: true })
    const afterUnavailableRead = await loadHashedComposedSongs()
    check(() => assert.deepEqual(afterUnavailableRead, []))
    check(() => assert.deepEqual([...unavailableValues.entries()], unavailableSnapshot))
    assertNoWrites(unavailableCounters)

    console.log(`pitchforks composer source integrity: ${checks}/${checks} PASS`)
  } finally {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    })
  }
}

void main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
