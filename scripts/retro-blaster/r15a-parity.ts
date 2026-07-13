import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import * as current from '../../src/components/PitchDefender/retroBlasterEngine'
import type { EngineEvent, EngineInput, GameState } from '../../src/components/PitchDefender/retroBlasterEngine'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const NOTES = ['C4', 'D4', 'E4', 'F4']
const DT_MS = 16

type EngineModule = Pick<typeof current,
  'W' | 'H' | 'beginWave' | 'createInitialState' | 'tick'>

interface TimedEvent {
  atMs: number
  event: EngineEvent
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function input(answeredNote?: string): EngineInput {
  return {
    inputMode: 'click', isListening: false, reducedMotion: false,
    pitch: null, fsrs: {}, answeredNote,
  }
}

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

async function loadParentEngine(): Promise<{ engine: EngineModule; cleanup: () => Promise<void> }> {
  const source = execFileSync(
    'git', ['show', 'HEAD:src/components/PitchDefender/retroBlasterEngine.ts'],
    { cwd: root, encoding: 'utf8' },
  )
  const imports = new Map([
    ['../../lib/fsrs', pathToFileURL(resolve(root, 'src/lib/fsrs.ts')).href],
    ['./types', pathToFileURL(resolve(root, 'src/components/PitchDefender/types.ts')).href],
    ['./pitchMath', pathToFileURL(resolve(root, 'src/components/PitchDefender/pitchMath.ts')).href],
  ])
  let rewritten = source
  for (const [specifier, url] of imports) rewritten = rewritten.replace(`from '${specifier}'`, `from '${url}'`)
  const tempDir = await mkdtemp(join(tmpdir(), 'retro-r15a-parent-'))
  const tempFile = join(tempDir, 'retroBlasterEngine.ts')
  await writeFile(tempFile, rewritten, 'utf8')
  const engine = await import(`${pathToFileURL(tempFile).href}?r15a=${Date.now()}`) as EngineModule
  return { engine, cleanup: () => rm(tempDir, { recursive: true, force: true }) }
}

function run(engine: EngineModule): TimedEvent[] {
  let state = engine.createInitialState('easy', NOTES, 1) as GameState
  engine.beginWave(state, {})
  state.waveIntroTimer = 0
  state.nextSpawnAt = state.clockMs
  const answered = new Set<string>()
  const events: TimedEvent[] = []
  const rng = mulberry32(1515)

  for (let step = 0; step < 3000 && state.wave < 3; step++) {
    const active = state.aliens[state.activeIdx]
    const targetKey = `${state.wave}:${state.activeIdx}`
    const answeredNote = active?.alive && !active.entering && !answered.has(targetKey)
      ? active.note
      : undefined
    if (answeredNote) answered.add(targetKey)
    const result = engine.tick(state, input(answeredNote), DT_MS, rng)
    state = result.state as GameState
    for (const event of result.events) events.push({ atMs: step * DT_MS, event })
  }
  assert(state.wave >= 3, `replay did not complete two waves at ${engine.W}x${engine.H}`)
  return events
}

function semantic(event: EngineEvent): unknown {
  if (event.kind === 'spawn') return { kind: event.kind, note: event.note }
  return event
}

async function main(): Promise<void> {
  const parentHandle = await loadParentEngine()
  try {
    const before = run(parentHandle.engine)
    const after = run(current)
    const beforeSemantic = before.map(({ atMs, event }) => ({ atMs, event: semantic(event) }))
    const afterSemantic = after.map(({ atMs, event }) => ({ atMs, event: semantic(event) }))
    assert(JSON.stringify(afterSemantic) === JSON.stringify(beforeSemantic),
      `semantic replay drifted:\nBEFORE ${JSON.stringify(beforeSemantic)}\nAFTER ${JSON.stringify(afterSemantic)}`)
    console.log(`PASS R1.5a semantic parity: ${after.length} timed events identical across ${parentHandle.engine.W}x${parentHandle.engine.H} -> ${current.W}x${current.H}; spawn X excluded as declared geometry`)
  } finally {
    await parentHandle.cleanup()
  }
}

void main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
