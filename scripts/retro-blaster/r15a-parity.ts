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

function input(state: GameState, answeredNote?: string): EngineInput {
  const attack = state.activeAttack
  return {
    inputMode: 'click', isListening: false, reducedMotion: false,
    pitch: null, fsrs: {},
    pendingAnswer: answeredNote && attack ? {
      note: answeredNote,
      inputMode: 'click',
      gameId: state.gameId,
      alienId: attack.alienId,
      attackId: attack.attackId,
    } : undefined,
    ...(!('gameId' in state) ? { answeredNote } : {}),
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
    const attack = state.activeAttack
    const active = attack
      ? state.aliens.find(candidate => candidate.alienId === attack.alienId)
      : state.aliens[(state as GameState & { activeIdx?: number }).activeIdx ?? -1]
    const targetKey = attack?.attackId ?? `${state.wave}:${(state as GameState & { activeIdx?: number }).activeIdx}`
    const answerOpen = attack
      ? attack.phase === 'outbound' && attack.outcome === null && attack.demandAtMs !== null
      : active?.alive && !active.entering
    const answeredNote = answerOpen && active?.alive && !active.entering && !answered.has(targetKey)
      ? active.note
      : undefined
    if (answeredNote) answered.add(targetKey)
    const result = engine.tick(state, input(state, answeredNote), DT_MS, rng)
    state = result.state as GameState
    for (const event of result.events) events.push({ atMs: step * DT_MS, event })
  }
  assert(state.wave >= 3, `replay did not complete two waves at ${engine.W}x${engine.H}`)
  return events
}

function semantic(event: EngineEvent): unknown {
  if (event.kind === 'spawn') return { kind: event.kind, note: event.note }
  if (event.kind === 'playNote') return { kind: event.kind, note: event.note }
  if (event.kind === 'grade') {
    return { kind: event.kind, note: event.note, correct: event.correct, latencyMs: event.latencyMs }
  }
  if (event.kind === 'unlock') return { kind: event.kind, note: event.note }
  return event
}

async function main(): Promise<void> {
  const parentHandle = await loadParentEngine()
  try {
    const before = run(parentHandle.engine)
    const after = run(current)
    const beforeSemantic = before.map(({ atMs, event }) => ({ atMs, event: semantic(event) }))
    const afterSemantic = after.map(({ atMs, event }) => ({ atMs, event: semantic(event) }))
    assert(afterSemantic.length === beforeSemantic.length,
      `semantic event count drifted: ${beforeSemantic.length} -> ${afterSemantic.length}`)
    let maxDelayMs = 0
    const kinds = new Set(beforeSemantic.map(item => (item.event as { kind: string }).kind))
    for (const kind of kinds) {
      const beforeKind = beforeSemantic.filter(item => (item.event as { kind: string }).kind === kind)
      const afterKind = afterSemantic.filter(item => (item.event as { kind: string }).kind === kind)
      assert(afterKind.length === beforeKind.length,
        `${kind} event count drifted: ${beforeKind.length} -> ${afterKind.length}`)
      for (let index = 0; index < beforeKind.length; index++) {
        assert(JSON.stringify(afterKind[index].event) === JSON.stringify(beforeKind[index].event),
          `${kind} payload/order drifted at ${index}: ${JSON.stringify(beforeKind[index])} -> ${JSON.stringify(afterKind[index])}`)
        const delayMs = afterKind[index].atMs - beforeKind[index].atMs
        // R3c intentionally allows later spawns to interleave before an answer
        // while preserving every event channel's own payload order.
        assert(delayMs >= 0, `R3c ${kind} event accelerated ahead of the protected trace at ${index}: ${delayMs}ms`)
        maxDelayMs = Math.max(maxDelayMs, delayMs)
      }
    }
    console.log(`PASS R1.5a semantic parity: ${after.length} payloads and per-channel order identical; no event earlier; max declared R3c authored delay ${maxDelayMs}ms; cross-channel interleaving, spawn X, and attack identity excluded as declared timing/geometry/ownership`)
  } finally {
    await parentHandle.cleanup()
  }
}

void main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
